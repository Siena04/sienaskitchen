const PREVIEW_STORAGE_KEY = "recipe-site-draft";
const DELETED_STORAGE_KEY = "recipe-site-draft-deleted";

const recipeGrid = document.getElementById("recipeGrid");
const recipeCardTemplate = document.getElementById("recipeCardTemplate");
const searchInput = document.getElementById("searchInput");
const topSearchInput = document.getElementById("topSearchInput");
const searchOverlay = document.getElementById("searchOverlay");
const overlaySearchInput = document.getElementById("overlaySearchInput");
const overlaySearchResults = document.getElementById("overlaySearchResults");
const categoryFilter = document.getElementById("categoryFilter");
const recipeViewContainer = document.getElementById("recipeViewContainer");
const cookOverlay = document.getElementById("cookOverlay");
const cookOverlayContent = document.getElementById("cookOverlayContent");
const cookPrevButton = document.getElementById("cookPrev");
const cookNextButton = document.getElementById("cookNext");
const quickLinkCards = document.querySelectorAll(".quick-link-card");
const categoryRows = document.getElementById("categoryRows");
const featuredRecipeCard = document.querySelector("[data-featured-recipe]");
const featuredRecipeTitle = document.querySelector("[data-featured-title]");
const featuredRecipeDescription = document.querySelector("[data-featured-description]");
const featuredRecipeImage = document.querySelector("[data-featured-image]");
const featuredRecipeImageLink = document.querySelector("[data-featured-image-link]");
const featuredRecipeLink = document.querySelector("[data-featured-link]");
const siteHeroTitle = document.querySelector("[data-site-hero-title]");
const siteHeroText = document.querySelector("[data-site-hero-text]");
const siteLibraryTitle = document.querySelector("[data-site-library-title]");
const siteFooterTitle = document.querySelector("[data-site-footer-title]");

let allRecipes = [];
let filteredRecipes = [];
let selectedRecipeId = null;
let cookStepIndex = 0;
let recipeViewMode = "preview";
let measurementSystem = "au";
let deletedRecipeIds = new Set();
let siteSettings = {};
let activeHomeCategory = "";

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function loadDeletedIds() {
  try {
    const raw = localStorage.getItem(DELETED_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch (error) {
    console.error(error);
    return new Set();
  }
}

function loadPreviewRecipes() {
  try {
    const raw = localStorage.getItem(PREVIEW_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error(error);
    return [];
  }
}

async function loadSiteSettings() {
  try {
    const response = await fetch("./data/site-settings.json", { cache: "no-store" });
    return response.ok ? await response.json() : {};
  } catch (error) {
    return {};
  }
}

function applySiteSettings(settings) {
  const content = settings?.siteContent || {};
  if (settings?.featuredRecipeId && featuredRecipeCard) {
    featuredRecipeCard.dataset.featuredRecipe = settings.featuredRecipeId;
  }
  if (content.heroTitle && siteHeroTitle) siteHeroTitle.textContent = content.heroTitle;
  if (content.heroText && siteHeroText) siteHeroText.textContent = content.heroText;
  if (content.libraryTitle && siteLibraryTitle) siteLibraryTitle.textContent = content.libraryTitle;
  if (content.footerTitle && siteFooterTitle) siteFooterTitle.textContent = content.footerTitle;
}

function isRecipePublished(recipe) {
  return recipe?.published !== false;
}

function mergeRecipeSets(published, drafts) {
  const merged = new Map();
  (published || []).forEach((recipe) => {
    if (recipe?.id) {
      if (deletedRecipeIds.has(recipe.id)) {
        return;
      }
      merged.set(recipe.id, recipe);
    }
  });
  (drafts || []).forEach((recipe) => {
    if (!recipe?.id) {
      return;
    }
    if (deletedRecipeIds.has(recipe.id)) {
      return;
    }
    const existing = merged.get(recipe.id) || {};
    const next = { ...existing, ...recipe };
    if (!recipe.image && existing.image) {
      next.image = existing.image;
    }
    merged.set(recipe.id, next);
  });
  return Array.from(merged.values());
}

async function loadRecipes() {
  const params = new URLSearchParams(window.location.search);
  deletedRecipeIds = loadDeletedIds();
  const previewRecipes = loadPreviewRecipes();
  const previewOnly = params.get("preview") === "1";
  if (previewOnly) {
    return previewRecipes.filter(
      (recipe) => recipe?.id && !deletedRecipeIds.has(recipe.id) && isRecipePublished(recipe)
    );
  }

  try {
    const response = await fetch("./data/recipes.json");
    if (!response.ok) {
      throw new Error("Unable to load recipes.json");
    }
    const publishedRecipes = await response.json();
    const filteredPublished = publishedRecipes.filter(
      (recipe) => recipe?.id && !deletedRecipeIds.has(recipe.id)
    );
    return filteredPublished.filter(isRecipePublished);
  } catch (error) {
    console.error(error);
    return previewRecipes.filter(
      (recipe) => recipe?.id && !deletedRecipeIds.has(recipe.id) && isRecipePublished(recipe)
    );
  }
}

function normalizeText(value) {
  return String(value || "").toLowerCase().trim();
}

const COOKING_PATTERNS = [
  /\bpreheat\b/,
  /\bbake\b/,
  /\broast\b/,
  /\bbroil\b/,
  /\bgrill\b/,
  /\bsimmer\b/,
  /\bboil\b/,
  /\bfry\b/,
  /\bsaute\b/,
  /\bsauté\b/,
  /\bstir[- ]?fry\b/,
  /\bair\s?fry\b/,
  /\bsear\b/,
  /\btoast\b/,
  /\bbraise\b/,
  /\bsteam\b/,
  /\bpoach\b/,
  /\bblanch\b/,
  /\bsmoke\b/,
  /\bcarameliz(e|ing)\b/,
  /\breduce\b/,
  /\bglaze\b/,
  /\bmelt\b/,
];

const COOK_CONTEXT_PATTERN = /\bcook(ing)?\s+(for|until|over|on|in|at)\b/;
const HEAT_CONTEXT_PATTERN = /\b(oven|stove|stovetop|cooktop|heat|heated|microwave)\b/;
const COOK_ACTION_PATTERN =
  /\b(cook|bake|roast|simmer|boil|fry|grill|broil|reduce|heat)\b/;

function isCookingInstruction(text) {
  const normalized = normalizeText(text);
  if (!normalized) {
    return false;
  }
  if (COOKING_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return true;
  }
  if (COOK_CONTEXT_PATTERN.test(normalized)) {
    return true;
  }
  const hasTime = /\b\d+\s?(mins?|minutes?|hrs?|hours?)\b/.test(normalized);
  const hasTemp =
    /\b\d{2,3}\s?°\s?[cf]?\b/.test(normalized) ||
    /\b\d{2,3}\s?(c|f|celsius|fahrenheit)\b/.test(normalized);
  if ((hasTime || hasTemp) && (HEAT_CONTEXT_PATTERN.test(normalized) || COOK_ACTION_PATTERN.test(normalized))) {
    return true;
  }
  return false;
}

function getStepText(step) {
  if (step && typeof step === "object") {
    return String(step.text ?? step.value ?? "");
  }
  return String(step || "");
}

function isCookStep(step) {
  if (step && typeof step === "object" && typeof step.cook === "boolean") {
    return step.cook;
  }
  return isCookingInstruction(getStepText(step));
}

function recipeHasImage(recipe) {
  return recipe && recipe.image;
}

function findRecipe(recipes, predicate) {
  return (
    recipes.find((recipe) => recipeHasImage(recipe) && predicate(recipe)) ||
    recipes.find((recipe) => predicate(recipe)) ||
    recipes.find((recipe) => recipeHasImage(recipe)) ||
    recipes[0] ||
    null
  );
}

function getYieldLabel(recipe) {
  const label = normalizeText(recipe.yieldLabel || "serves");
  return label.startsWith("make") ? "Makes" : "Serves";
}

function getComplexityRating(recipe) {
  const stepCount = recipe?.steps?.length || 0;
  if (stepCount <= 4) {
    return "Easy";
  }
  if (stepCount <= 8) {
    return "Medium";
  }
  return "Advanced";
}

function isHealthyRecipe(recipe) {
  const category = normalizeText(recipe.category);
  const tags = (recipe.tags || []).map(normalizeText);
  const keywords = ["healthy", "health", "healthified", "wellness"];
  return keywords.some(
    (keyword) => category.includes(keyword) || tags.some((tag) => tag.includes(keyword))
  );
}

const TAG_COLORS = [
  "tag-color-rose",
  "tag-color-peach",
  "tag-color-mint",
  "tag-color-sky",
  "tag-color-lemon",
  "tag-color-lilac",
];

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function getTagColorClass(tag) {
  const index = hashString(tag.toLowerCase()) % TAG_COLORS.length;
  return TAG_COLORS[index];
}

const MEASUREMENT_STORAGE_KEY = "recipe-site-measurement-v2";
const MEASUREMENT_SYSTEMS = {
  us: { label: "US", cupMl: 236.588, tbspMl: 14.7868, tspMl: 5 },
  au: { label: "AU/UK", cupMl: 250, tbspMl: 20, tspMl: 5 },
};
const MEASUREMENT_BASE = "au";
const WEIGHT_GRAMS = { g: 1, kg: 1000, oz: 28.3495, lb: 453.592 };

function loadMeasurementSystem() {
  try {
    const stored = localStorage.getItem(MEASUREMENT_STORAGE_KEY);
    return stored && MEASUREMENT_SYSTEMS[stored] ? stored : MEASUREMENT_BASE;
  } catch (error) {
    return MEASUREMENT_BASE;
  }
}

function saveMeasurementSystem(value) {
  try {
    localStorage.setItem(MEASUREMENT_STORAGE_KEY, value);
  } catch (error) {
    console.error(error);
  }
}

function buildIngredientGroups(ingredients) {
  const groups = [];
  let current = { title: "Main", items: [] };

  (ingredients || []).forEach((item) => {
    const trimmed = String(item || "").trim();
    if (!trimmed) {
      return;
    }

    if (trimmed.endsWith(":")) {
      if (current.items.length) {
        groups.push(current);
      }
      current = { title: trimmed.slice(0, -1).trim() || "Component", items: [] };
      return;
    }

    current.items.push(trimmed);
  });

  if (current.items.length) {
    groups.push(current);
  }

  return groups;
}

function populateQuickLinks(recipes) {
  if (!quickLinkCards?.length) {
    return;
  }

  quickLinkCards.forEach((card) => {
    const key = card.dataset.quickLink || "";
    const series = card.dataset.series || "";
    const image = card.querySelector(".quick-link-image");

    if (!image) {
      return;
    }

    let recipe = null;
    if (key === "healthy") {
      recipe =
        findRecipe(recipes, (entry) =>
          normalizeText(entry.title).includes("chicken crust")
        ) || findRecipe(recipes, (entry) => isHealthyRecipe(entry));
    } else if (key === "meal-prep") {
      recipe = findRecipe(recipes, (entry) => {
        const combined = [entry.title, ...(entry.tags || [])].join(" ");
        return normalizeText(combined).includes("meal prep");
      });
    } else if (key === "dessert") {
      recipe = findRecipe(recipes, (entry) =>
        normalizeText(entry.category).includes("dessert")
      );
    } else if (key === "asian") {
      recipe =
        findRecipe(recipes, (entry) => {
          const title = normalizeText(entry.title);
          const id = normalizeText(entry.id);
          return title.includes("miso edamame risoni") || id.includes("miso-edamame-risoni");
        }) ||
        findRecipe(recipes, (entry) => {
          const combined = [entry.title, entry.category, ...(entry.tags || [])].join(" ");
          const normalized = normalizeText(combined);
          return (
            normalized.includes("miso") ||
            normalized.includes("edamame") ||
            normalized.includes("risoni")
          );
        }) ||
        findRecipe(recipes, (entry) => {
          const combined = [entry.title, entry.category, ...(entry.tags || [])].join(" ");
          return normalizeText(combined).includes("asian");
        });
    } else if (key === "breakfast") {
      recipe = findRecipe(recipes, (entry) =>
        normalizeText(entry.category).includes("breakfast")
      );
    } else if (key === "dinner") {
      recipe =
        findRecipe(recipes, (entry) => {
          const title = normalizeText(entry.title);
          const id = normalizeText(entry.id);
          return title.includes("sheet pan chicken") || id.includes("sheet-pan-chicken");
        }) ||
        findRecipe(recipes, (entry) =>
          normalizeText(entry.category).includes("dinner")
        );
    } else if (key === "budget") {
      recipe = findRecipe(recipes, (entry) =>
        normalizeText(`${entry.title} ${(entry.tags || []).join(" ")}`).includes("budget")
      );
    } else {
      recipe = findRecipe(recipes, () => true);
    }

    if (!recipe || !recipe.image) {
      card.style.display = "none";
      return;
    }

    image.src = recipe.image;
    image.alt = recipe.title || "Recipe preview";
    if (series) {
      card.href = `./recipe-library.html?series=${encodeURIComponent(series)}`;
    }
  });
}

function renderFeaturedRecipe(recipes) {
  if (!featuredRecipeCard) {
    return;
  }
  const featuredId = featuredRecipeCard.dataset.featuredRecipe;
  if (!featuredId) {
    return;
  }
  const recipe = recipes.find((entry) => entry.id === featuredId);
  if (!recipe) {
    return;
  }

  if (featuredRecipeTitle && recipe.title) {
    featuredRecipeTitle.textContent = recipe.title;
  }
  if (featuredRecipeDescription && recipe.description) {
    featuredRecipeDescription.textContent = recipe.description;
  }
  if (featuredRecipeImage) {
    if (recipe.image) {
      featuredRecipeImage.src = recipe.image;
      featuredRecipeImage.alt = recipe.title || "Recipe image";
    } else {
      featuredRecipeImage.removeAttribute("src");
      featuredRecipeImage.alt = recipe.title ? `${recipe.title} recipe` : "Recipe image";
    }
  }
  const recipeHref = `./recipe-library.html?recipe=${encodeURIComponent(recipe.id)}`;
  if (featuredRecipeImageLink) {
    featuredRecipeImageLink.href = recipeHref;
    featuredRecipeImageLink.setAttribute(
      "aria-label",
      `Open ${recipe.title || "recipe"}`
    );
  }
  if (featuredRecipeLink) {
    featuredRecipeLink.href = recipeHref;
  }
}

function getCategoryOrder(recipes) {
  const seen = new Set();
  const order = [];
  (recipes || []).forEach((recipe) => {
    const category = recipe?.category?.trim();
    if (!category || seen.has(category)) {
      return;
    }
    seen.add(category);
    order.push(category);
  });
  const preferredOrder = ["Dinner", "Baking", "Sides", "Dessert"];
  return order.sort((a, b) => {
    const aIndex = preferredOrder.findIndex((item) => normalizeText(item) === normalizeText(a));
    const bIndex = preferredOrder.findIndex((item) => normalizeText(item) === normalizeText(b));
    if (aIndex !== -1 || bIndex !== -1) {
      return (aIndex === -1 ? preferredOrder.length : aIndex) -
        (bIndex === -1 ? preferredOrder.length : bIndex);
    }
    return a.localeCompare(b);
  });
}

const CATEGORY_PRESENTATION = {
  dinner: {
    icon: "utensils",
    description: "Weeknight favourites and dishes worth gathering around.",
  },
  baking: {
    icon: "wheat",
    description: "Oven-ready comfort, from breakfast bakes to treats.",
  },
  sides: {
    icon: "salad",
    description: "Bright extras and small plates that steal the table.",
  },
  dessert: {
    icon: "cake-slice",
    description: "Sweet finishes, cosy bakes and little rewards.",
  },
};

function getCategoryPresentation(category) {
  return (
    CATEGORY_PRESENTATION[normalizeText(category)] || {
      icon: "chef-hat",
      description: "A collection of Siena's recipes to explore.",
    }
  );
}

function makeRecipeCardInteractive(card, recipe) {
  if (!card) {
    return;
  }
  const handleOpen = () => {
    window.location.href = `./recipe-library.html?recipe=${encodeURIComponent(recipe.id)}`;
  };
  card.setAttribute("role", "link");
  card.setAttribute("tabindex", "0");
  card.setAttribute("aria-label", `Open ${recipe.title || "recipe"}`);
  card.addEventListener("click", handleOpen);
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleOpen();
    }
  });
}

function buildRecipeCard(recipe) {
  if (!recipeCardTemplate) {
    return null;
  }
  const fragment = recipeCardTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".recipe-card");
  const image = fragment.querySelector(".recipe-image");
  const title = fragment.querySelector(".recipe-title");
  const category = fragment.querySelector(".recipe-card-category");

  if (image) {
    image.src = recipe.image || "";
    image.alt = recipe.title || "Recipe image";
  }
  if (title) {
    title.textContent = recipe.title || "Untitled recipe";
  }
  if (category) {
    category.textContent = recipe.category || "Recipe";
  }

  makeRecipeCardInteractive(card, recipe);

  return fragment;
}

function updateRecipeRail(railBlock) {
  const rail = railBlock?.querySelector(".recipe-grid");
  if (!rail) {
    return;
  }
  const maxScroll = Math.max(0, rail.scrollWidth - rail.clientWidth);
  const position = maxScroll ? Math.min(1, Math.max(0, rail.scrollLeft / maxScroll)) : 0;
  const buttons = railBlock.querySelectorAll("[data-rail-direction]");
  buttons.forEach((button) => {
    const direction = Number(button.dataset.railDirection || 0);
    button.disabled = direction < 0 ? rail.scrollLeft <= 2 : rail.scrollLeft >= maxScroll - 2;
  });

  const progress = railBlock.querySelector(".rail-progress");
  const thumb = progress?.querySelector(".rail-progress-thumb");
  if (progress && thumb) {
    const visibleRatio = rail.scrollWidth ? Math.min(1, rail.clientWidth / rail.scrollWidth) : 1;
    const thumbWidth = Math.max(18, visibleRatio * 100);
    thumb.style.width = `${thumbWidth}%`;
    thumb.style.left = `${position * (100 - thumbWidth)}%`;
    progress.setAttribute("aria-valuenow", String(Math.round(position * 100)));
    progress.classList.toggle("is-complete", maxScroll === 0);
  }
}

function initializeRecipeRails(root = document) {
  root.querySelectorAll("[data-recipe-rail]").forEach((railBlock) => {
    const rail = railBlock.querySelector(".recipe-grid");
    if (!rail) {
      return;
    }
    if (rail.dataset.railReady !== "true") {
      rail.dataset.railReady = "true";
      rail.addEventListener("scroll", () => updateRecipeRail(railBlock), { passive: true });
      railBlock.querySelectorAll("[data-rail-direction]").forEach((button) => {
        button.addEventListener("click", () => {
          const direction = Number(button.dataset.railDirection || 0);
          const firstCard = rail.querySelector(".recipe-card");
          const cardWidth = firstCard?.getBoundingClientRect().width || 240;
          const distance = Math.max(cardWidth + 16, rail.clientWidth * 0.72);
          rail.scrollBy({ left: direction * distance, behavior: "smooth" });
        });
      });
    }
    updateRecipeRail(railBlock);
  });
}

function renderCategoryRows(recipes) {
  if (!categoryRows) {
    return;
  }
  categoryRows.innerHTML = "";
  const categories = getCategoryOrder(recipes);
  if (!categories.length) {
    return;
  }
  if (!categories.some((category) => normalizeText(category) === normalizeText(activeHomeCategory))) {
    activeHomeCategory = categories[0];
  }

  const picker = document.createElement("div");
  picker.className = "category-picker";
  picker.setAttribute("aria-label", "Recipe categories");

  categories.forEach((category) => {
    const categoryRecipes = recipes.filter(
      (recipe) => normalizeText(recipe.category) === normalizeText(category)
    );
    const coverRecipe = categoryRecipes.find(recipeHasImage) || categoryRecipes[0];
    const presentation = getCategoryPresentation(category);
    const isActive = normalizeText(category) === normalizeText(activeHomeCategory);
    const button = document.createElement("button");
    button.className = `category-choice${isActive ? " is-active" : ""}`;
    button.type = "button";
    button.setAttribute("aria-pressed", String(isActive));
    button.innerHTML = `
      <span class="category-choice-media">
        ${
          coverRecipe?.image
            ? `<img src="${escapeHtml(coverRecipe.image)}" alt="" loading="lazy" />`
            : '<span class="category-choice-placeholder" aria-hidden="true"></span>'
        }
      </span>
      <span class="category-choice-body">
        <span class="category-choice-icon" aria-hidden="true"><i data-lucide="${presentation.icon}"></i></span>
        <span class="category-choice-copy">
          <strong>${escapeHtml(category)}</strong>
          <small>${categoryRecipes.length} ${categoryRecipes.length === 1 ? "recipe" : "recipes"}</small>
        </span>
        <span class="category-choice-arrow" aria-hidden="true">&#8594;</span>
      </span>
    `;
    button.addEventListener("click", () => {
      activeHomeCategory = category;
      renderCategoryRows(recipes);
      refreshIcons();
    });
    picker.append(button);
  });

  const selectedRecipes = recipes.filter(
    (recipe) => normalizeText(recipe.category) === normalizeText(activeHomeCategory)
  );
  const selectedPresentation = getCategoryPresentation(activeHomeCategory);
  const selection = document.createElement("section");
  selection.className = "category-selection";
  selection.dataset.recipeRail = "";
  selection.innerHTML = `
    <div class="category-selection-heading">
      <div>
        <p class="section-kicker">Selected collection</p>
        <h3>${escapeHtml(activeHomeCategory)}</h3>
        <p>${escapeHtml(selectedPresentation.description)}</p>
      </div>
      <div class="rail-controls" aria-label="More ${escapeHtml(activeHomeCategory)} recipes">
        <button class="rail-control" type="button" data-rail-direction="-1" aria-label="Previous ${escapeHtml(activeHomeCategory)} recipes">
          <i data-lucide="chevron-left" aria-hidden="true"></i>
        </button>
        <button class="rail-control" type="button" data-rail-direction="1" aria-label="Next ${escapeHtml(activeHomeCategory)} recipes">
          <i data-lucide="chevron-right" aria-hidden="true"></i>
        </button>
      </div>
    </div>
    <div class="recipe-rail-viewport">
      <div class="recipe-grid category-recipe-grid"></div>
    </div>
    <div class="rail-progress" role="progressbar" aria-label="${escapeHtml(activeHomeCategory)} recipe list position" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
      <span class="rail-progress-thumb"></span>
    </div>
  `;
  const grid = selection.querySelector(".category-recipe-grid");
  selectedRecipes.forEach((recipe) => {
    const card = buildRecipeCard(recipe);
    if (card) {
      grid.append(card);
    }
  });

  categoryRows.append(picker, selection);
  requestAnimationFrame(() => initializeRecipeRails(categoryRows));
}

const UNIT_ALIASES = new Map(
  Object.entries({
    tsp: "tsp",
    "tsp.": "tsp",
    teaspoon: "tsp",
    teaspoons: "tsp",
    tbsp: "tbsp",
    "tbsp.": "tbsp",
    tablespoon: "tbsp",
    tablespoons: "tbsp",
    cup: "cup",
    cups: "cup",
    c: "cup",
    "c.": "cup",
    ml: "ml",
    milliliter: "ml",
    milliliters: "ml",
    millilitre: "ml",
    millilitres: "ml",
    l: "l",
    liter: "l",
    liters: "l",
    litre: "l",
    litres: "l",
    g: "g",
    gram: "g",
    grams: "g",
    kg: "kg",
    kilogram: "kg",
    kilograms: "kg",
    mg: "mg",
    oz: "oz",
    ounce: "oz",
    ounces: "oz",
    lb: "lb",
    lbs: "lb",
    pound: "lb",
    pounds: "lb",
    pinch: "pinch",
    pinches: "pinch",
    dash: "dash",
    dashes: "dash",
    clove: "clove",
    cloves: "clove",
    slice: "slice",
    slices: "slice",
    can: "can",
    cans: "can",
    packet: "packet",
    packets: "packet",
    pack: "pack",
    packs: "pack",
    bunch: "bunch",
    bunches: "bunch",
    piece: "piece",
    pieces: "piece",
    stalk: "stalk",
    stalks: "stalk",
    stick: "stick",
    sticks: "stick",
    fillet: "fillet",
    fillets: "fillet",
    sheet: "sheet",
    sheets: "sheet",
    leaf: "leaf",
    leaves: "leaf",
  })
);

const UNIT_META = {
  tsp: { kind: "volume", toMl: 5 },
  tbsp: { kind: "volume", toMl: 20 },
  cup: { kind: "volume", toMl: 250 },
  ml: { kind: "volume", toMl: 1, metric: true },
  l: { kind: "volume", toMl: 1000, metric: true },
  g: { kind: "weight", toG: 1 },
  kg: { kind: "weight", toG: 1000 },
  mg: { kind: "weight", toG: 0.001 },
  oz: { kind: "weight", toG: 28.3495 },
  lb: { kind: "weight", toG: 453.592 },
  pinch: { kind: "tiny" },
  dash: { kind: "tiny" },
  clove: { kind: "count" },
  slice: { kind: "count" },
  can: { kind: "count" },
  packet: { kind: "count" },
  pack: { kind: "count" },
  bunch: { kind: "count" },
  piece: { kind: "count" },
  stalk: { kind: "count" },
  stick: { kind: "count" },
  fillet: { kind: "count" },
  sheet: { kind: "count" },
  leaf: { kind: "count" },
};

const PANTRY_ALWAYS_DROP = [
  "salt",
  "pepper",
  "black pepper",
  "white pepper",
  "sea salt",
  "kosher salt",
  "baking soda",
  "bicarbonate",
  "bicarbonate of soda",
  "baking powder",
];

const SPICE_WORDS = [
  "cinnamon",
  "nutmeg",
  "paprika",
  "oregano",
  "thyme",
  "rosemary",
  "cumin",
  "coriander",
  "basil",
  "parsley",
  "chilli",
  "chili",
  "chilli flakes",
  "chili flakes",
  "garlic powder",
  "onion powder",
  "bay leaf",
  "bay leaves",
  "cardamom",
  "turmeric",
  "ginger",
  "allspice",
  "cloves",
  "stock powder",
  "bouillon",
  "vanilla",
];

const QUANTITY_IMPORTANT = [
  "flour",
  "sugar",
  "brown sugar",
  "caster sugar",
  "icing sugar",
  "rice",
  "pasta",
  "noodles",
  "oats",
  "breadcrumbs",
  "bread crumbs",
  "butter",
  "milk",
  "cream",
  "cheese",
  "yoghurt",
  "yogurt",
  "oil",
  "chicken",
  "beef",
  "pork",
  "fish",
  "salmon",
  "tuna",
  "egg",
  "eggs",
  "potato",
  "potatoes",
  "onion",
  "onions",
  "garlic",
  "tomato",
  "tomatoes",
];

const LIQUID_WORDS = [
  "water",
  "milk",
  "cream",
  "stock",
  "broth",
  "juice",
  "vinegar",
  "soy sauce",
  "fish sauce",
  "oil",
  "coconut milk",
  "coconut cream",
  "maple syrup",
  "honey",
  "lemon juice",
  "lime juice",
  "wine",
];

function normalizeFractionCharacters(value) {
  return String(value || "")
    .replace(/⅛/g, "1/8")
    .replace(/⅜/g, "3/8")
    .replace(/⅝/g, "5/8")
    .replace(/⅞/g, "7/8")
    .replace(/¼/g, "1/4")
    .replace(/½/g, "1/2")
    .replace(/¾/g, "3/4")
    .replace(/⅓/g, "1/3")
    .replace(/⅔/g, "2/3")
    .replace(/(\d)(\s*[1-3]\/[2-8])/g, "$1 $2");
}

function parseFraction(value) {
  const [num, den] = value.split("/").map(Number);
  if (!den) {
    return NaN;
  }
  return num / den;
}

function parseQuantityToken(token) {
  const trimmed = token.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.includes("/")) {
    return parseFraction(trimmed);
  }
  const value = Number.parseFloat(trimmed);
  return Number.isNaN(value) ? null : value;
}

function parseInlineQuantity(value) {
  if (!value) {
    return NaN;
  }
  const normalized = normalizeFractionCharacters(value);
  if (normalized.includes(" ")) {
    const [whole, fraction] = normalized.split(/\s+/);
    return (parseQuantityToken(whole) || 0) + (parseQuantityToken(fraction) || 0);
  }
  return parseQuantityToken(normalized);
}

function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const temp = y;
    y = x % y;
    x = temp;
  }
  return x || 1;
}

function formatFractionAmount(amount) {
  if (!Number.isFinite(amount)) {
    return "";
  }
  const whole = Math.floor(amount + 1e-6);
  const remainder = amount - whole;
  if (remainder < 0.01) {
    return `${whole}`;
  }
  const denominators = [2, 3, 4, 8];
  let best = { diff: Infinity, num: 0, den: 1 };
  denominators.forEach((den) => {
    const num = Math.round(remainder * den);
    const diff = Math.abs(remainder - num / den);
    if (diff < best.diff) {
      best = { diff, num, den };
    }
  });
  let carry = whole;
  let num = best.num;
  let den = best.den;
  if (num >= den) {
    carry += 1;
    num = 0;
  }
  if (num === 0) {
    return `${carry}`;
  }
  const divisor = gcd(num, den);
  num /= divisor;
  den /= divisor;
  const fraction = `${num}/${den}`;
  return carry ? `${carry} ${fraction}` : fraction;
}

const MEASURE_REGEX =
  /(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)(?:\s*[-–]\s*(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?))?\s*(cups?|cup|tbsp|tablespoons?|tsp|teaspoons?|g|grams?|kg|kilograms?|oz|ounces?|lb|lbs|pounds?|ml|mL|liters?|litres?|l)\b/gi;

function normalizeMeasureUnit(unitToken) {
  const lower = unitToken.toLowerCase();
  if (lower.startsWith("cup")) {
    return "cup";
  }
  if (lower.startsWith("tbsp") || lower.startsWith("table")) {
    return "tbsp";
  }
  if (lower.startsWith("tsp") || lower.startsWith("tea")) {
    return "tsp";
  }
  if (lower.startsWith("kg")) {
    return "kg";
  }
  if (lower === "g" || lower.startsWith("gram")) {
    return "g";
  }
  if (lower === "oz" || lower.startsWith("ounce")) {
    return "oz";
  }
  if (lower === "lb" || lower === "lbs" || lower.startsWith("pound")) {
    return "lb";
  }
  if (lower === "ml" || lower === "mL") {
    return "ml";
  }
  if (lower === "l" || lower.startsWith("liter") || lower.startsWith("litre")) {
    return "l";
  }
  return lower;
}

function isWeightUnit(unit) {
  return unit === "g" || unit === "kg" || unit === "oz" || unit === "lb";
}

function unitToGrams(unit) {
  return WEIGHT_GRAMS[unit] || null;
}

function convertWeight(value, unit, toSystem) {
  const gramsPerUnit = unitToGrams(unit);
  if (!gramsPerUnit) {
    return { value, unit };
  }
  const grams = value * gramsPerUnit;
  if (!Number.isFinite(grams)) {
    return { value, unit };
  }
  if (toSystem === "us") {
    const unitOut = grams >= WEIGHT_GRAMS.lb ? "lb" : "oz";
    return { value: grams / WEIGHT_GRAMS[unitOut], unit: unitOut };
  }
  if (toSystem === "au") {
    const unitOut = grams >= 1000 ? "kg" : "g";
    return { value: grams / WEIGHT_GRAMS[unitOut], unit: unitOut };
  }
  return { value, unit };
}

function convertMeasure(value, unit, fromSystem, toSystem) {
  if (fromSystem === toSystem) {
    return { value, unit };
  }
  const from = MEASUREMENT_SYSTEMS[fromSystem];
  const to = MEASUREMENT_SYSTEMS[toSystem];
  if (!from || !to) {
    return { value, unit };
  }
  if (unit === "cup") {
    return { value: (value * from.cupMl) / to.cupMl, unit };
  }
  if (unit === "tbsp") {
    return { value: (value * from.tbspMl) / to.tbspMl, unit };
  }
  if (unit === "tsp") {
    return { value: (value * from.tspMl) / to.tspMl, unit };
  }
  if (isWeightUnit(unit)) {
    return convertWeight(value, unit, toSystem);
  }
  return { value, unit };
}

function formatMeasureAmount(value, unit) {
  if (unit === "cup" || unit === "tbsp" || unit === "tsp") {
    return formatFractionAmount(value);
  }
  if (unit === "oz" || unit === "lb") {
    return formatNumber(value, value >= 10 ? 1 : 2);
  }
  return formatNumber(value, value >= 10 ? 1 : 2);
}

function formatMeasureLabel(unit, value) {
  if (unit === "cup") {
    return value > 1.01 ? "cups" : "cup";
  }
  if (unit === "tbsp") {
    return "tbsp";
  }
  if (unit === "tsp") {
    return "tsp";
  }
  if (unit === "lb") {
    return value > 1.01 ? "lb" : "lb";
  }
  if (unit === "oz") {
    return "oz";
  }
  if (unit === "kg") {
    return "kg";
  }
  if (unit === "g") {
    return "g";
  }
  if (unit === "ml") {
    return "ml";
  }
  if (unit === "l") {
    return "l";
  }
  return unit;
}

function convertMeasurementText(text, fromSystem, toSystem) {
  if (!text) {
    return text;
  }
  return text.replace(MEASURE_REGEX, (match, startValue, endValue, unitToken) => {
    const unit = normalizeMeasureUnit(unitToken);
    const start = parseInlineQuantity(startValue);
    if (!Number.isFinite(start)) {
      return match;
    }
    if (isWeightUnit(unit)) {
      if (endValue) {
        const end = parseInlineQuantity(endValue);
        if (!Number.isFinite(end)) {
          return match;
        }
        const startGrams = start * (unitToGrams(unit) || 1);
        const endGrams = end * (unitToGrams(unit) || 1);
        const maxGrams = Math.max(startGrams, endGrams);
        const targetUnit =
          toSystem === "us"
            ? maxGrams >= WEIGHT_GRAMS.lb
              ? "lb"
              : "oz"
            : maxGrams >= 1000
              ? "kg"
              : "g";
        const convertedStart = startGrams / WEIGHT_GRAMS[targetUnit];
        const convertedEnd = endGrams / WEIGHT_GRAMS[targetUnit];
        const label = formatMeasureLabel(targetUnit, Math.max(convertedStart, convertedEnd));
        return `${formatMeasureAmount(convertedStart, targetUnit)}-${formatMeasureAmount(
          convertedEnd,
          targetUnit
        )} ${label}`;
      }
      const converted = convertWeight(start, unit, toSystem);
      const label = formatMeasureLabel(converted.unit, converted.value);
      return `${formatMeasureAmount(converted.value, converted.unit)} ${label}`;
    }
    const convertedStart = convertMeasure(start, unit, fromSystem, toSystem);
    if (endValue) {
      const end = parseInlineQuantity(endValue);
      if (!Number.isFinite(end)) {
        return match;
      }
      const convertedEnd = convertMeasure(end, unit, fromSystem, toSystem);
      const label = formatMeasureLabel(
        convertedStart.unit,
        Math.max(convertedStart.value, convertedEnd.value)
      );
      return `${formatMeasureAmount(convertedStart.value, convertedStart.unit)}-${formatMeasureAmount(
        convertedEnd.value,
        convertedStart.unit
      )} ${label}`;
    }
    const label = formatMeasureLabel(convertedStart.unit, convertedStart.value);
    return `${formatMeasureAmount(convertedStart.value, convertedStart.unit)} ${label}`;
  });
}

function applyMeasurementSystem(recipe) {
  if (!recipe) {
    return recipe;
  }
  return {
    ...recipe,
    ingredients: (recipe.ingredients || []).map((item) =>
      convertMeasurementText(item, MEASUREMENT_BASE, measurementSystem)
    ),
    steps: (recipe.steps || []).map((step) => {
      const converted = convertMeasurementText(
        getStepText(step),
        MEASUREMENT_BASE,
        measurementSystem
      );
      if (step && typeof step === "object") {
        return { ...step, text: converted };
      }
      return converted;
    }),
    notes: recipe.notes
      ? convertMeasurementText(recipe.notes, MEASUREMENT_BASE, measurementSystem)
      : recipe.notes,
  };
}

function handleMeasurementToggle(event) {
  const button = event.target.closest(".measure-option, .measure-toggle-button");
  if (!button) {
    return;
  }
  const next = button.dataset.measure;
  if (!next || next === measurementSystem || !MEASUREMENT_SYSTEMS[next]) {
    return;
  }
  const previous = measurementSystem;
  measurementSystem = next;
  saveMeasurementSystem(next);

  if (button.classList.contains("measure-toggle-button")) {
    button.classList.remove("is-us", "is-au");
    button.classList.add(`is-${next}`);
    button.dataset.measure = previous;
    button.setAttribute(
      "aria-label",
      `Switch to ${MEASUREMENT_SYSTEMS[previous]?.label || "US"} measurements`
    );
  }

  const selected = getSelectedRecipe(filteredRecipes);
  setTimeout(() => {
    renderRecipeView(selected, { view: recipeViewMode });
    if (cookOverlay?.classList.contains("is-open")) {
      renderCookOverlay(selected);
    }
  }, 180);
}

function parseLeadingQuantity(text) {
  const normalized = normalizeFractionCharacters(text);
  const rangeMatch = normalized.match(
    /^(\d+(?:\.\d+)?)(?:\s*[-–]\s*(\d+(?:\.\d+)?))(?=\s|$)/
  );
  if (rangeMatch) {
    return {
      amount: Number.parseFloat(rangeMatch[2]),
      raw: rangeMatch[0],
      rest: normalized.slice(rangeMatch[0].length).trim(),
    };
  }
  const match = normalized.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)(?=\s|$)/);
  if (!match) {
    return { amount: null, raw: null, rest: normalized.trim() };
  }
  const chunk = match[1];
  let amount = null;
  if (chunk.includes(" ")) {
    const [whole, fraction] = chunk.split(/\s+/);
    amount = parseQuantityToken(whole) + parseQuantityToken(fraction);
  } else {
    amount = parseQuantityToken(chunk);
  }
  return { amount, raw: chunk, rest: normalized.slice(match[0].length).trim() };
}

function normalizeUnitToken(token) {
  return token.toLowerCase().replace(/[.,]/g, "");
}

function parseIngredientLine(raw) {
  let working = normalizeFractionCharacters(String(raw || "")).trim();
  if (!working) {
    return null;
  }
  working = working.replace(/^[•*\-–—]\s*/, "");

  let amount = null;
  let unit = null;
  let amountText = null;

  const compactMatch = working.match(/^(\d+(?:\.\d+)?)([a-zA-Z]+)(?=\s|$)/);
  if (compactMatch) {
    const unitToken = normalizeUnitToken(compactMatch[2]);
    if (UNIT_ALIASES.has(unitToken)) {
      amount = Number.parseFloat(compactMatch[1]);
      unit = UNIT_ALIASES.get(unitToken);
      amountText = compactMatch[1];
      working = working.slice(compactMatch[0].length).trim();
    }
  }

  if (amount === null) {
    const parsed = parseLeadingQuantity(working);
    amount = parsed.amount;
    amountText = parsed.raw;
    working = parsed.rest;
  }

  const tokens = working.split(/\s+/);
  let startIndex = 0;
  if (amount !== null && tokens.length) {
    let candidate = normalizeUnitToken(tokens[0]);
    if (candidate === "x" && tokens[1]) {
      startIndex = 1;
      candidate = normalizeUnitToken(tokens[1]);
    }
    if (UNIT_ALIASES.has(candidate)) {
      unit = UNIT_ALIASES.get(candidate);
      startIndex += 1;
      working = tokens.slice(startIndex).join(" ");
    }
  }

  let name = working.replace(/^of\s+/i, "").trim();
  name = name.replace(/\s*\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  name = name.replace(/\s*,?\s*to taste$/i, "").trim();
  name = name.replace(/\s*,?\s*for serving$/i, "").trim();

  return {
    amount: amount !== null && !Number.isNaN(amount) ? amount : null,
    amountText,
    unit,
    name,
  };
}

function normalizeGroceryKey(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(
      /\b(chopped|minced|diced|sliced|ground|fresh|dried|softened|melted|packed|room|temperature|optional|for|to|taste|plus|extra)\b/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

function includesKeyword(name, keywords) {
  const lower = ` ${normalizeGroceryKey(name)} `;
  return keywords.some((keyword) => lower.includes(` ${keyword} `) || lower.includes(keyword));
}

function isLiquidIngredient(name) {
  return includesKeyword(name, LIQUID_WORDS);
}

function shouldDropQuantity(entry, name) {
  if (!entry.hasAmount) {
    return false;
  }
  if (includesKeyword(name, PANTRY_ALWAYS_DROP)) {
    return true;
  }
  if (includesKeyword(name, QUANTITY_IMPORTANT)) {
    return false;
  }

  if (entry.hasTinyUnit) {
    return true;
  }

  const smallVolume = entry.volumeMl > 0 && entry.volumeMl <= 15;
  const smallWeight = entry.weightG > 0 && entry.weightG <= 10;
  const smallCount = entry.count > 0 && entry.count <= 1;

  if (includesKeyword(name, SPICE_WORDS) && (smallVolume || smallWeight || smallCount)) {
    return true;
  }

  return false;
}

function formatNumber(value, decimals = 1) {
  return value
    .toFixed(decimals)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*[1-9])0+$/, "$1");
}

function formatWeight(grams) {
  if (grams >= 1000) {
    return `${formatNumber(grams / 1000, 2)} kg`;
  }
  return `${formatNumber(grams, grams >= 10 ? 0 : 1)} g`;
}

function formatWeightForSystem(grams, system) {
  if (system === "us") {
    const unit = grams >= WEIGHT_GRAMS.lb ? "lb" : "oz";
    const value = grams / WEIGHT_GRAMS[unit];
    return `${formatNumber(value, value >= 10 ? 1 : 2)} ${unit}`;
  }
  return formatWeight(grams);
}

function formatVolume(ml, name, preferMetric) {
  const useMetric = preferMetric || isLiquidIngredient(name);
  if (useMetric) {
    if (ml >= 1000) {
      return `${formatNumber(ml / 1000, 2)} l`;
    }
    return `${formatNumber(ml, ml >= 100 ? 0 : 1)} ml`;
  }

  if (includesKeyword(name, QUANTITY_IMPORTANT) && !isLiquidIngredient(name)) {
    const cups = ml / 240;
    const unitLabel = Math.abs(cups - 1) < 0.01 ? "cup" : "cups";
    return `${formatNumber(cups, 2)} ${unitLabel}`;
  }

  const tsp = ml / 4.92892;
  if (tsp >= 48) {
    const cups = tsp / 48;
    const unitLabel = Math.abs(cups - 1) < 0.01 ? "cup" : "cups";
    return `${formatNumber(cups, 2)} ${unitLabel}`;
  }
  if (tsp >= 3) {
    return `${formatNumber(tsp / 3, 2)} tbsp`;
  }
  return `${formatNumber(tsp, 2)} tsp`;
}

function formatVolumeFromMl(ml, system) {
  if (system !== "us") {
    if (ml >= 1000) {
      return `${formatNumber(ml / 1000, 2)} l`;
    }
    return `${formatNumber(ml, ml >= 100 ? 0 : 1)} ml`;
  }
  const cups = ml / MEASUREMENT_SYSTEMS.us.cupMl;
  if (cups >= 1) {
    return `${formatNumber(cups, 2)} ${Math.abs(cups - 1) < 0.01 ? "cup" : "cups"}`;
  }
  const tbsp = ml / MEASUREMENT_SYSTEMS.us.tbspMl;
  if (tbsp >= 1) {
    return `${formatNumber(tbsp, 2)} tbsp`;
  }
  const tsp = ml / MEASUREMENT_SYSTEMS.us.tspMl;
  return `${formatNumber(tsp, 2)} tsp`;
}

function formatVolumeUnit(amount, unit) {
  const value = formatNumber(amount, amount >= 10 ? 1 : 2);
  if (unit === "cup") {
    const label = amount > 1.01 ? "cups" : "cup";
    return `${value} ${label}`;
  }
  if (unit === "tbsp") {
    return `${value} tbsp`;
  }
  if (unit === "tsp") {
    return `${value} tsp`;
  }
  if (unit === "l") {
    return `${formatNumber(amount, 2)} l`;
  }
  if (unit === "ml") {
    return `${formatNumber(amount, amount >= 100 ? 0 : 1)} ml`;
  }
  return `${value} ${unit}`;
}

function formatCount(count) {
  return Number.isInteger(count) ? String(count) : formatNumber(count, 1);
}

function buildShoppingItems(groups, options = {}) {
  const system = options.system || measurementSystem || MEASUREMENT_BASE;
  const items = new Map();

  groups.forEach((group) => {
    group.items.forEach((item) => {
      const parsed = parseIngredientLine(item);
      if (!parsed || !parsed.name) {
        return;
      }

      const key = normalizeGroceryKey(parsed.name);
      if (!key) {
        return;
      }

      if (!items.has(key)) {
        items.set(key, {
          key,
          name: parsed.name,
          weightG: 0,
          volumeMl: 0,
          metricMl: 0,
          volumeUnits: {},
          count: 0,
          hasWeight: false,
          hasVolume: false,
          hasCount: false,
          hasAmount: false,
          hasTinyUnit: false,
          preferMetricVolume: false,
        });
      }

      const entry = items.get(key);
      if (entry && parsed.name.length < entry.name.length) {
        entry.name = parsed.name;
      }

      if (parsed.amount === null) {
        return;
      }

      if (!parsed.unit) {
        entry.count += parsed.amount;
        entry.hasCount = true;
        entry.hasAmount = true;
        return;
      }

      const unitMeta = UNIT_META[parsed.unit];
      if (!unitMeta) {
        return;
      }

      entry.hasAmount = true;

      if (unitMeta.kind === "weight") {
        entry.weightG += parsed.amount * unitMeta.toG;
        entry.hasWeight = true;
        return;
      }

      if (unitMeta.kind === "volume") {
        entry.volumeMl += parsed.amount * unitMeta.toMl;
        entry.hasVolume = true;
        if (!entry.volumeUnits[parsed.unit]) {
          entry.volumeUnits[parsed.unit] = { total: 0, raw: [] };
        }
        entry.volumeUnits[parsed.unit].total += parsed.amount;
        if (parsed.amountText) {
          entry.volumeUnits[parsed.unit].raw.push(parsed.amountText);
        }
        if (unitMeta.metric) {
          entry.metricMl += parsed.amount * unitMeta.toMl;
          entry.preferMetricVolume = true;
        }
        return;
      }

      if (unitMeta.kind === "count") {
        entry.count += parsed.amount;
        entry.hasCount = true;
        return;
      }

      if (unitMeta.kind === "tiny") {
        entry.hasTinyUnit = true;
      }
    });
  });

  const output = [];
  const volumeOrder = ["cup", "tbsp", "tsp", "l", "ml"];

  Array.from(items.values()).forEach((entry) => {
    const name = entry.name;
    if (shouldDropQuantity(entry, name)) {
      output.push(name);
      return;
    }
    if (entry.hasWeight && entry.weightG > 0) {
      output.push(`${formatWeightForSystem(entry.weightG, system)} ${name}`);
      return;
    }
    if (entry.hasVolume && Object.keys(entry.volumeUnits).length) {
      const units = Object.keys(entry.volumeUnits).sort(
        (a, b) => volumeOrder.indexOf(a) - volumeOrder.indexOf(b)
      );
      if (system === "us") {
        units
          .filter((unit) => ["cup", "tbsp", "tsp"].includes(unit))
          .forEach((unit) => {
            const unitData = entry.volumeUnits[unit];
            if (unitData.raw.length) {
              const pieces = unitData.raw.map((raw) => {
                const amount = parseInlineQuantity(raw);
                const label =
                  unit === "cup" && amount > 1.01 ? "cups" : unit === "cup" ? "cup" : unit;
                return `${raw} ${label}`;
              });
              output.push(`${pieces.join(" + ")} ${name}`);
              return;
            }
            output.push(`${formatVolumeUnit(unitData.total, unit)} ${name}`);
          });
        if (entry.metricMl > 0) {
          output.push(`${formatVolumeFromMl(entry.metricMl, system)} ${name}`);
        }
        return;
      }
      units.forEach((unit) => {
        const unitData = entry.volumeUnits[unit];
        if (["cup", "tbsp", "tsp"].includes(unit) && unitData.raw.length) {
          const pieces = unitData.raw.map((raw) => {
            const amount = parseInlineQuantity(raw);
            const label = unit === "cup" && amount > 1.01 ? "cups" : unit === "cup" ? "cup" : unit;
            return `${raw} ${label}`;
          });
          output.push(`${pieces.join(" + ")} ${name}`);
          return;
        }
        output.push(`${formatVolumeUnit(unitData.total, unit)} ${name}`);
      });
      return;
    }
    if (entry.hasCount && entry.count > 0) {
      output.push(`${formatCount(entry.count)} ${name}`);
      return;
    }
    output.push(name);
  });

  return output.filter(Boolean);
}

function buildIngredientOverviewMarkup(ingredients, options = {}) {
  const measureSystem = options.measureSystem || MEASUREMENT_BASE;
  const nextMeasureSystem = measureSystem === "us" ? "au" : "us";
  const nextMeasureLabel = MEASUREMENT_SYSTEMS[nextMeasureSystem]?.label || "AU/UK";
  const currentMeasureLabel = MEASUREMENT_SYSTEMS[measureSystem]?.label || "US";
  const groups = buildIngredientGroups(ingredients);
  const hasGroups = groups.length > 0;
  const showTitles =
    groups.length > 1 ||
    (groups[0] && normalizeText(groups[0].title) !== "main");

  const componentMarkup = hasGroups
    ? groups
        .map((group) => {
          const titleMarkup = showTitles ? `<h3>${escapeHtml(group.title)}</h3>` : "";
          const itemsMarkup = group.items
            .map((item) => `<li>${escapeHtml(item)}</li>`)
            .join("");
          return `
            <div class="ingredient-component">
              ${titleMarkup}
              <ul class="ingredient-list">${itemsMarkup}</ul>
            </div>
          `;
        })
        .join("")
    : '<div class="empty-state">No ingredients yet.</div>';

  const shoppingItems = buildShoppingItems(groups, { system: measureSystem });
  const shoppingMarkup = shoppingItems.length
    ? shoppingItems
        .map(
          (item) => `
            <label class="shopping-item">
              <input type="checkbox" />
              <span>${escapeHtml(item)}</span>
            </label>
          `
        )
        .join("")
    : '<div class="empty-state">No ingredients yet.</div>';

  return `
    <section class="sidebar-card notebook-card ingredient-overview">
      <div class="ingredient-heading">
        <div class="subsection-heading compact">
          <h2>Ingredients list</h2>
        </div>
        <button
          class="measure-toggle-button is-${measureSystem}"
          type="button"
          data-measure="${nextMeasureSystem}"
          aria-label="Switch to ${escapeHtml(nextMeasureLabel)} measurements"
        >
          <span class="measure-label">AU/UK</span>
          <span class="measure-label">US</span>
          <span class="measure-knob" aria-hidden="true"></span>
        </button>
      </div>
      <div class="ingredient-overview-body">
        <div class="ingredient-view is-active" data-view="components">
          ${componentMarkup}
        </div>
        <div class="ingredient-view" data-view="shopping">
          <div class="shopping-list">${shoppingMarkup}</div>
        </div>
      </div>
      <div class="ingredient-actions">
        <button
          class="ingredient-copy-button"
          type="button"
          data-action="copy-grocery"
          aria-label="Copy grocery list"
          title="Copy grocery list"
          hidden
        >
          <i data-lucide="clipboard"></i>
        </button>
        <button
          class="button button-ghost ingredient-toggle-button"
          type="button"
          data-action="toggle-ingredients"
          aria-pressed="false"
        >
          Convert to grocery list
        </button>
      </div>
    </section>
  `;
}

function normalizeIngredientForMatch(item) {
  return String(item || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[0-9]/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(
      /\b(cups?|cup|tbsp|tablespoons?|tsp|teaspoons?|g|kg|mg|ml|l|oz|lb|lbs|grams?|milliliters?|liters?|pinch|dash|clove|cloves|slice|slices|can|cans|packet|packets)\b/g,
      " "
    )
    .replace(
      /\b(large|small|medium|fresh|ground|chopped|minced|diced|sliced|softened|melted|packed|room|temperature|optional|for|to)\b/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

function ingredientMatchesStep(item, stepEntry) {
  const step = normalizeText(getStepText(stepEntry));
  return buildIngredientMatchTerms([item]).some((term) => {
    const pattern = term.split(" ").map(escapeRegExp).join("\\s+");
    return new RegExp(`(^|[^A-Za-z0-9_])${pattern}(?=$|[^A-Za-z0-9_])`, "i").test(step);
  });
}

function buildCookIngredients(ingredients, stepEntry) {
  const groups = buildIngredientGroups(ingredients);
  if (!groups.length) {
    return [];
  }

  const matchedGroups = groups
    .map((group) => ({
      title: group.title,
      items: group.items.filter((item) => ingredientMatchesStep(item, stepEntry)),
    }))
    .filter((group) => group.items.length);

  if (matchedGroups.length) {
    return matchedGroups;
  }

  return [];
}

function buildCookModeMarkup(recipe, stepIndex) {
  if (!recipe) {
    return '<div class="empty-state">No recipe selected.</div>';
  }
  const steps = recipe.steps || [];
  const totalSteps = steps.length;
  const safeIndex = totalSteps ? Math.min(Math.max(stepIndex, 0), totalSteps - 1) : 0;
  const stepEntry = steps[safeIndex];
  const stepText = getStepText(stepEntry) || "No steps added yet.";
  const stepMarkup = highlightIngredientMentions(stepText, recipe.ingredients || []);
  const stepIsCook = isCookStep(stepEntry);
  const ingredientGroups = buildCookIngredients(recipe.ingredients || [], stepEntry);
  const showGroupTitles =
    ingredientGroups.length > 1 ||
    (ingredientGroups[0] && normalizeText(ingredientGroups[0].title) !== "main");
  const ingredientMarkup = ingredientGroups.length
    ? ingredientGroups
        .map((group) => {
          const titleMarkup = showGroupTitles
            ? `<h3>${escapeHtml(group.title)}</h3>`
            : "";
          const itemsMarkup = group.items
            .map((item) => `<li>${escapeHtml(item)}</li>`)
            .join("");
          return `
            <div class="cook-ingredient-group">
              ${titleMarkup}
              <ul class="ingredient-list">${itemsMarkup}</ul>
            </div>
          `;
        })
        .join("")
    : '<div class="empty-state">No listed ingredients for this step.</div>';

  return `
    <section class="cook-mode">
      <div class="cook-mode__header">
        <p class="section-kicker">Let's cook</p>
        <div class="cook-mode__title-row">
          <strong>${escapeHtml(recipe.title)}</strong>
          ${totalSteps ? `<span>Step ${safeIndex + 1} of ${totalSteps}</span>` : ""}
        </div>
      </div>
      <div class="cook-mode__grid">
        <article class="cook-step-card notebook-card${stepIsCook ? " is-cook-step" : ""}">
          <div class="step-card-header">
            <div class="step-number">Step ${safeIndex + 1}</div>
            ${
              stepIsCook
                ? '<span class="step-cook-badge"><i data-lucide="flame"></i><span>Cook</span></span>'
                : ""
            }
          </div>
          <p>${stepMarkup}</p>
        </article>
        <aside class="cook-ingredients-card notebook-card">
          <div class="subsection-heading compact">
            <p class="section-kicker">Ingredients</p>
            <h2>For this step</h2>
          </div>
          ${ingredientMarkup}
        </aside>
      </div>
    </section>
  `;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const INGREDIENT_MATCH_STOP_WORDS = new Set([
  "about",
  "approximately",
  "and",
  "as",
  "at",
  "before",
  "each",
  "extra",
  "for",
  "from",
  "if",
  "in",
  "into",
  "more",
  "of",
  "on",
  "or",
  "over",
  "plus",
  "remove",
  "the",
  "then",
  "thinly",
  "to",
  "top",
  "under",
  "until",
  "with",
  "desired",
  "needed",
  "taste",
  "halved",
  "pitted",
  "sliced",
  "juiced",
  "minced",
  "diced",
  "chopped",
  "cubed",
  "softened",
  "melted",
  "packed",
  "room",
  "temperature",
  "freshly",
  "finely",
  "crosswise",
  "shows",
  "middle",
  "centre",
  "center",
  "seeds",
  "press",
  "pressed",
  "firmly",
  "topping",
  "toppings",
  "wedge",
  "wedges",
  "baking",
  "plain",
  "white",
  "brown",
  "red",
  "yellow",
  "low",
  "fat",
  "dried",
  "whole",
  "light",
  "lite",
  "cake",
  "coarse",
  "gala",
  "cherry",
  "grape",
  "tinned",
  "sodium",
  "italian",
]);

const INGREDIENT_SYNONYMS = [
  { source: ["spud", "spud lite"], aliases: ["potato", "potatoes"] },
  { source: ["courgette"], aliases: ["zucchini"] },
  { source: ["aubergine"], aliases: ["eggplant"] },
  { source: ["capsicum"], aliases: ["bell pepper"] },
  { source: ["coriander"], aliases: ["cilantro"] },
  { source: ["rocket"], aliases: ["arugula"] },
  { source: ["prawns"], aliases: ["shrimp"] },
  { source: ["beetroot"], aliases: ["beet", "beets"] },
  { source: ["spring onion", "spring onions"], aliases: ["green onion", "scallion"] },
  { source: ["icing sugar"], aliases: ["powdered sugar", "confectioners sugar"] },
  { source: ["caster sugar"], aliases: ["superfine sugar"] },
];

function addIngredientSynonymTerms(terms, normalized) {
  const sourceText = ` ${normalized} `;

  INGREDIENT_SYNONYMS.forEach(({ source, aliases }) => {
    if (!source.some((term) => sourceText.includes(` ${term} `))) {
      return;
    }
    aliases.forEach((alias) => terms.add(alias));
  });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function addIngredientMatchWord(terms, word) {
  if (word.length < 3 || INGREDIENT_MATCH_STOP_WORDS.has(word)) {
    return;
  }

  terms.add(word);
  if (word.endsWith("ies") && word.length > 4) {
    terms.add(`${word.slice(0, -3)}y`);
  }
}

function buildIngredientMatchTerms(ingredients) {
  const terms = new Set();

  (ingredients || []).forEach((item) => {
    const components = String(item || "")
      .replace(/\([^)]*\)/g, " ")
      .split(",");

    components.forEach((component) => {
      component
        .split(/\s+(?:and|or)\s+/i)
        .map((part) => normalizeIngredientForMatch(part))
        .forEach((normalized) => {
          const rawWords = normalized.split(" ").filter(Boolean);
          addIngredientSynonymTerms(terms, normalized);
          const words = normalized
            .split(" ")
            .filter((word) => word && !INGREDIENT_MATCH_STOP_WORDS.has(word));

          if (!rawWords.length || !words.length) {
            return;
          }

          if (rawWords.length > 1) {
            terms.add(rawWords.join(" "));
          }
          const ingredientName = words.join(" ");
          terms.add(ingredientName);
          words.forEach((word) => addIngredientMatchWord(terms, word));
        });
    });
  });

  return [...terms].sort((a, b) => b.length - a.length);
}

function highlightIngredientMentions(stepText, ingredients) {
  const text = String(stepText || "");
  const terms = buildIngredientMatchTerms(ingredients);
  if (!text || !terms.length) {
    return escapeHtml(text);
  }

  const pattern = terms
    .map((term) => term.split(" ").map(escapeRegExp).join("\\s+"))
    .join("|");
  const matcher = new RegExp(`(^|[^A-Za-z0-9_])(${pattern})(?=$|[^A-Za-z0-9_])`, "gi");
  let markup = "";
  let lastIndex = 0;

  text.replace(matcher, (match, prefix, ingredient, offset) => {
    const ingredientStart = offset + prefix.length;
    markup += escapeHtml(text.slice(lastIndex, ingredientStart));
    markup += `<strong class="ingredient-mention">${escapeHtml(ingredient)}</strong>`;
    lastIndex = ingredientStart + ingredient.length;
    return match;
  });

  return `${markup}${escapeHtml(text.slice(lastIndex))}`;
}

function buildFilters(recipes) {
  if (!categoryFilter) {
    return;
  }
  const categories = [...new Set(recipes.map((recipe) => recipe.category).filter(Boolean))].sort();
  categoryFilter.innerHTML = '<option value="all">All categories</option>';

  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categoryFilter.append(option);
  });
}

function recipeMatches(recipe, searchTerm, selectedCategory) {
  const haystack = normalizeText(
    [
      recipe.title,
      recipe.description,
      recipe.category,
      ...(recipe.tags || []),
      ...(recipe.ingredients || []),
    ]
      .filter(Boolean)
      .join(" ")
  );

  const categoryMatch = selectedCategory === "all" || recipe.category === selectedCategory;
  const searchMatch = !searchTerm || haystack.includes(searchTerm);
  return categoryMatch && searchMatch;
}

function getSelectedRecipe(recipes, options = {}) {
  const allowFallback = options.allowFallback !== false;
  const matched =
    selectedRecipeId && recipes.find((recipe) => recipe.id === selectedRecipeId);

  if (matched) {
    return matched;
  }

  if (!allowFallback) {
    return null;
  }

  return recipes[0] || allRecipes[0] || null;
}

function buildRecipeViewMarkup(recipe, options = {}) {
  if (!recipe) {
    return '<div class="empty-state">No recipe is available yet. Add one in admin mode.</div>';
  }

  const showCookButton = options.showCookButton !== false;
  const yieldLabel = getYieldLabel(recipe);
  const showNutrition = isHealthyRecipe(recipe);
  const ingredientOverviewMarkup = buildIngredientOverviewMarkup(recipe.ingredients || [], {
    measureSystem: measurementSystem,
  });

  const methodItems = (recipe.steps || [])
    .map((item, index) => {
      const stepText = getStepText(item);
      const stepMarkup = highlightIngredientMentions(stepText, recipe.ingredients || []);
      const stepIsCook = isCookStep(item);
      return `
        <article class="step-card notebook-card${stepIsCook ? " is-cook-step" : ""}">
          <div class="step-card-header">
            <div class="step-number">Step ${index + 1}</div>
            ${
              stepIsCook
                ? '<span class="step-cook-badge"><i data-lucide="flame"></i><span>Cook</span></span>'
                : ""
            }
          </div>
          <p>${stepMarkup}</p>
        </article>
      `;
    })
    .join("");
  const tagItems = (recipe.tags || [])
    .map(
      (tag) => `<span class="${getTagColorClass(tag)}">${escapeHtml(tag)}</span>`
    )
    .join("");

  const metaItems = [
    recipe.prepTime && { key: "prep", label: "Prep time", value: recipe.prepTime },
    recipe.serves && { key: "serves", label: yieldLabel, value: recipe.serves },
  ].filter(Boolean);

  const metaMarkup = metaItems.length
    ? metaItems
        .map(
          ({ label, value }) => `
            <div class="recipe-meta-item">
              <span>${escapeHtml(label)}:</span>
              <strong>${escapeHtml(value)}</strong>
            </div>
          `
        )
        .join("")
    : "";
  const nutritionEntries = showNutrition
    ? [
        ["Calories", recipe.nutrition?.calories],
        ["Protein", recipe.nutrition?.protein],
        ["Carbs", recipe.nutrition?.carbs],
        ["Fat", recipe.nutrition?.fat],
      ].filter(([, value]) => value)
    : [];
  const nutritionMarkup = nutritionEntries.length
    ? `
        <section class="sidebar-card notebook-card">
          <div class="subsection-heading compact">
            <p class="section-kicker">Nutrition</p>
            <h2>Per serve</h2>
          </div>
          <div class="info-stack nutrition-stack">
            ${nutritionEntries
              .map(
                ([label, value]) =>
                  `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`
              )
              .join("")}
          </div>
        </section>
      `
    : "";

  const cookButtonMarkup = showCookButton && recipe.cookTime
    ? `
        <button class="button button-ghost lets-cook-button" type="button" data-action="lets-cook">
          Let's cook
        </button>
      `
    : "";

  return `
    <article class="recipe-layout">
      <section class="recipe-main notebook-card">
        <div class="recipe-main-top">
          <a
            class="button button-ghost back-button recipe-back-button hero-action-right"
            href="./index.html"
          >
            Return to main page
          </a>
        </div>
        <div class="recipe-hero-stack">
          <div class="recipe-title-row">
            <h1 class="recipe-page-title">${escapeHtml(recipe.title)}</h1>
          </div>
          <div class="recipe-hero-media">
            <img
              class="recipe-hero-image"
              src="${escapeHtml(recipe.image || "")}"
              alt="${escapeHtml(recipe.title)}"
            />
            ${cookButtonMarkup}
            ${
              recipe.cookTime
                ? `<span class="recipe-hero-cook-time">Cook time: ${escapeHtml(recipe.cookTime)}</span>`
                : ""
            }
          </div>
          <div class="recipe-hero-details">
            <p class="recipe-category">${escapeHtml(recipe.category || "Recipe")}</p>
            <p class="recipe-page-description">${escapeHtml(recipe.description || "")}</p>
            ${metaMarkup ? `<div class="recipe-meta-grid">${metaMarkup}</div>` : ""}
            ${tagItems ? `<div class="tag-row">${tagItems}</div>` : ""}
          </div>
        </div>

        <section class="method-section">
          <div class="subsection-heading">
            <h2>Method</h2>
          </div>
          <div class="step-grid">${methodItems}</div>
        </section>
      </section>

      <aside class="recipe-sidebar">
        ${ingredientOverviewMarkup}
        ${nutritionMarkup}
      </aside>
    </article>
  `;
}

function buildRecipePreviewMarkup(recipe) {
  if (!recipe) {
    return "";
  }

  const ingredientGroups = buildIngredientGroups(recipe.ingredients || []);
  const ingredientMarkup = ingredientGroups.length
    ? ingredientGroups
        .map(
          (group) => `
            <div class="preview-ingredient-group">
              <p class="preview-ingredient-title">${escapeHtml(group.title)}</p>
              <ul class="ingredient-list">
                ${group.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
              </ul>
            </div>
          `
        )
        .join("")
    : `<p class="preview-note">Ingredients are coming soon for this recipe.</p>`;

  const complexity = getComplexityRating(recipe);
  const showNutrition = isHealthyRecipe(recipe);
  const nutritionEntries = [
    ["Calories", recipe.nutrition?.calories || "-"],
    ["Protein", recipe.nutrition?.protein || "-"],
    ["Carbs", recipe.nutrition?.carbs || "-"],
    ["Fat", recipe.nutrition?.fat || "-"],
  ];

  const nutritionMarkup = showNutrition
    ? `
        <div class="preview-macro-grid">
          ${nutritionEntries
            .map(
              ([label, value]) =>
                `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`
            )
            .join("")}
        </div>
      `
    : `<p class="preview-note">Macros show only for healthy recipes.</p>`;

  return `
    <article class="recipe-preview notebook-card" aria-live="polite">
      <div class="preview-titlebar">
        <div class="preview-title">
          <p class="recipe-category">${escapeHtml(recipe.category || "Recipe")}</p>
          <h2 class="preview-recipe-title">${escapeHtml(recipe.title || "")}</h2>
        </div>
        <div class="preview-controls">
          <button class="preview-control is-open" type="button" data-action="open-full" aria-label="Open full recipe">+</button>
          <button class="preview-control is-min" type="button" data-action="close-preview" aria-label="Hide preview">-</button>
          <button class="preview-control is-close" type="button" data-action="close-preview" aria-label="Close preview">x</button>
        </div>
      </div>
      <div class="preview-body">
        <section class="preview-ingredients">
          <div class="preview-image-wrap">
            ${
              recipe.image
                ? `<img class="preview-image" src="${escapeHtml(recipe.image)}" alt="${escapeHtml(recipe.title || "Recipe image")}" />`
                : `<div class="preview-image-placeholder">Image coming soon</div>`
            }
          </div>
          <h3>Ingredients</h3>
          ${ingredientMarkup}
        </section>
        <aside class="preview-meta">
          <div class="preview-chip">
            <span>Complexity</span>
            <strong>${escapeHtml(complexity)}</strong>
          </div>
          <div class="preview-macros">
            <p class="preview-subtitle">Macros</p>
            ${nutritionMarkup}
          </div>
        </aside>
      </div>
    </article>
  `;
}

function renderRecipeView(recipe, options = {}) {
  const target = options.target || recipeViewContainer;
  if (!target) {
    return;
  }
  const view = options.view || recipeViewMode || "preview";
  if (!recipe || view === "preview") {
    target.innerHTML = "";
    return;
  }
  const displayRecipe = applyMeasurementSystem(recipe);
  target.innerHTML = buildRecipeViewMarkup(displayRecipe, options);
  refreshIcons();
}

function updateQueryString(recipeId) {
  const url = new URL(window.location.href);
  if (recipeId) {
    url.searchParams.set("recipe", recipeId);
  } else {
    url.searchParams.delete("recipe");
  }
  window.history.replaceState({}, "", url);
}

function selectRecipe(recipeId, options = {}) {
  selectedRecipeId = recipeId;
  const selectedRecipe = getSelectedRecipe(filteredRecipes);
  if (options.view) {
    recipeViewMode = options.view;
  } else if (!recipeViewMode) {
    recipeViewMode = "preview";
  }
  updateQueryString(selectedRecipe?.id || "");
  renderRecipeView(selectedRecipe, { view: recipeViewMode });
  renderRecipes(filteredRecipes);
}

function renderRecipes(recipes) {
  recipeGrid.innerHTML = "";

  if (!recipes.length) {
    recipeGrid.innerHTML =
      '<div class="empty-state">No recipes match this search yet.</div>';
    return;
  }

  recipes.forEach((recipe) => {
    const fragment = recipeCardTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".recipe-card");
    const image = fragment.querySelector(".recipe-image");
    const category = fragment.querySelector(".recipe-card-category");
    const title = fragment.querySelector(".recipe-title");
    const description = fragment.querySelector(".recipe-description");
    const meta = fragment.querySelector(".recipe-meta");
    const button = fragment.querySelector("button");

    if (image) {
      image.src = recipe.image || "";
      image.alt = recipe.title;
    }
    if (category) {
      category.textContent = recipe.category || "Recipe";
    }
    if (title) {
      title.textContent = recipe.title;
    }
    if (description) {
      description.textContent = recipe.description || "";
    }

    const yieldLabel = getYieldLabel(recipe);

    if (meta) {
      [recipe.prepTime, recipe.cookTime, recipe.serves && `${yieldLabel} ${recipe.serves}`]
        .filter(Boolean)
        .forEach((item) => {
          const pill = document.createElement("span");
          pill.textContent = item;
          meta.append(pill);
        });
    }

    if (recipe.id === selectedRecipeId) {
      card.classList.add("is-active");
    }

    makeRecipeCardInteractive(card, recipe);

    recipeGrid.append(fragment);
  });
  requestAnimationFrame(() => initializeRecipeRails(document));
}

function getRecipeIndex(recipes, recipeId) {
  return recipes.findIndex((recipe) => recipe.id === recipeId);
}

function updateCookOverlayNav(recipe) {
  if (!cookPrevButton || !cookNextButton) {
    return;
  }
  const steps = recipe?.steps || [];
  const totalSteps = steps.length;
  cookPrevButton.disabled = cookStepIndex <= 0;
  cookNextButton.disabled = totalSteps === 0 || cookStepIndex >= totalSteps - 1;
}

function renderCookOverlay(recipe) {
  if (!cookOverlayContent) {
    return;
  }
  const displayRecipe = applyMeasurementSystem(recipe);
  cookOverlayContent.innerHTML = buildCookModeMarkup(displayRecipe, cookStepIndex);
  refreshIcons();
  updateCookOverlayNav(displayRecipe);
}

function openCookOverlay(recipeId) {
  if (!cookOverlay) {
    return;
  }

  if (recipeId) {
    selectRecipe(recipeId, { view: "full" });
  }

  cookStepIndex = 0;
  renderCookOverlay(getSelectedRecipe(filteredRecipes));
  cookOverlay.classList.add("is-open");
  cookOverlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("is-overlay-open");
}

function closeCookOverlay() {
  if (!cookOverlay) {
    return;
  }
  cookOverlay.classList.remove("is-open");
  cookOverlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("is-overlay-open");
}

function navigateCookStep(delta) {
  const recipe = getSelectedRecipe(filteredRecipes);
  if (!recipe) {
    return;
  }
  const totalSteps = recipe.steps?.length || 0;
  if (!totalSteps) {
    return;
  }
  const nextIndex = cookStepIndex + delta;
  if (nextIndex < 0 || nextIndex >= totalSteps) {
    return;
  }
  cookStepIndex = nextIndex;
  renderCookOverlay(recipe);
}

function handleIngredientTabs(event) {
  const tab = event.target.closest(".ingredient-tab");
  const toggleButton = event.target.closest(".ingredient-toggle-button");
  const copyButton = event.target.closest(".ingredient-copy-button");
  if (!tab && !toggleButton && !copyButton) {
    return;
  }
  const container = (tab || toggleButton || copyButton).closest(".ingredient-overview");
  if (!container) {
    return;
  }

  if (copyButton) {
    copyGroceryList(container);
    return;
  }

  if (tab) {
    const view = tab.dataset.view;
    container.querySelectorAll(".ingredient-tab").forEach((button) => {
      button.classList.toggle("is-active", button === tab);
    });
    container.querySelectorAll(".ingredient-view").forEach((panel) => {
      panel.classList.toggle("is-active", panel.dataset.view === view);
    });
    const isShoppingView = view === "shopping";
    container.classList.toggle("is-shopping", isShoppingView);
    const heading = container.querySelector(".subsection-heading h2");
    if (heading) {
      heading.textContent = isShoppingView ? "Grocery list" : "Ingredients list";
    }
    const copyToggle = container.querySelector(".ingredient-copy-button");
    if (copyToggle) {
      copyToggle.hidden = !isShoppingView;
    }
    return;
  }

  const views = Array.from(container.querySelectorAll(".ingredient-view"));
  const activeView = views.find((panel) => panel.classList.contains("is-active"));
  const nextView = views.find((panel) => panel !== activeView) || activeView;
  views.forEach((panel) => {
    panel.classList.toggle("is-active", panel === nextView);
  });
  const isShoppingView = nextView?.dataset.view === "shopping";
  container.classList.toggle("is-shopping", isShoppingView);
  const heading = container.querySelector(".subsection-heading h2");
  if (heading) {
    heading.textContent = isShoppingView ? "Grocery list" : "Ingredients list";
  }
  const copyToggle = container.querySelector(".ingredient-copy-button");
  if (copyToggle) {
    copyToggle.hidden = !isShoppingView;
  }
  if (toggleButton) {
    toggleButton.setAttribute("aria-pressed", String(isShoppingView));
    toggleButton.textContent = isShoppingView ? "Back to ingredients list" : "Convert to grocery list";
  }
}

function copyGroceryList(container) {
  const items = Array.from(container.querySelectorAll(".shopping-item span"))
    .map((node) => node.textContent.trim())
    .filter(Boolean);
  if (!items.length) {
    return;
  }
  const text = items.join("\n");
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch((error) => console.error(error));
  } else {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
  const copyButton = container.querySelector(".ingredient-copy-button");
  if (copyButton) {
    copyButton.classList.add("is-copied");
    setTimeout(() => copyButton.classList.remove("is-copied"), 1200);
  }
}

function handleCookActions(event) {
  const actionTarget = event.target.closest("[data-action]");
  if (!actionTarget) {
    return;
  }
  const action = actionTarget.dataset.action;

  if (action === "open-full") {
    recipeViewMode = "full";
    renderRecipeView(getSelectedRecipe(filteredRecipes), { view: "full" });
    document.getElementById("recipeView")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  if (action === "close-preview") {
    selectedRecipeId = null;
    recipeViewMode = "preview";
    updateQueryString("");
    renderRecipeView(null, { view: "preview" });
    renderRecipes(filteredRecipes);
    return;
  }
  if (action === "lets-cook") {
    openCookOverlay(selectedRecipeId);
  }
  if (action === "close-cook") {
    closeCookOverlay();
  }
  if (action === "cook-prev") {
    navigateCookStep(-1);
  }
  if (action === "cook-next") {
    navigateCookStep(1);
  }
}

function renderSearchOverlayResults() {
  if (!overlaySearchResults || !overlaySearchInput) {
    return;
  }

  const searchTerm = normalizeText(overlaySearchInput.value);
  overlaySearchResults.innerHTML = "";
  overlaySearchResults.classList.remove("is-latest", "is-matches");

  const buildResultCard = (recipe, onClick) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "search-overlay__result recipe-card notebook-card";

    const imageWrap = document.createElement("div");
    imageWrap.className = "recipe-image-wrap";
    if (recipe?.image) {
      const img = document.createElement("img");
      img.className = "recipe-image";
      img.loading = "lazy";
      img.src = recipe.image;
      img.alt = recipe.title || "Recipe";
      imageWrap.append(img);
    }

    const body = document.createElement("div");
    body.className = "recipe-card-body";
    const title = document.createElement("h3");
    title.className = "recipe-title";
    title.textContent = recipe?.title || "Untitled recipe";
    body.append(title);

    button.append(imageWrap, body);
    button.addEventListener("click", onClick);
    return button;
  };

  if (!searchTerm) {
    overlaySearchResults.classList.add("is-latest");
    const latestHeader = document.createElement("div");
    latestHeader.className = "search-overlay__section-title";
    latestHeader.textContent = "Latest";
    overlaySearchResults.append(latestHeader);

    const latestRecipes = [...allRecipes].slice(-10).reverse();
    if (!latestRecipes.length) {
      overlaySearchResults.innerHTML =
        '<div class="search-overlay__empty">No recipes yet.</div>';
      return;
    }

    latestRecipes.forEach((recipe) => {
      const button = buildResultCard(recipe, () => {
        window.location.href = `./recipe-library.html?recipe=${encodeURIComponent(recipe.id)}`;
      });
      overlaySearchResults.append(button);
    });
    return;
  }

  overlaySearchResults.classList.add("is-matches");

  const matches = allRecipes
    .filter((recipe) => recipeMatches(recipe, searchTerm, "all"))
    .slice(0, 10);

  if (!matches.length) {
    overlaySearchResults.innerHTML =
      '<div class="search-overlay__empty">No matches yet.</div>';
    return;
  }

  matches.forEach((recipe) => {
    const button = buildResultCard(recipe, () => {
      window.location.href = `./recipe-library.html?recipe=${encodeURIComponent(recipe.id)}`;
    });
    overlaySearchResults.append(button);
  });
}

function openSearchOverlay() {
  if (!searchOverlay || !overlaySearchInput) {
    return;
  }
  searchOverlay.classList.add("is-open");
  searchOverlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("is-overlay-open");
  overlaySearchInput.value = topSearchInput?.value || searchInput?.value || "";
  renderSearchOverlayResults();
  overlaySearchInput.focus();
}

function closeSearchOverlay() {
  if (!searchOverlay) {
    return;
  }
  searchOverlay.classList.remove("is-open");
  searchOverlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("is-overlay-open");
}

function handleSearchOverlayClick(event) {
  const closeTarget = event.target.closest("[data-action=\"close-search\"]");
  if (closeTarget) {
    closeSearchOverlay();
  }
}

function handleOverlayKeydown(event) {
  if (event.key !== "Escape") {
    return;
  }
  if (searchOverlay?.classList.contains("is-open")) {
    closeSearchOverlay();
    return;
  }
  if (cookOverlay?.classList.contains("is-open")) {
    closeCookOverlay();
  }
}

function applyFilters() {
  const searchTerm = normalizeText(searchInput?.value || "");
  const selectedCategory = categoryFilter?.value || "all";

  filteredRecipes = allRecipes.filter((recipe) =>
    recipeMatches(recipe, searchTerm, selectedCategory)
  );

  const selectedRecipe = getSelectedRecipe(filteredRecipes, {
    allowFallback: Boolean(selectedRecipeId),
  });
  if (selectedRecipe) {
    selectedRecipeId = selectedRecipe.id;
  } else {
    selectedRecipeId = null;
  }

  renderRecipeView(selectedRecipe, { view: recipeViewMode });
  renderRecipes(filteredRecipes);
}

async function init() {
  siteSettings = await loadSiteSettings();
  applySiteSettings(siteSettings);
  measurementSystem = loadMeasurementSystem();
  allRecipes = await loadRecipes();
  buildFilters(allRecipes);

  const params = new URLSearchParams(window.location.search);
  const searchParam = params.get("search");
  const categoryParam = params.get("category");
  selectedRecipeId = params.get("recipe") || null;
  recipeViewMode = selectedRecipeId ? "full" : "preview";
  filteredRecipes = [...allRecipes];

  if (searchParam) {
    if (searchInput) {
      searchInput.value = searchParam;
    }
  }

  if (topSearchInput) {
    topSearchInput.value = searchInput?.value || searchParam || "";
  }

  if (categoryParam) {
    if (categoryFilter) {
      const normalizedCategory = normalizeText(categoryParam);
      const match = Array.from(categoryFilter.options).find(
        (option) => normalizeText(option.value) === normalizedCategory
      );
      if (match) {
        categoryFilter.value = match.value;
      }
    }
  }

  applyFilters();
  renderFeaturedRecipe(allRecipes);
  renderCategoryRows(allRecipes);
  refreshIcons();

  const handleInlineSearchInput = () => {
    if (topSearchInput) {
      topSearchInput.value = searchInput?.value || "";
    }
    applyFilters();
  };

  if (searchInput) {
    searchInput.addEventListener("input", handleInlineSearchInput);
  }
  if (topSearchInput) {
    topSearchInput.setAttribute("readonly", "readonly");
    const openFromTopSearch = () => {
      openSearchOverlay();
    };
    topSearchInput.addEventListener("focus", openFromTopSearch);
    topSearchInput.addEventListener("click", openFromTopSearch);
  }
  if (categoryFilter) {
    categoryFilter.addEventListener("change", applyFilters);
  }
  document.addEventListener("click", handleIngredientTabs);
  document.addEventListener("click", handleMeasurementToggle);
  document.addEventListener("click", handleCookActions);
  document.addEventListener("keydown", handleOverlayKeydown);
  window.addEventListener("storage", handleStorageUpdate);
  window.addEventListener("resize", () => initializeRecipeRails(document));

  if (searchOverlay) {
    searchOverlay.addEventListener("click", handleSearchOverlayClick);
  }

  if (overlaySearchInput) {
    overlaySearchInput.addEventListener("input", renderSearchOverlayResults);
  }
}

init();

async function handleStorageUpdate(event) {
  if (!event || event.key !== PREVIEW_STORAGE_KEY) {
    return;
  }
  const currentSearch = searchInput?.value || "";
  const currentCategory = categoryFilter?.value || "all";
  const previewRecipes = loadPreviewRecipes();
  allRecipes = await loadRecipes();
  buildFilters(allRecipes);
  renderFeaturedRecipe(allRecipes);
  renderCategoryRows(allRecipes);
  if (searchInput) {
    searchInput.value = currentSearch;
  }
  if (topSearchInput) {
    topSearchInput.value = currentSearch;
  }
  if (categoryFilter) {
    const match = Array.from(categoryFilter.options).find(
      (option) => normalizeText(option.value) === normalizeText(currentCategory)
    );
    if (match) {
      categoryFilter.value = match.value;
    }
  }
  applyFilters();
  refreshIcons();
}
