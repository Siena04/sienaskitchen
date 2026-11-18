(() => {
  const search = document.getElementById('topSearchInput');
  if (!search) return;
  const dialog = document.createElement('dialog');
  dialog.className = 'header-search-dialog';
  dialog.setAttribute('aria-labelledby', 'headerSearchTitle');
  dialog.innerHTML = `
    <div class="header-search-top"><h2 id="headerSearchTitle">Search recipes</h2><button type="button" aria-label="Close search">×</button></div>
    <label>Search by recipe, ingredient or category<input type="search" autocomplete="off" /></label>
    <div class="header-search-results" aria-live="polite"></div>`;
  document.body.append(dialog);
  const input = dialog.querySelector('input');
  const results = dialog.querySelector('.header-search-results');
  let recipes = [];
  let loadFailed = false;
  let closing = false;
  const ready = fetch('./data/recipes.json')
    .then((response) => {
      if (!response.ok) throw new Error('Unable to load recipes');
      return response.json();
    })
    .then((entries) => { recipes = entries.filter((recipe) => recipe.published !== false); })
    .catch(() => { loadFailed = true; });

  async function render() {
    results.textContent = 'Loading recipes…';
    await ready;
    const query = input.value.trim().toLowerCase();
    const matches = recipes.filter((recipe) =>
      [recipe.title, recipe.category, ...(recipe.tags || []), ...(recipe.ingredients || [])]
        .join(' ').toLowerCase().includes(query)
    );
    results.replaceChildren();
    if (!matches.length) {
      results.textContent = loadFailed ? 'Recipes could not load. Please try again.' : 'No recipes match your search.';
      return;
    }
    matches.forEach((recipe) => {
      const link = document.createElement('a');
      link.href = `./recipe-library.html?recipe=${encodeURIComponent(recipe.id)}`;
      if (recipe.image) {
        const image = document.createElement('img');
        image.src = recipe.image;
        image.alt = '';
        image.loading = 'lazy';
        link.append(image);
      }
      const title = document.createElement('strong');
      title.textContent = recipe.title;
      link.append(title);
      results.append(link);
    });
  }
  search.addEventListener('focus', () => {
    if (closing || dialog.open) return;
    input.value = search.value;
    dialog.showModal();
    input.focus();
    render();
  });
  input.addEventListener('input', () => { search.value = input.value; render(); });
  function closeSearch() {
    closing = true;
    dialog.close();
  }
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); closeSearch(); });
  dialog.querySelector('button').addEventListener('click', closeSearch);
  dialog.addEventListener('click', (event) => {
    const bounds = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) closeSearch();
  });
  dialog.addEventListener('close', () => {
    // Avoid reopening when the browser restores focus to the search field.
    search.blur();
    search.closest('header').querySelector('[data-menu-toggle]').focus();
    closing = false;
  });
})();
