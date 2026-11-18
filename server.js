const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "127.0.0.1";
const ROOT = __dirname;
const UPLOADS_DIR = path.join(ROOT, "uploads");
const DATA_DIR = path.join(ROOT, "data");
const PUBLIC_RECIPES_PATH = path.join(DATA_DIR, "recipes.json");
const ADMIN_STATE_PATH = path.join(DATA_DIR, "admin-v2-state.json");
const ADMIN_PRIVATE_PATH = path.join(DATA_DIR, "admin-private.json");
const SITE_SETTINGS_PATH = path.join(DATA_DIR, "site-settings.json");
const SESSION_COOKIE = "siena_admin_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;
const sessions = new Map();

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".ico": "image/x-icon",
};

const IMAGE_MIME_TO_EXT = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
};

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseDataUrl(dataUrl) {
  if (typeof dataUrl !== "string") {
    return null;
  }
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
  if (!match) {
    return null;
  }
  return { mime: match[1], base64: match[2] };
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function sendFile(filePath, response) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  fs.readFile(filePath, (error, data) => {
    if (error) {
      if (error.code === "ENOENT") {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }

      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Server error");
      return;
    }

    response.writeHead(200, { "Content-Type": contentType });
    response.end(data);
  });
}

function resolveRequestPath(urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split("?")[0]);
  const requested = cleanPath === "/" ? "/index.html" : cleanPath;
  const normalized = path.normalize(requested).replace(/^(\.\.[/\\])+/, "");
  return path.join(ROOT, normalized);
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error(error);
    }
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(temporaryPath, filePath);
}

function getDefaultSiteContent() {
  return {
    heroTitle: "Welcome to my Kitchen!",
    heroText: "Congrats! You've discovered my recipe archive.",
    libraryTitle: "More to cook next",
    footerTitle: "Siena's Kitchen",
  };
}

function getRecipeCategories(recipes) {
  return Array.from(
    new Set((recipes || []).map((recipe) => String(recipe?.category || "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
}

function loadAdminState() {
  const stored = readJson(ADMIN_STATE_PATH, null);
  if (stored && Array.isArray(stored.recipes)) {
    return {
      version: 2,
      featuredRecipeId: stored.featuredRecipeId || "",
      categories: Array.isArray(stored.categories) ? stored.categories : [],
      siteContent: { ...getDefaultSiteContent(), ...(stored.siteContent || {}) },
      recipes: stored.recipes.map((recipe) =>
        recipe.status === "published" && !recipe.publishedSnapshot
          ? { ...recipe, publishedSnapshot: serializePublicRecipe(recipe) }
          : recipe
      ),
    };
  }

  const publishedRecipes = readJson(PUBLIC_RECIPES_PATH, []);
  const settings = readJson(SITE_SETTINGS_PATH, {});
  return {
    version: 2,
    featuredRecipeId:
      settings.featuredRecipeId ||
      publishedRecipes.find((recipe) => recipe.id === "mr-beans-apple-snaps")?.id ||
      publishedRecipes[0]?.id ||
      "",
    categories: settings.categories || getRecipeCategories(publishedRecipes),
    siteContent: { ...getDefaultSiteContent(), ...(settings.siteContent || {}) },
    recipes: publishedRecipes.map((recipe) => ({
      ...recipe,
      status: recipe.published === false ? "draft" : "published",
      measurementSystem: recipe.measurementSystem || "au",
      publishedSnapshot: recipe.published === false ? null : serializePublicRecipe(recipe),
    })),
  };
}

function serializePublicRecipe(recipe) {
  const {
    status,
    ingredientItems,
    macroAssistant,
    updatedAt,
    published,
    publishedSnapshot,
    hasUnpublishedChanges,
    ...publicRecipe
  } = recipe;
  return { ...publicRecipe, published: true };
}

function syncPublicRecipes(state) {
  const publishedRecipes = state.recipes
    .filter((recipe) => recipe.status === "published")
    .map((recipe) => serializePublicRecipe(recipe.publishedSnapshot || recipe));
  writeJson(PUBLIC_RECIPES_PATH, publishedRecipes);
  writeJson(SITE_SETTINGS_PATH, {
    featuredRecipeId: state.featuredRecipeId || "",
    categories: state.categories || getRecipeCategories(publishedRecipes),
    siteContent: { ...getDefaultSiteContent(), ...(state.siteContent || {}) },
    updatedAt: new Date().toISOString(),
  });
}

function parseCookies(request) {
  return String(request.headers.cookie || "")
    .split(";")
    .map((entry) => entry.trim().split("="))
    .reduce((cookies, [key, ...value]) => {
      if (key) {
        cookies[key] = decodeURIComponent(value.join("="));
      }
      return cookies;
    }, {});
}

function getAuthenticatedSession(request) {
  const token = parseCookies(request)[SESSION_COOKIE];
  const session = token ? sessions.get(token) : null;
  if (!session || session.expiresAt <= Date.now()) {
    if (token) {
      sessions.delete(token);
    }
    return null;
  }
  session.expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  return { token, session };
}

function setSessionCookie(response, token, maxAge = SESSION_MAX_AGE_SECONDS) {
  response.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}`
  );
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function passwordMatches(password, privateConfig) {
  const actual = Buffer.from(hashPassword(password, privateConfig.salt), "hex");
  const expected = Buffer.from(privateConfig.passwordHash, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function createSession(response) {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, {
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  });
  setSessionCookie(response, token);
}

function readRequestJson(request, limit = 30_000_000) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > limit) {
        reject(new Error("Payload too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (error) {
        reject(new Error("Invalid JSON body"));
      }
    });
    request.on("error", reject);
  });
}

function normalizeRecipeId(value) {
  return slugify(value) || `recipe-${Date.now().toString(36)}`;
}

async function handleAdminApi(request, response, urlPath) {
  const privateConfig = readJson(ADMIN_PRIVATE_PATH, null);

  if (request.method === "GET" && urlPath === "/api/admin/auth/status") {
    sendJson(response, 200, {
      authenticated: Boolean(getAuthenticatedSession(request)),
      needsSetup: !privateConfig,
    });
    return;
  }

  if (request.method === "POST" && urlPath === "/api/admin/auth/setup") {
    if (privateConfig) {
      sendJson(response, 409, { ok: false, error: "Owner password is already configured." });
      return;
    }
    const payload = await readRequestJson(request);
    const password = String(payload.password || "");
    if (password.length < 8) {
      sendJson(response, 400, { ok: false, error: "Use at least 8 characters." });
      return;
    }
    const salt = crypto.randomBytes(16).toString("hex");
    writeJson(ADMIN_PRIVATE_PATH, {
      salt,
      passwordHash: hashPassword(password, salt),
      createdAt: new Date().toISOString(),
    });
    createSession(response);
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "POST" && urlPath === "/api/admin/auth/login") {
    if (!privateConfig) {
      sendJson(response, 409, { ok: false, error: "Create the owner password first." });
      return;
    }
    const payload = await readRequestJson(request);
    if (!passwordMatches(String(payload.password || ""), privateConfig)) {
      sendJson(response, 401, { ok: false, error: "That password is not correct." });
      return;
    }
    createSession(response);
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "POST" && urlPath === "/api/admin/auth/logout") {
    const authenticated = getAuthenticatedSession(request);
    if (authenticated) {
      sessions.delete(authenticated.token);
    }
    setSessionCookie(response, "", 0);
    sendJson(response, 200, { ok: true });
    return;
  }

  if (!getAuthenticatedSession(request)) {
    sendJson(response, 401, { ok: false, error: "Please sign in." });
    return;
  }

  if (request.method === "GET" && urlPath === "/api/admin/state") {
    sendJson(response, 200, { ok: true, state: loadAdminState() });
    return;
  }

  if (request.method === "POST" && urlPath === "/api/admin/recipe/save") {
    const payload = await readRequestJson(request);
    const incoming = payload.recipe || {};
    if (!String(incoming.title || "").trim()) {
      sendJson(response, 400, { ok: false, error: "Recipe title is required." });
      return;
    }
    const state = loadAdminState();
    const recipeId = incoming.id ? normalizeRecipeId(incoming.id) : normalizeRecipeId(incoming.title);
    const existingIndex = state.recipes.findIndex((recipe) => recipe.id === recipeId);
    const existing = existingIndex >= 0 ? state.recipes[existingIndex] : null;
    const publishedSnapshot = existing?.status === "published"
      ? existing.publishedSnapshot || serializePublicRecipe(existing)
      : existing?.publishedSnapshot || null;
    const recipe = {
      ...existing,
      ...incoming,
      id: recipeId,
      status: incoming.status || existing?.status || "draft",
      measurementSystem: incoming.measurementSystem === "us" ? "us" : "au",
      hasUnpublishedChanges: existing?.status === "published",
      publishedSnapshot,
      updatedAt: new Date().toISOString(),
    };
    if (existingIndex >= 0) {
      state.recipes[existingIndex] = recipe;
    } else {
      state.recipes.unshift(recipe);
    }
    if (recipe.category && !state.categories.includes(recipe.category)) {
      state.categories.push(recipe.category);
    }
    writeJson(ADMIN_STATE_PATH, state);
    sendJson(response, 200, { ok: true, recipe });
    return;
  }

  if (request.method === "POST" && urlPath === "/api/admin/recipe/publish") {
    const payload = await readRequestJson(request);
    const state = loadAdminState();
    const recipe = state.recipes.find((entry) => entry.id === payload.recipeId);
    if (!recipe) {
      sendJson(response, 404, { ok: false, error: "Recipe not found." });
      return;
    }
    recipe.status = payload.publish === false ? "draft" : "published";
    recipe.hasUnpublishedChanges = false;
    recipe.publishedSnapshot = payload.publish === false ? recipe.publishedSnapshot : serializePublicRecipe(recipe);
    recipe.updatedAt = new Date().toISOString();
    if (recipe.status === "draft" && state.featuredRecipeId === recipe.id) {
      state.featuredRecipeId = state.recipes.find(
        (entry) => entry.id !== recipe.id && entry.status === "published"
      )?.id || "";
    }
    writeJson(ADMIN_STATE_PATH, state);
    syncPublicRecipes(state);
    sendJson(response, 200, { ok: true, recipe, state });
    return;
  }

  if (request.method === "DELETE" && urlPath === "/api/admin/recipe") {
    const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    const recipeId = requestUrl.searchParams.get("id") || "";
    const state = loadAdminState();
    const existing = state.recipes.find((recipe) => recipe.id === recipeId);
    if (!existing) {
      sendJson(response, 404, { ok: false, error: "Recipe not found." });
      return;
    }
    state.recipes = state.recipes.filter((recipe) => recipe.id !== recipeId);
    if (state.featuredRecipeId === recipeId) {
      state.featuredRecipeId = state.recipes.find((recipe) => recipe.status === "published")?.id || "";
    }
    writeJson(ADMIN_STATE_PATH, state);
    syncPublicRecipes(state);
    sendJson(response, 200, { ok: true, state });
    return;
  }

  if (request.method === "POST" && urlPath === "/api/admin/featured") {
    const payload = await readRequestJson(request);
    const state = loadAdminState();
    const recipe = state.recipes.find((entry) => entry.id === payload.recipeId);
    if (!recipe || recipe.status !== "published") {
      sendJson(response, 400, { ok: false, error: "Publish the recipe before featuring it." });
      return;
    }
    state.featuredRecipeId = recipe.id;
    writeJson(ADMIN_STATE_PATH, state);
    syncPublicRecipes(state);
    sendJson(response, 200, { ok: true, state });
    return;
  }

  if (request.method === "POST" && urlPath === "/api/admin/site") {
    const payload = await readRequestJson(request);
    const state = loadAdminState();
    if (Array.isArray(payload.categories)) {
      state.categories = Array.from(
        new Set(payload.categories.map((category) => String(category || "").trim()).filter(Boolean))
      );
    }
    if (payload.categoryRenames && typeof payload.categoryRenames === "object") {
      Object.entries(payload.categoryRenames).forEach(([previous, next]) => {
        const nextName = String(next || "").trim();
        if (!nextName) return;
        state.recipes.forEach((recipe) => {
          if (String(recipe.category || "").trim().toLowerCase() === previous.trim().toLowerCase()) {
            recipe.category = nextName;
            if (recipe.publishedSnapshot) {
              recipe.publishedSnapshot.category = nextName;
            }
          }
        });
      });
    }
    if (payload.siteContent && typeof payload.siteContent === "object") {
      state.siteContent = { ...getDefaultSiteContent(), ...state.siteContent, ...payload.siteContent };
    }
    writeJson(ADMIN_STATE_PATH, state);
    syncPublicRecipes(state);
    sendJson(response, 200, { ok: true, state });
    return;
  }

  sendJson(response, 404, { ok: false, error: "Admin API route not found." });
}

const server = http.createServer(async (request, response) => {
  const urlPath = (request.url || "/").split("?")[0];
  const filePath = resolveRequestPath(request.url || "/");

  if (urlPath.startsWith("/api/admin/") && urlPath !== "/api/admin/upload") {
    try {
      await handleAdminApi(request, response, urlPath);
    } catch (error) {
      console.error(error);
      sendJson(response, error.message === "Payload too large" ? 413 : 400, {
        ok: false,
        error: error.message || "Unable to complete request.",
      });
    }
    return;
  }

  if (
    request.method === "POST" &&
    (urlPath === "/api/upload" || urlPath === "/api/admin/upload")
  ) {
    if (urlPath === "/api/admin/upload" && !getAuthenticatedSession(request)) {
      sendJson(response, 401, { ok: false, error: "Please sign in." });
      return;
    }
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 25_000_000) {
        response.writeHead(413, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Payload too large");
        request.destroy();
      }
    });
    request.on("end", () => {
      let payload = null;
      try {
        payload = JSON.parse(body || "{}");
      } catch (error) {
        sendJson(response, 400, { ok: false, error: "Invalid JSON body" });
        return;
      }

      const parsed = parseDataUrl(payload.dataUrl);
      if (!parsed) {
        sendJson(response, 400, { ok: false, error: "Invalid image data" });
        return;
      }

      const baseName =
        slugify(payload.recipeId) ||
        slugify(payload.title) ||
        slugify(payload.filename) ||
        "image";
      const ext = IMAGE_MIME_TO_EXT[parsed.mime] || "jpg";
      const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const fileName = `${baseName}-${unique}.${ext}`;
      const outputPath = path.join(UPLOADS_DIR, fileName);

      fs.mkdir(UPLOADS_DIR, { recursive: true }, (dirError) => {
        if (dirError) {
          sendJson(response, 500, { ok: false, error: "Unable to create uploads folder" });
          return;
        }
        const buffer = Buffer.from(parsed.base64, "base64");
        fs.writeFile(outputPath, buffer, (writeError) => {
          if (writeError) {
            sendJson(response, 500, { ok: false, error: "Unable to save image" });
            return;
          }
          sendJson(response, 200, { ok: true, path: `/uploads/${fileName}` });
        });
      });
    });
    return;
  }

  if (!filePath.startsWith(ROOT)) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

  fs.stat(filePath, (error, stats) => {
    if (!error && stats.isDirectory()) {
      sendFile(path.join(filePath, "index.html"), response);
      return;
    }

    sendFile(filePath, response);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Siena's Kitchen is running at http://localhost:${PORT}`);
});
