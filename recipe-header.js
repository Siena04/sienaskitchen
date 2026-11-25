(() => {
  const header = document.querySelector(".shared-site-header");
  if (!header) return;

  const searchIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><path d="m16 16 4 4" /></svg>`;
  header.innerHTML = `
    <button class="header-menu-toggle" type="button" data-menu-toggle aria-label="Open navigation menu" aria-expanded="false" aria-controls="navigationDrawer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M3 9h18M3 15h13" /></svg></button>
    <div class="brand-lockup">
      <div class="brand-title">
        <img
          class="brand-logo"
          src="./assets/siena-profile.jpg"
          alt="Siena"
        />
        <a href="./index.html" class="brand-name">Siena's Kitchen</a>
      </div>
      <a
        class="brand-handle"
        href="https://instagram.com/sienaskitchen"
        target="_blank"
        rel="noreferrer"
      >
        <span class="brand-handle-icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
        </span>
        @sienaskitchen
      </a>
    </div>
    <div class="sticker-shelf header-sticker-shelf" aria-hidden="true">
      <img class="sticker-img" src="./assets/stickers/page1-17.png" alt="" />
      <img class="sticker-img" src="./assets/stickers/page1-07.png" alt="" />
      <img class="sticker-img" src="./assets/stickers/page1-05.png" alt="" />
      <img class="sticker-img" src="./assets/stickers/page1-12.png" alt="" />
      <img class="sticker-img" src="./assets/stickers/page2-07.png" alt="" />
      <img class="sticker-img" src="./assets/stickers/page2-05.png" alt="" />
      <img class="sticker-img" src="./assets/stickers/page2-13.png" alt="" />
      <img class="sticker-img" src="./assets/stickers/page1-02.png" alt="" />
      <img class="sticker-img" src="./assets/stickers/page1-03.png" alt="" />
      <img class="sticker-img" src="./assets/stickers/page1-08.png" alt="" />
    </div>
    <div class="top-search">
      <label class="search-field top-search-field">
        <span class="sr-only">Search recipes</span>
        <input id="topSearchInput" type="search" placeholder="Search Recipes..." autocomplete="off" readonly aria-haspopup="dialog" aria-controls="searchOverlay" />
        <span class="search-field-icon" aria-hidden="true">
          ${searchIcon}
        </span>
      </label>
    </div>`;

  function getNutritionPerServe(recipe) {
    const nutrition = recipe?.nutrition || {};
    const basis = recipe?.nutritionEstimate?.basis;
    if (basis !== 'per batch' && basis !== 'per loaf') {
      return nutrition;
    }

    const serves = String(recipe.serves ?? '').trim();
    if (!/^\d+(?:\.\d+)?$/.test(serves) || Number(serves) <= 0) {
      return {};
    }

    return Object.fromEntries(Object.entries(nutrition).map(([key, raw]) => {
      const value = String(raw ?? '').trim().match(/^(\d+(?:\.\d+)?)\s*(kcal|g)?$/i);
      if (!value) return [key, ''];
      const [, amount, unit = key === 'calories' ? 'kcal' : 'g'] = value;
      const perServe = Number(amount) / Number(serves);
      return [key, unit.toLowerCase() === 'kcal'
        ? Math.round(perServe) + ' ' + unit
        : Number(perServe.toFixed(1)) + unit];
    }));
  }

  function addCardNutrition(title, recipe) {
    if (!title) return;
    const nutrition = getNutritionPerServe(recipe);
    const fields = [
      ['kcal', 'Calories', nutrition.calories],
      ['P', 'Protein', nutrition.protein],
      ['C', 'Carbohydrates', nutrition.carbs],
      ['F', 'Fat', nutrition.fat],
    ];
    const row = document.createElement('div');
    row.className = 'recipe-card-nutrition';
    const category = title.closest('.recipe-card')?.querySelector('.recipe-card-category');
    if (category) title.append(category);
    title.insertAdjacentElement('afterend', row);

    const hasValues = fields.some(([, , value]) => String(value ?? '').trim());
    if (!hasValues) {
      row.textContent = 'Macros pending';
      return;
    }

    const label = document.createElement('span');
    label.className = 'recipe-card-nutrition-basis';
    label.textContent = 'Per serve';
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', label.textContent);
    row.append(label);
    fields.forEach(([label, fullLabel, raw]) => {
      const value = String(raw ?? '').trim();
      const clean = label === 'kcal' ? value.replace(/\s*kcal\s*$/i, '').trim() : value;
      const display = clean ? (label !== 'kcal' && /^\d+(?:\.\d+)?$/.test(clean) ? `${clean}g` : clean) : '—';
      const item = document.createElement('span');
      item.setAttribute('aria-label', `${fullLabel}: ${clean ? display : 'not available'}`);
      const key = document.createElement('b');
      key.textContent = label;
      item.append(key, document.createTextNode(` ${display}`));
      row.append(item);
    });
  }

  const searchDialog = document.createElement("dialog");
  searchDialog.className = "search-overlay__panel";
  searchDialog.id = "searchOverlay";
  searchDialog.setAttribute("aria-labelledby", "siteSearchTitle");
  searchDialog.innerHTML = `
    <div class="search-overlay__header">
      <h2 id="siteSearchTitle">Search recipes</h2>
      <button class="button button-ghost button-small" type="button" data-close-search>Close</button>
    </div>
    <label class="search-field search-overlay-field">
      <span class="sr-only">Search recipes</span>
      <input id="overlaySearchInput" type="search" placeholder="Search Recipes..." autocomplete="off" autofocus />
      <span class="search-field-icon" aria-hidden="true">${searchIcon}</span>
    </label>
    <div id="overlaySearchResults" class="search-overlay__results" aria-live="polite"></div>`;
  document.body.append(searchDialog);

  const trigger = header.querySelector("#topSearchInput");
  const input = searchDialog.querySelector("#overlaySearchInput");
  const results = searchDialog.querySelector("#overlaySearchResults");
  let getRecipes = async () => {
    const response = await fetch("./data/recipes.json");
    if (!response.ok) throw new Error("Unable to load recipes");
    return response.json();
  };
  let recipesRequest;
  let renderVersion = 0;
  let closing = false;

  window.siteHeader = {
    addCardNutrition,
    getNutritionPerServe,
    setRecipeProvider(provider) {
      getRecipes = provider;
    },
  };

  function buildSearchResult(recipe) {
    const link = document.createElement("a");
    link.className = "search-overlay__result recipe-card notebook-card";
    link.href = `./recipe-library.html?recipe=${encodeURIComponent(recipe.id)}`;

    const imageWrap = document.createElement("div");
    imageWrap.className = "recipe-image-wrap";
    if (recipe.image) {
      const image = document.createElement("img");
      image.className = "recipe-image";
      image.loading = "lazy";
      image.src = recipe.image;
      image.alt = "";
      imageWrap.append(image);
    }

    const body = document.createElement("div");
    body.className = "recipe-card-body";
    const title = document.createElement("h3");
    title.className = "recipe-title";
    title.textContent = recipe.title || "Untitled recipe";
    body.append(title);
    addCardNutrition(title, recipe);
    link.append(imageWrap, body);
    return link;
  }

  async function renderSearch() {
    const version = ++renderVersion;
    results.textContent = "Loading recipes…";
    let recipes;
    try {
      recipes = await recipesRequest;
    } catch {
      if (version === renderVersion && searchDialog.open) {
        results.textContent = "Recipes could not load. Please try again.";
      }
      return;
    }
    if (version !== renderVersion || !searchDialog.open) return;

    const query = input.value.trim().toLowerCase();
    const published = recipes.filter((recipe) => recipe?.id && recipe.published !== false);
    const matches = query
      ? published.filter((recipe) =>
          [recipe.title, recipe.description, recipe.category, ...(recipe.tags || []), ...(recipe.ingredients || [])]
            .join(" ").toLowerCase().includes(query)
        ).slice(0, 10)
      : published.slice(-10).reverse();

    results.replaceChildren();
    results.classList.toggle("is-latest", !query);
    results.classList.toggle("is-matches", Boolean(query));
    if (!matches.length) {
      const message = document.createElement("p");
      message.className = "search-overlay__empty";
      message.textContent = query ? "No matches yet." : "No recipes yet.";
      results.append(message);
      return;
    }
    if (!query) {
      const heading = document.createElement("div");
      heading.className = "search-overlay__section-title";
      heading.textContent = "Latest";
      results.append(heading);
    }
    results.append(...matches.map(buildSearchResult));
  }

  function openSearch() {
    if (closing || searchDialog.open) return;
    input.value = trigger.value;
    recipesRequest = Promise.resolve().then(getRecipes);
    searchDialog.showModal();
    renderSearch();
  }

  function closeSearch() {
    if (!searchDialog.open) return;
    closing = true;
    searchDialog.close();
    trigger.focus({ preventScroll: true });
    closing = false;
  }

  trigger.addEventListener("focus", openSearch);
  trigger.addEventListener("click", openSearch);
  trigger.addEventListener("keydown", (event) => {
    if (event.key === "Enter") openSearch();
  });
  input.addEventListener("input", renderSearch);
  searchDialog.querySelector("[data-close-search]").addEventListener("click", closeSearch);
  searchDialog.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    closeSearch();
  });
  searchDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeSearch();
  });
  searchDialog.addEventListener("click", (event) => {
    if (event.target !== searchDialog) return;
    const bounds = searchDialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) closeSearch();
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) closeSearch();
  });
})();
