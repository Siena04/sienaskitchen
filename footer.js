const CATEGORY_STORAGE_KEY = "recipe-site-draft";

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function normalizeText(value) {
  return String(value || "").toLowerCase().trim();
}

function loadPreviewRecipes() {
  try {
    const raw = localStorage.getItem(CATEGORY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error(error);
    return [];
  }
}

async function loadRecipesForCategories() {
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

function buildCategoryLinks(categories, menu) {
  menu.innerHTML = categories
    .map(
      (category) =>
        `<a role="menuitem" href="./recipe-library.html?category=${encodeURIComponent(
          category
        )}">${escapeHtml(category)}</a>`
    )
    .join("");
}

function setupDropdownInteractions(dropdown) {
  const toggle = dropdown.querySelector(".footer-dropdown-toggle");
  if (!toggle) {
    return;
  }

  toggle.addEventListener("click", (event) => {
    event.preventDefault();
    const isOpen = dropdown.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });

  document.addEventListener("click", (event) => {
    if (!dropdown.contains(event.target)) {
      dropdown.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });
}

async function initFooterCategories() {
  const dropdowns = Array.from(document.querySelectorAll("[data-category-dropdown]"));
  if (!dropdowns.length) {
    return;
  }

  dropdowns.forEach((dropdown) => setupDropdownInteractions(dropdown));

  const recipes = await loadRecipesForCategories();
  const categories = [
    ...new Set(recipes.map((recipe) => recipe.category).filter(Boolean)),
  ].sort((a, b) =>
    String(a).localeCompare(String(b), undefined, { sensitivity: "base" })
  );

  dropdowns.forEach((dropdown) => {
    const menu = dropdown.querySelector(".footer-dropdown-menu");
    if (!menu) {
      return;
    }
    if (!categories.length) {
      menu.innerHTML = '<span class="footer-dropdown-empty">No categories yet</span>';
      return;
    }
    buildCategoryLinks(categories, menu);
  });
}

initFooterCategories();
