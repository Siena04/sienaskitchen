const PREVIEW_STORAGE_KEY = "recipe-site-draft";

const listScroll = document.getElementById("azListScroll");
const listContainer = document.getElementById("azList");
const viewContainer = document.getElementById("azRecipeView");
const searchInput = document.getElementById("azSearchInput");
const seriesFilter = document.getElementById("azSeriesFilter");
const suggestions = document.getElementById("azSuggestions");
const scrollBubble = document.getElementById("azScrollBubble");

let allRecipes = [];
let filteredRecipes = [];
let selectedRecipeId = null;
let letterMarkers = [];
let bubbleTimer = null;

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

async function loadRecipes() {
  const previewRecipes = loadPreviewRecipes();
  if (previewRecipes.length) {
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

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function getRecipeLetter(recipe) {
  const title = normalizeText(recipe?.title || "");
  const letter = title.charAt(0).toUpperCase();
  return /^[A-Z]$/.test(letter) ? letter : "#";
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

function recipeMatchesSeries(recipe, series) {
  if (!series || series === "all") {
    return true;
  }
  const title = normalizeText(recipe.title);
  const category = normalizeText(recipe.category);
  const tags = (recipe.tags || []).map(normalizeText);
  const haystack = [title, category, ...tags].join(" ");

  switch (series) {
    case "junk-food-rebuilt":
      return (
        title.includes("chicken crust") ||
        haystack.includes("junk") ||
        isHealthyRecipe(recipe)
      );
    case "meal-prep":
      return haystack.includes("meal prep");
    case "baked-favourites":
      return category.includes("dessert") || haystack.includes("bake");
    case "breakfast":
      return category.includes("breakfast");
    case "dinner":
      return category.includes("dinner");
    case "budget-meals":
      return haystack.includes("budget");
    default:
      return true;
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

function buildRecipeViewMarkup(recipe, options = {}) {
  if (!recipe) {
    return '<div class="empty-state">No recipe is available yet.</div>';
  }

  const showCookButton = options.showCookButton !== false;
  const showBackButton = options.showBackButton === true;
  const backHref = options.backHref || "./index.html";
  const backLabel = options.backLabel || "Return to main page";
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
        ${
          showBackButton
            ? `
              <a class="button button-ghost back-button recipe-back-button" href="${backHref}">
                ${escapeHtml(backLabel)}
              </a>
            `
            : ""
        }
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

function recipeMatches(recipe, searchTerm) {
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

  return !searchTerm || haystack.includes(searchTerm);
}

function selectRecipe(recipeId) {
  selectedRecipeId = recipeId;
  const selected = filteredRecipes.find((recipe) => recipe.id === recipeId) || filteredRecipes[0];
  renderRecipeView(selected || null);
  updateActiveListItem();
}

function renderRecipeView(recipe) {
  if (!viewContainer) {
    return;
  }
  viewContainer.innerHTML = buildRecipeViewMarkup(recipe, {
    showCookButton: false,
    showBackButton: false,
  });
  refreshIcons();
}

function updateActiveListItem() {
  const items = listContainer?.querySelectorAll(".az-list-item") || [];
  items.forEach((item) => {
    item.classList.toggle("is-active", item.dataset.recipeId === selectedRecipeId);
  });
}

function renderList(recipes) {
  if (!listContainer) {
    return;
  }

  listContainer.innerHTML = "";

  if (!recipes.length) {
    listContainer.innerHTML = '<div class="empty-state">No recipes match this search yet.</div>';
    letterMarkers = [];
    updateScrollBubble();
    return;
  }

  let currentLetter = null;
  recipes.forEach((recipe) => {
    const letter = getRecipeLetter(recipe);
    if (letter !== currentLetter) {
      currentLetter = letter;
      const marker = document.createElement("div");
      marker.className = "az-letter-marker";
      marker.dataset.letter = letter;
      marker.innerHTML = `<span>${letter}</span>`;
      listContainer.append(marker);
    }

    const item = document.createElement("button");
    item.type = "button";
    item.className = "az-list-item notebook-card";
    item.dataset.recipeId = recipe.id;
    item.innerHTML = `
      <div class="az-list-row">
        <strong class="az-list-title">${escapeHtml(recipe.title || "Untitled recipe")}</strong>
        <span class="az-list-category">${escapeHtml(recipe.category || "Recipe")}</span>
      </div>
      <p class="az-list-description">${escapeHtml(recipe.description || "")}</p>
    `;
    item.addEventListener("click", () => {
      selectRecipe(recipe.id);
    });

    listContainer.append(item);
  });

  letterMarkers = Array.from(listContainer.querySelectorAll(".az-letter-marker"));
  updateActiveListItem();
  updateScrollBubble();
}

function updateScrollBubble() {
  if (!scrollBubble || !listScroll || !letterMarkers.length) {
    if (scrollBubble) {
      scrollBubble.classList.remove("is-visible");
    }
    return;
  }

  const scrollTop = listScroll.scrollTop;
  let currentLetter = letterMarkers[0]?.dataset.letter || "";

  for (const marker of letterMarkers) {
    if (marker.offsetTop <= scrollTop + 12) {
      currentLetter = marker.dataset.letter;
    } else {
      break;
    }
  }

  if (currentLetter) {
    scrollBubble.textContent = currentLetter;
  }
}

function handleListScroll() {
  updateScrollBubble();
  if (!scrollBubble) {
    return;
  }
  scrollBubble.classList.add("is-visible");
  if (bubbleTimer) {
    clearTimeout(bubbleTimer);
  }
  bubbleTimer = setTimeout(() => {
    scrollBubble.classList.remove("is-visible");
  }, 800);
}

function updateSuggestions(searchTerm) {
  if (!suggestions) {
    return;
  }

  const trimmed = normalizeText(searchTerm);
  suggestions.innerHTML = "";

  if (!trimmed) {
    suggestions.hidden = true;
    return;
  }

  const matches = allRecipes
    .map((recipe) => recipe.title || "")
    .filter((title) => normalizeText(title).includes(trimmed));

  const uniqueMatches = [...new Set(matches)].slice(0, 6);

  if (!uniqueMatches.length) {
    suggestions.hidden = true;
    return;
  }

  uniqueMatches.forEach((title) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "az-suggestion";
    button.setAttribute("role", "option");
    button.textContent = title;
    button.addEventListener("click", () => {
      if (searchInput) {
        searchInput.value = title;
      }
      suggestions.hidden = true;
      applyFilters();
    });
    suggestions.append(button);
  });

  suggestions.hidden = false;
}

function applyFilters() {
  const searchTerm = normalizeText(searchInput?.value || "");
  const series = seriesFilter?.value || "all";
  filteredRecipes = allRecipes.filter(
    (recipe) => recipeMatches(recipe, searchTerm) && recipeMatchesSeries(recipe, series)
  );

  if (!filteredRecipes.find((recipe) => recipe.id === selectedRecipeId)) {
    selectedRecipeId = filteredRecipes[0]?.id || null;
  }

  renderList(filteredRecipes);
  if (listScroll) {
    listScroll.scrollTop = 0;
  }
  renderRecipeView(
    filteredRecipes.find((recipe) => recipe.id === selectedRecipeId) || null
  );
}

function updateSeriesParam(series) {
  const url = new URL(window.location.href);
  if (series && series !== "all") {
    url.searchParams.set("series", series);
  } else {
    url.searchParams.delete("series");
  }
  window.history.replaceState({}, "", url);
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

async function initLibrary() {
  allRecipes = await loadRecipes();
  allRecipes.sort((a, b) =>
    String(a?.title || "").localeCompare(String(b?.title || ""), undefined, {
      sensitivity: "base",
    })
  );
  filteredRecipes = [...allRecipes];

  const params = new URLSearchParams(window.location.search);
  const seriesParam = params.get("series");
  if (seriesFilter && seriesParam) {
    const match = Array.from(seriesFilter.options).find(
      (option) => normalizeText(option.value) === normalizeText(seriesParam)
    );
    if (match) {
      seriesFilter.value = match.value;
    }
  }

  selectedRecipeId = filteredRecipes[0]?.id || null;
  applyFilters();

  if (listScroll) {
    listScroll.addEventListener("scroll", handleListScroll);
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      updateSuggestions(searchInput.value);
      applyFilters();
    });
    searchInput.addEventListener("focus", () => updateSuggestions(searchInput.value));
    searchInput.addEventListener("blur", () => {
      if (!suggestions) {
        return;
      }
      setTimeout(() => {
        suggestions.hidden = true;
      }, 150);
    });
  }

  if (seriesFilter) {
    seriesFilter.addEventListener("change", () => {
      applyFilters();
      updateSeriesParam(seriesFilter.value);
    });
  }

  document.addEventListener("click", handleIngredientTabs);
  refreshIcons();
}

initLibrary();
