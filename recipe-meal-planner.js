(() => {
  const dialog = document.getElementById("recipeMealPlanner");
  if (!dialog) return;

  document.getElementById("azRecipeView")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-open-recipe-planner]");
    if (!button || dialog.open) return;

    const { recipeId, recipeTitle } = button.dataset;
    const url = new URL("./recipe-library.html", window.location.href);
    url.searchParams.set("recipe", recipeId);
    if (new URLSearchParams(window.location.search).get("preview") === "1") {
      url.searchParams.set("preview", "1");
    }
    dialog.dispatchEvent(new CustomEvent("recipe-planner:open", {
      detail: { recipeId, recipeTitle, recipeUrl: url.href },
    }));
    dialog.showModal();
  });
})();
