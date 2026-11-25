(() => {
  const prefix = "recipe-site-saved:";

  function has(recipeId) {
    try {
      return localStorage.getItem(prefix + recipeId) === "1";
    } catch {
      return false;
    }
  }

  function set(recipeId, saved) {
    const key = prefix + recipeId;
    if (saved) localStorage.setItem(key, "1");
    else localStorage.removeItem(key);
  }

  function subscribe(callback) {
    window.addEventListener("storage", (event) => {
      if (event.key === null || event.key.startsWith(prefix)) callback();
    });
  }

  window.recipeSaves = { has, set, subscribe };

  const list = document.getElementById("savedRecipeList");
  if (!list) return;

  const status = document.getElementById("savedRecipeStatus");
  let recipes = [];

  function render() {
    const saved = recipes.filter((recipe) => has(recipe.id));
    status.textContent = saved.length ? "" : "Tap the heart on a recipe to keep it here.";
    list.replaceChildren(...saved.map((recipe) => {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.className = "recipe-photo-card";
      link.href = `./recipe-library.html?recipe=${encodeURIComponent(recipe.id)}`;
      const media = document.createElement("span");
      media.className = "recipe-photo-card-media";
      if (recipe.image) {
        const image = document.createElement("img");
        image.src = recipe.image;
        image.alt = "";
        image.loading = "lazy";
        media.append(image);
      } else {
        media.textContent = recipe.category || "Recipe";
      }
      const title = document.createElement("span");
      title.className = "recipe-photo-card-title";
      title.textContent = recipe.title;
      link.append(media, title);
      window.siteHeader.addCardNutrition(title, recipe);
      item.append(link);
      return item;
    }));
  }

  fetch("./data/recipes.json")
    .then((response) => {
      if (!response.ok) throw new Error("Recipe list unavailable");
      return response.json();
    })
    .then((entries) => {
      recipes = entries.filter((recipe) => recipe.published !== false)
        .sort((a, b) => a.title.localeCompare(b.title));
      render();
      subscribe(render);
      window.addEventListener("pageshow", render);
    })
    .catch(() => {
      status.textContent = "Saved recipes could not load. Try refreshing the page.";
    });
})();
