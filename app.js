const PREVIEW_STORAGE_KEY = "recipe-site-draft";

const recipeGrid = document.getElementById("recipeGrid");
const recipeCardTemplate = document.getElementById("recipeCardTemplate");
const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");
const recipeViewContainer = document.getElementById("recipeViewContainer");
const cookOverlay = document.getElementById("cookOverlay");
const cookOverlayContent = document.getElementById("cookOverlayContent");
const cookPrevButton = document.getElementById("cookPrev");
const cookNextButton = document.getElementById("cookNext");
const quickLinkCards = document.querySelectorAll(".quick-link-card");

let allRecipes = [];
let filteredRecipes = [];
let selectedRecipeId = null;
let cookStepIndex = 0;
let ladybugSpriteUrl = "";
let ladybugSpriteMeta = null;

const CRITTER_SPRITE_CANDIDATES = [
  "./assets/Free Street Animal Pixel Art/5 Rat/Walk.png",
  "./assets/fox-walk.png",
  "./assets/rat-walk.png",
  "./assets/critter-walk.png",
];

function startLadybugWalk() {
  if (document.body?.dataset.page !== "home") {
    return;
  }

  const scheduleNext = (delay) => {
    window.setTimeout(() => {
      void spawnLadybug();
    }, delay);
  };

  const spawnLadybug = async () => {
    if (document.querySelector(".ladybug")) {
      scheduleNext(30000);
      return;
    }

    const ladybug = document.createElement("div");
    ladybug.className = "ladybug";
    ladybug.setAttribute("aria-hidden", "true");

    const spriteMeta = await resolveCritterSprite();
    if (spriteMeta) {
      applyCritterSprite(ladybug, spriteMeta);
    } else {
      if (!ladybugSpriteUrl) {
        ladybugSpriteUrl = buildLadybugSprite();
      }
      if (ladybugSpriteUrl) {
        ladybug.style.setProperty("--ladybug-sprite", `url('${ladybugSpriteUrl}')`);
        ladybug.style.setProperty("--ladybug-frames", "4");
        ladybug.style.setProperty("--ladybug-sprite-width", "400%");
        ladybug.style.setProperty("--ladybug-sprite-height", "100%");
      }
    }

    ladybug.style.setProperty(
      "--ladybug-duration",
      `${Math.round(15000 + Math.random() * 8000)}ms`
    );
    ladybug.style.top = `${6 + Math.random() * 10}px`;

    document.body.append(ladybug);

    ladybug.addEventListener("animationend", () => {
      ladybug.remove();
      scheduleNext(30000 + Math.random() * 60000);
    });
  };

  scheduleNext(8000 + Math.random() * 12000);
}

function applyCritterSprite(target, meta) {
  target.style.setProperty("--ladybug-sprite", `url('${meta.url}')`);
  target.style.setProperty("--ladybug-frames", String(meta.frames));
  target.style.setProperty(
    "--ladybug-flip",
    meta.flip ? "-1" : "1"
  );
  target.style.setProperty(
    "--ladybug-sprite-width",
    `${meta.frameWidth * meta.frames}px`
  );
  target.style.setProperty(
    "--ladybug-sprite-height",
    `${meta.frameHeight}px`
  );
  target.style.width = `${meta.frameWidth}px`;
  target.style.height = `${meta.frameHeight}px`;
  target.style.backgroundSize = `${meta.frameWidth * meta.frames}px ${meta.frameHeight}px`;
  target.style.backgroundPositionY = `-${meta.row * meta.frameHeight}px`;
}

function deriveSpriteMeta(url, img) {
  const width = img.width;
  const height = img.height;
  let frames = 4;
  let frameWidth = width;
  let frameHeight = height;
  let row = 0;
  const flip = /rat/i.test(url);

  if (width > height && width % height === 0) {
    frames = width / height;
    frameWidth = height;
    frameHeight = height;
  } else if (width % 8 === 0) {
    frames = 8;
    frameWidth = width / 8;
    frameHeight = height;
  } else if (width % 6 === 0) {
    frames = 6;
    frameWidth = width / 6;
    frameHeight = height;
  } else if (width % 4 === 0) {
    frames = 4;
    frameWidth = width / 4;
    frameHeight = height;
  } else {
    frames = Math.max(2, Math.floor(width / height));
    frameWidth = Math.floor(width / frames);
    frameHeight = height;
  }

  return { url, frames, frameWidth, frameHeight, row, flip };
}

function loadSpriteImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load sprite: ${url}`));
    img.src = url;
  });
}

async function resolveCritterSprite() {
  if (ladybugSpriteMeta) {
    return ladybugSpriteMeta;
  }

  for (const candidate of CRITTER_SPRITE_CANDIDATES) {
    try {
      const img = await loadSpriteImage(candidate);
      ladybugSpriteMeta = deriveSpriteMeta(candidate, img);
      return ladybugSpriteMeta;
    } catch (error) {
      // Try next candidate
    }
  }

  return null;
}

function buildLadybugSprite() {
  const frameCount = 4;
  const frameWidth = 52;
  const frameHeight = 28;
  const canvas = document.createElement("canvas");
  canvas.width = frameWidth * frameCount;
  canvas.height = frameHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return "";
  }

  const legOffsets = [
    [18, 20],
    [26, 19],
    [34, 20],
    [18, 23],
    [26, 24],
    [34, 23],
  ];

  for (let i = 0; i < frameCount; i += 1) {
    const offsetX = i * frameWidth;
    const phase = i % 2 === 0 ? 1 : -1;
    ctx.save();
    ctx.translate(offsetX, 0);

    ctx.strokeStyle = "#2c1b1a";
    ctx.lineWidth = 2;
    legOffsets.forEach(([x, y], index) => {
      const dir = index % 2 === 0 ? 1 : -1;
      const angle = (dir * (0.35 + 0.18 * phase)) * Math.PI;
      const length = 8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
      ctx.stroke();
    });

    ctx.beginPath();
    ctx.ellipse(28, 14, 13, 7.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#d74b3f";
    ctx.fill();
    ctx.strokeStyle = "rgba(111, 60, 58, 0.9)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#2c1b1a";
    ctx.beginPath();
    ctx.arc(15, 14, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(111, 60, 58, 0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(28, 8);
    ctx.lineTo(28, 20);
    ctx.stroke();

    ctx.fillStyle = "#2c1b1a";
    [
      [24, 10],
      [32, 12],
      [29, 17],
    ].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }

  return canvas.toDataURL("image/png");
}

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

async function loadRecipes() {
  const params = new URLSearchParams(window.location.search);
  const previewRecipes = loadPreviewRecipes();
  if (previewRecipes.length) {
    return previewRecipes;
  }

  if (params.get("preview") === "1") {
    return previewRecipes;
  }

  try {
    const response = await fetch("./data/recipes.json");
    if (!response.ok) {
      throw new Error("Unable to load recipes.json");
    }
    return await response.json();
  } catch (error) {
    console.error(error);
    return [];
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

function normalizeText(value) {
  return String(value || "").toLowerCase().trim();
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

function isHealthyRecipe(recipe) {
  const category = normalizeText(recipe.category);
  const tags = (recipe.tags || []).map(normalizeText);
  const keywords = ["healthy", "health", "healthified", "wellness"];
  return keywords.some(
    (keyword) => category.includes(keyword) || tags.some((tag) => tag.includes(keyword))
  );
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
    } else if (key === "breakfast") {
      recipe = findRecipe(recipes, (entry) =>
        normalizeText(entry.category).includes("breakfast")
      );
    } else if (key === "dinner") {
      recipe = findRecipe(recipes, (entry) =>
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

function buildShoppingItems(groups) {
  const seen = new Set();
  const items = [];

  groups.forEach((group) => {
    group.items.forEach((item) => {
      const key = normalizeText(item);
      if (!key || seen.has(key)) {
        return;
      }
      seen.add(key);
      items.push(item);
    });
  });

  return items;
}

function buildIngredientOverviewMarkup(ingredients) {
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

  const shoppingItems = buildShoppingItems(groups);
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
      <div class="subsection-heading compact">
        <p class="section-kicker">Ingredient overview</p>
        <h2>Component + shopping</h2>
      </div>
      <div class="ingredient-toggle" role="tablist" aria-label="Ingredient views">
        <button class="ingredient-tab is-active" type="button" data-view="components">
          Component view
        </button>
        <button class="ingredient-tab" type="button" data-view="shopping">
          Shopping view
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

function ingredientMatchesStep(item, stepText) {
  const cleaned = normalizeIngredientForMatch(item);
  if (!cleaned) {
    return false;
  }
  const step = normalizeText(stepText);
  if (!step) {
    return false;
  }
  const tokens = cleaned.split(" ").filter((token) => token.length > 2);
  return tokens.some((token) => step.includes(token));
}

function buildCookIngredients(ingredients, stepText) {
  const groups = buildIngredientGroups(ingredients);
  if (!groups.length) {
    return [];
  }

  const matchedGroups = groups
    .map((group) => ({
      title: group.title,
      items: group.items.filter((item) => ingredientMatchesStep(item, stepText)),
    }))
    .filter((group) => group.items.length);

  if (matchedGroups.length) {
    return matchedGroups;
  }

  return groups;
}

function buildCookModeMarkup(recipe, stepIndex) {
  if (!recipe) {
    return '<div class="empty-state">No recipe selected.</div>';
  }
  const steps = recipe.steps || [];
  const totalSteps = steps.length;
  const safeIndex = totalSteps ? Math.min(Math.max(stepIndex, 0), totalSteps - 1) : 0;
  const stepText = steps[safeIndex] || "No steps added yet.";
  const ingredientGroups = buildCookIngredients(recipe.ingredients || [], stepText);
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
    : '<div class="empty-state">No ingredients yet.</div>';

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
        <article class="cook-step-card notebook-card">
          <div class="step-number">Step ${safeIndex + 1}</div>
          <p>${escapeHtml(stepText)}</p>
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

function buildFilters(recipes) {
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
  const ingredientOverviewMarkup = buildIngredientOverviewMarkup(recipe.ingredients || []);

  const methodItems = (recipe.steps || [])
    .map(
      (item, index) => `
        <article class="step-card notebook-card">
          <div class="step-number">Step ${index + 1}</div>
          <p>${escapeHtml(item)}</p>
        </article>
      `
    )
    .join("");
  const tagItems = (recipe.tags || [])
    .map((tag) => `<span>${escapeHtml(tag)}</span>`)
    .join("");

  const metaItems = [
    recipe.prepTime && ["Prep", recipe.prepTime],
    recipe.cookTime && ["Cook", recipe.cookTime],
    recipe.serves && [yieldLabel, recipe.serves],
  ].filter(Boolean);

  const metaMarkup = metaItems.length
    ? metaItems
        .map(
          ([label, value]) => `
            <div class="recipe-meta-item">
              <span>${escapeHtml(label)}</span>
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

  const cookButtonMarkup = showCookButton
    ? `
        <button class="button button-ghost lets-cook-button" type="button" data-action="lets-cook">
          Let's cook
        </button>
      `
    : "";

  return `
    <article class="recipe-layout">
      <section class="recipe-main notebook-card">
        <a class="button button-ghost back-button recipe-back-button" href="./index.html">
          Return to main page
        </a>
        <div class="recipe-hero-grid">
          <div class="recipe-hero-media">
            <img
              class="recipe-hero-image"
              src="${escapeHtml(recipe.image || "")}"
              alt="${escapeHtml(recipe.title)}"
            />
          </div>
          <div class="recipe-hero-copy">
            <p class="recipe-category">${escapeHtml(recipe.category || "Recipe")}</p>
            <h1 class="recipe-page-title">${escapeHtml(recipe.title)}</h1>
            <p class="recipe-page-description">${escapeHtml(recipe.description || "")}</p>
            ${metaMarkup ? `<div class="recipe-meta-grid">${metaMarkup}</div>` : ""}
            ${tagItems ? `<div class="tag-row">${tagItems}</div>` : ""}
            <div class="recipe-cta-row">${cookButtonMarkup}</div>
          </div>
        </div>

        ${
          recipe.notes
            ? `
              <section class="recipe-note-box">
                <h3>Little note</h3>
                <p>${escapeHtml(recipe.notes)}</p>
              </section>
            `
            : ""
        }

        <section class="method-section">
          <div class="subsection-heading">
            <p class="section-kicker">Method</p>
            <h2>Cook step by step</h2>
          </div>
          <div class="step-grid">${methodItems}</div>
        </section>
      </section>

      <aside class="recipe-sidebar">
        ${ingredientOverviewMarkup}

        <section class="sidebar-card notebook-card">
          <div class="subsection-heading compact">
            <p class="section-kicker">Quick info</p>
            <h2>At a glance</h2>
          </div>
          <div class="info-stack">
            <div><span>Prep</span><strong>${escapeHtml(recipe.prepTime || "-")}</strong></div>
            <div><span>Cook</span><strong>${escapeHtml(recipe.cookTime || "-")}</strong></div>
            <div><span>${yieldLabel}</span><strong>${escapeHtml(recipe.serves || "-")}</strong></div>
            <div><span>Category</span><strong>${escapeHtml(recipe.category || "-")}</strong></div>
          </div>
        </section>
        ${nutritionMarkup}
      </aside>
    </article>
  `;
}

function renderRecipeView(recipe, options = {}) {
  const target = options.target || recipeViewContainer;
  if (!target) {
    return;
  }
  if (!recipe) {
    target.innerHTML =
      '<div class="empty-state">Select a recipe to see the full step-by-step view.</div>';
    return;
  }
  target.innerHTML = buildRecipeViewMarkup(recipe, options);
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

function selectRecipe(recipeId) {
  selectedRecipeId = recipeId;
  const selectedRecipe = getSelectedRecipe(filteredRecipes);
  updateQueryString(selectedRecipe?.id || "");
  renderRecipeView(selectedRecipe);
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
    const category = fragment.querySelector(".recipe-category");
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

    const handleOpen = () => {
      selectRecipe(recipe.id);
      document.getElementById("recipeView")?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    if (button) {
      button.addEventListener("click", handleOpen);
    }
    card.addEventListener("click", (event) => {
      if (event.target.tagName !== "BUTTON") {
        handleOpen();
      }
    });

    recipeGrid.append(fragment);
  });
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
  cookOverlayContent.innerHTML = buildCookModeMarkup(recipe, cookStepIndex);
  refreshIcons();
  updateCookOverlayNav(recipe);
}

function openCookOverlay(recipeId) {
  if (!cookOverlay) {
    return;
  }

  if (recipeId) {
    selectRecipe(recipeId);
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
  if (!tab) {
    return;
  }
  const container = tab.closest(".ingredient-overview");
  if (!container) {
    return;
  }
  const view = tab.dataset.view;
  container.querySelectorAll(".ingredient-tab").forEach((button) => {
    button.classList.toggle("is-active", button === tab);
  });
  container.querySelectorAll(".ingredient-view").forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.view === view);
  });
}

function handleCookActions(event) {
  const actionTarget = event.target.closest("[data-action]");
  if (!actionTarget) {
    return;
  }
  const action = actionTarget.dataset.action;

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

function handleCookKeydown(event) {
  if (event.key === "Escape" && cookOverlay?.classList.contains("is-open")) {
    closeCookOverlay();
  }
}

function applyFilters() {
  const searchTerm = normalizeText(searchInput.value);
  const selectedCategory = categoryFilter.value;

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

  renderRecipeView(selectedRecipe);
  renderRecipes(filteredRecipes);
}

async function init() {
  allRecipes = await loadRecipes();
  buildFilters(allRecipes);

  const params = new URLSearchParams(window.location.search);
  const searchParam = params.get("search");
  const categoryParam = params.get("category");
  selectedRecipeId = params.get("recipe") || null;
  filteredRecipes = [...allRecipes];

  if (searchParam) {
    searchInput.value = searchParam;
  }

  if (categoryParam) {
    const normalizedCategory = normalizeText(categoryParam);
    const match = Array.from(categoryFilter.options).find(
      (option) => normalizeText(option.value) === normalizedCategory
    );
    if (match) {
      categoryFilter.value = match.value;
    }
  }

  applyFilters();
  refreshIcons();
  populateQuickLinks(allRecipes);
  startLadybugWalk();

  searchInput.addEventListener("input", applyFilters);
  categoryFilter.addEventListener("change", applyFilters);
  document.addEventListener("click", handleIngredientTabs);
  document.addEventListener("click", handleCookActions);
  document.addEventListener("keydown", handleCookKeydown);
  window.addEventListener("storage", handleStorageUpdate);
}

init();

async function handleStorageUpdate(event) {
  if (!event || event.key !== PREVIEW_STORAGE_KEY) {
    return;
  }
  const currentSearch = searchInput?.value || "";
  const currentCategory = categoryFilter?.value || "all";
  const previewRecipes = loadPreviewRecipes();
  if (previewRecipes.length) {
    allRecipes = previewRecipes;
  } else {
    allRecipes = await loadRecipes();
  }
  buildFilters(allRecipes);
  if (searchInput) {
    searchInput.value = currentSearch;
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
  populateQuickLinks(allRecipes);
}
