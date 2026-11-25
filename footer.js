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

  const closeDropdown = () => {
    dropdown.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
  };

  toggle.addEventListener("click", (event) => {
    event.preventDefault();
    const isOpen = dropdown.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });

  document.addEventListener("click", (event) => {
    if (!dropdown.contains(event.target)) {
      closeDropdown();
    }
  });

  window.addEventListener("scroll", closeDropdown, { passive: true });
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

function initNavigationDrawer() {
  const toggle = document.querySelector('[data-menu-toggle]');
  if (!toggle) return;
  const drawer = document.createElement('dialog');
  drawer.className = 'navigation-drawer';
  drawer.id = 'navigationDrawer';
  drawer.setAttribute('aria-labelledby', 'drawerTitle');
  drawer.innerHTML = `
    <div class="drawer-top"><h2 id="drawerTitle">Siena's Kitchen</h2><button type="button" class="drawer-close" aria-label="Close menu">×</button></div>
    <nav class="drawer-links" aria-label="Primary">
      <a class="drawer-home" href="./index.html">Home <span aria-hidden="true">→</span></a>
      <a href="./recipe-library.html">A-Z Recipe library <span aria-hidden="true">→</span></a>
      <a href="./saved-recipes.html">Saved Recipes <span aria-hidden="true">→</span></a>
      <details><summary>By category</summary><div class="drawer-categories"><p>Loading categories…</p></div></details>
      <a href="./conversion.html">Cooking Conversion Calculator <span aria-hidden="true">→</span></a>
      <a href="./about.html">About <span aria-hidden="true">→</span></a>
    </nav>`;
  document.body.append(drawer);
  let closing = false;
  let previousOverflow = '';
  const finishClose = () => {
    drawer.close();
    drawer.classList.remove('is-closing');
    closing = false;
    toggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = previousOverflow;
    toggle.focus();
  };
  const close = () => {
    if (!drawer.open || closing) return;
    closing = true;
    drawer.classList.add('is-closing');
    window.setTimeout(finishClose, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180);
  };
  toggle.addEventListener('click', () => {
    previousOverflow = document.body.style.overflow;
    drawer.showModal();
    toggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    drawer.querySelector('.drawer-close').focus();
  });
  drawer.querySelector('.drawer-close').addEventListener('click', close);
  drawer.addEventListener('cancel', (event) => { event.preventDefault(); close(); });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted && drawer.open && !closing) finishClose();
  });
  drawer.addEventListener('click', (event) => {
    if (event.target !== drawer) return;
    const bounds = drawer.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
  });
  loadRecipesForCategories().then((recipes) => {
    const categories = [...new Set(recipes.map((recipe) => recipe.category).filter(Boolean))].sort();
    const container = drawer.querySelector('.drawer-categories');
    container.replaceChildren();
    categories.forEach((category) => {
      const link = document.createElement('a');
      link.href = `./recipe-library.html?category=${encodeURIComponent(category)}`;
      link.textContent = category;
      container.append(link);
    });
    if (!categories.length) container.textContent = 'No categories yet.';
  });
}
initNavigationDrawer();

function initSiteBack() {
  const back = document.querySelector("[data-site-back]");
  if (!back) return;

  function canGoBackWithinSite() {
    const navigation = window.navigation;
    const index = navigation?.currentEntry?.index ?? -1;
    const previousUrl = index >= 0
      ? navigation.entries()[index - 1]?.url
      : document.referrer;
    if (!previousUrl || window.history.length < 2) return false;

    const previous = new URL(previousUrl);
    const current = new URL(window.location.href);
    return (
      previous.href !== current.href &&
      new URL(".", previous).href === new URL(".", back.href).href
    );
  }

  function updateBackLabel() {
    back.setAttribute("aria-label", canGoBackWithinSite() ? "Go back" : "Back to Home");
  }

  updateBackLabel();
  window.addEventListener("pageshow", updateBackLabel);
  window.navigation?.addEventListener("currententrychange", updateBackLabel);
  back.addEventListener("click", (event) => {
    if (
      event.defaultPrevented || event.button !== 0 ||
      event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
      !canGoBackWithinSite()
    ) {
      return;
    }

    event.preventDefault();
    window.history.back();
  });
}
initSiteBack();

for (const tentLink of document.querySelectorAll(".footer-camp-link")) {
  tentLink.addEventListener("click", (event) => {
    if (
      event.defaultPrevented || event.button !== 0 ||
      event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    event.preventDefault();
    if (tentLink.classList.contains("is-hopping")) return;
    tentLink.classList.add("is-hopping");
    window.setTimeout(() => window.location.assign(tentLink.href), 300);
  });

  window.addEventListener("pageshow", () => tentLink.classList.remove("is-hopping"));
}
