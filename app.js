const PREVIEW_STORAGE_KEY = "recipe-site-draft";

const recipeGrid = document.getElementById("recipeGrid");
const recipeCardTemplate = document.getElementById("recipeCardTemplate");
const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");
const recipeViewContainer = document.getElementById("recipeViewContainer");

let allRecipes = [];
let filteredRecipes = [];
let selectedRecipeId = null;

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

async function loadRecipes() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("preview") === "1") {
    const previewRecipes = loadPreviewRecipes();
    if (previewRecipes.length) {
      return previewRecipes;
    }
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

function getSelectedRecipe(recipes) {
  return (
    recipes.find((recipe) => recipe.id === selectedRecipeId) ||
    recipes[0] ||
    allRecipes[0] ||
    null
  );
}

function renderRecipeView(recipe) {
  if (!recipe) {
    recipeViewContainer.innerHTML =
      '<div class="empty-state">No recipe is available yet. Add one in admin mode.</div>';
    return;
  }

  const ingredientItems = (recipe.ingredients || [])
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
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

  recipeViewContainer.innerHTML = `
    <article class="recipe-layout">
      <section class="recipe-main notebook-card">
        <div class="recipe-main-top">
          <div class="recipe-copy">
            <p class="recipe-category">${escapeHtml(recipe.category || "Recipe")}</p>
            <h1 class="recipe-page-title">${escapeHtml(recipe.title)}</h1>
            <p class="recipe-page-description">${escapeHtml(recipe.description || "")}</p>
            <div class="recipe-meta">
              ${[recipe.prepTime, recipe.cookTime, recipe.serves && `Serves ${recipe.serves}`]
                .filter(Boolean)
                .map((item) => `<span>${escapeHtml(item)}</span>`)
                .join("")}
            </div>
            <div class="tag-row">${tagItems}</div>
          </div>
          <div class="creator-card">
            <div class="creator-badge" aria-hidden="true">
              <i data-lucide="heart"></i>
            </div>
            <p class="creator-label">Shared from</p>
            <strong>Sunday Table kitchen notes</strong>
            <p>Made for friends, family, and future followers.</p>
          </div>
        </div>

        <div class="recipe-hero-image-wrap">
          <img
            class="recipe-hero-image"
            src="${escapeHtml(recipe.image || "")}"
            alt="${escapeHtml(recipe.title)}"
          />
          <div class="image-note">Cute layout, still practical while cooking</div>
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
        <section class="sidebar-card notebook-card">
          <div class="subsection-heading compact">
            <p class="section-kicker">Ingredients</p>
            <h2>What you need</h2>
          </div>
          <ul class="ingredient-list">${ingredientItems}</ul>
        </section>

        <section class="sidebar-card notebook-card">
          <div class="subsection-heading compact">
            <p class="section-kicker">Quick info</p>
            <h2>At a glance</h2>
          </div>
          <div class="info-stack">
            <div><span>Prep</span><strong>${escapeHtml(recipe.prepTime || "-")}</strong></div>
            <div><span>Cook</span><strong>${escapeHtml(recipe.cookTime || "-")}</strong></div>
            <div><span>Serves</span><strong>${escapeHtml(recipe.serves || "-")}</strong></div>
            <div><span>Category</span><strong>${escapeHtml(recipe.category || "-")}</strong></div>
          </div>
        </section>
      </aside>
    </article>
  `;

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

    image.src = recipe.image || "";
    image.alt = recipe.title;
    category.textContent = recipe.category || "Recipe";
    title.textContent = recipe.title;
    description.textContent = recipe.description || "";

    [recipe.prepTime, recipe.cookTime, recipe.serves && `Serves ${recipe.serves}`]
      .filter(Boolean)
      .forEach((item) => {
        const pill = document.createElement("span");
        pill.textContent = item;
        meta.append(pill);
      });

    if (recipe.id === selectedRecipeId) {
      card.classList.add("is-active");
    }

    const handleOpen = () => {
      selectRecipe(recipe.id);
      document.getElementById("recipeView")?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    button.addEventListener("click", handleOpen);
    card.addEventListener("click", (event) => {
      if (event.target.tagName !== "BUTTON") {
        handleOpen();
      }
    });

    recipeGrid.append(fragment);
  });
}

function applyFilters() {
  const searchTerm = normalizeText(searchInput.value);
  const selectedCategory = categoryFilter.value;

  filteredRecipes = allRecipes.filter((recipe) =>
    recipeMatches(recipe, searchTerm, selectedCategory)
  );

  const selectedRecipe = getSelectedRecipe(filteredRecipes);
  if (selectedRecipe) {
    selectedRecipeId = selectedRecipe.id;
  }

  renderRecipeView(selectedRecipe);
  renderRecipes(filteredRecipes);
}

async function init() {
  allRecipes = await loadRecipes();
  buildFilters(allRecipes);

  const params = new URLSearchParams(window.location.search);
  selectedRecipeId = params.get("recipe") || allRecipes[0]?.id || null;
  filteredRecipes = [...allRecipes];

  applyFilters();
  refreshIcons();

  searchInput.addEventListener("input", applyFilters);
  categoryFilter.addEventListener("change", applyFilters);
}

init();
