(() => {
  const escapeHtml = (value) => String(value)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

  function ingredientItemsMarkup(groups) {
    const showTitles = groups.length > 1 || groups[0]?.title.trim().toLowerCase() !== "main";
    return groups.map((group) => `
      <div class="ingredient-component">
        ${showTitles ? `<h3>${escapeHtml(group.title)}</h3>` : ""}
        <ul class="ingredient-list">${group.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </div>
    `).join("") || '<div class="empty-state">No ingredients yet.</div>';
  }

  const servingTicks = Array.from({ length: 20 }, (_, index) => `<option value="${(index + 1) / 2}"></option>`).join("");

  function ingredientOverviewMarkup(groups, measureSystem, hasMethod, servings) {
    const hasGroups = groups.length > 0;
    const nextSystem = measureSystem === "us" ? "au" : "us";
    const nextLabel = nextSystem === "us" ? "US" : "AU/UK";
    return `
      <section class="sidebar-card notebook-card ingredient-overview">
        <div class="ingredient-heading">
          <div class="subsection-heading compact"><h2>Ingredients list</h2></div>
          <button class="measure-toggle-button is-${measureSystem}" type="button" data-measure="${nextSystem}"
            aria-label="Switch to ${nextLabel} measurements">
            <span class="measure-label">AU/UK</span>
            <span class="measure-label">US</span>
            <span class="measure-knob" aria-hidden="true"></span>
          </button>
        </div>
        <div class="ingredient-overview-body">
          ${ingredientItemsMarkup(groups)}
        </div>
        ${hasGroups ? `
          <div class="ingredient-actions">
            ${hasMethod ? window.methodQuantities.toggleMarkup() : ""}
            <div class="ingredient-icon-actions">
              <button class="ingredient-scale-button" type="button" data-serving-toggle
                aria-label="Scale servings" title="Scale servings" aria-expanded="false" aria-controls="recipeServingScale">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
                  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M12 3v17M7 21h10M4 7h16M6 7l-4 8a4 4 0 0 0 8 0L6 7ZM18 7l-4 8a4 4 0 0 0 8 0l-4-8ZM2 15h8m4 0h8"/>
                </svg>
              </button>
              <button class="ingredient-copy-button" type="button" aria-label="Copy ingredients list" title="Copy ingredients list">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
                  <path d="M8 4H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1"/>
                  <rect x="8" y="2" width="8" height="4" rx="1"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="recipe-serving-scale" id="recipeServingScale" hidden>
            <div class="recipe-serving-heading">
              <label for="recipeServingSize">Servings</label>
              <span data-serving-value aria-hidden="true">${servings}</span>
            </div>
            <input id="recipeServingSize" type="range" min="0.5" max="10" step="0.5" value="${servings}"
              list="recipeServingTicks" data-serving-slider />
            <datalist id="recipeServingTicks">${servingTicks}</datalist>
            <div class="recipe-serving-limits" aria-hidden="true"><span>½</span><span>10</span></div>
          </div>
          <span class="sr-only" role="status" data-copy-status></span>
        ` : ""}
      </section>
    `;
  }

  async function copyIngredients(event) {
    const button = event.target.closest(".ingredient-copy-button");
    const overview = button?.closest(".ingredient-overview");
    if (!overview) return;

    const status = overview.querySelector("[data-copy-status]");
    const text = Array.from(overview.querySelectorAll(".ingredient-component h3, .ingredient-list li"),
      (element) => element.textContent.trim()).join("\n");
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.readOnly = true;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        try {
          textarea.select();
          if (!document.execCommand("copy")) throw new Error("Clipboard unavailable");
        } finally {
          textarea.remove();
          button.focus({ preventScroll: true });
        }
      }
    } catch {
      status.textContent = "Could not copy the ingredients.";
      return;
    }
    status.textContent = "Ingredients list copied.";
    button.classList.add("is-copied");
    setTimeout(() => button.classList.remove("is-copied"), 1200);
  }

  const preheat = /\bpre[- ]?heat\b/i;
  const bake = /\b(?:bake|roast|broil)\b/i;
  const cooking = /\b(?:bake|roast|broil|grill|simmer|boil|fry|saut[eé]|sear|toast|braise|steam|poach|blanch|smoke|carameli[sz]e|reduce|glaze|melt|microwave|cook)\b/i;
  const heatEquipment = /^(?:heat|warm)\s+(?:up\s+)?(?:a\s+|the\s+|your\s+)?(?:oven|air fryer|pan|skillet|oil|sunflower oil)\b/i;

  function stepType(step, text) {
    if (preheat.test(text) && !cooking.test(text)) return "preheat";
    if (heatEquipment.test(text) && !cooking.test(text)) return "heat";
    if (step?.cook === false) return "";
    if (bake.test(text)) return "bake";
    return step?.cook || cooking.test(text) ? "cook" : "";
  }

  const heatIcon = '<path d="M9 14.8V5a3 3 0 0 1 6 0v9.8a5 5 0 1 1-6 0Z"/><path d="M12 8v9"/><circle cx="12" cy="18" r="1"/>';
  const cookIcon = '<path d="M12 22c-4 0-7-2.6-7-6.4 0-2.6 1.6-4.5 3.4-6.3.2 2.1 1 3 2.1 3.5C10.2 9.6 13.3 7.4 13 3c2.5 2.2 6 6.6 6 12.3 0 4-3 6.7-7 6.7Z"/>';
  const stepLabels = { preheat: "Preheat", heat: "Set up heat", bake: "Bake", cook: "Cook" };

  function stepCardMarkup(step, index, stepText, stepMarkup, className) {
    const type = stepType(step, stepText);
    const equipmentSetup = type === "preheat" || type === "heat";
    return `
      <article class="${className} notebook-card recipe-step"${type ? ` data-step-kind="${equipmentSetup ? "heat" : "cook"}"` : ""}>
        <span class="recipe-step-number" aria-hidden="true">${index + 1}</span>
        <div class="recipe-step-header">
          <h3>Step ${index + 1}</h3>
          ${type ? `<span class="recipe-step-kind">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              ${equipmentSetup ? heatIcon : cookIcon}
            </svg>
            ${stepLabels[type]}
          </span>` : ""}
        </div>
        <p>${stepMarkup}</p>
      </article>
    `;
  }

  function methodItemsMarkup(recipe, getStepText, renderStep) {
    return (recipe.steps || []).map((step, index) => {
      const text = getStepText(step);
      return stepCardMarkup(step, index, text, renderStep(text, index), "step-card");
    }).join("");
  }

  function methodNoteMarkup(recipe) {
    const notes = [
      { text: recipe.methodNote },
      ...(recipe.methodNotes || []),
    ].filter(({ text }) => text?.trim());

    return notes.length ? `
      <section class="recipe-note-box">
        <div class="subsection-heading compact"><h3>Recipe notes</h3></div>
        ${notes.map(({ text, photo }) => `
          <p>${escapeHtml(text)}</p>
          ${photo?.src ? `<img class="recipe-note-photo"
            src="${escapeHtml(photo.src)}" alt="${escapeHtml(photo.alt || "")}"
            loading="lazy" decoding="async" />` : ""}
        `).join("")}
      </section>
    ` : "";
  }

  function bindServingSlider(view, { getRecipe, displayRecipe, buildIngredientGroups, getStepText, buildMethodRenderer }) {
    view?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-serving-toggle]");
      if (!button) return;
      const panel = button.closest(".ingredient-overview").querySelector(".recipe-serving-scale");
      const expanded = panel.hidden;
      panel.hidden = !expanded;
      button.setAttribute("aria-expanded", String(expanded));
    });

    view?.addEventListener("input", (event) => {
      if (!event.target.matches("[data-serving-slider]")) return;
      const recipe = getRecipe();
      if (!recipe) return;
      window.recipeServings.set(recipe.id, event.target.valueAsNumber);
      const scaled = displayRecipe(recipe);
      view.querySelector("[data-serving-value]").textContent = scaled.serves;
      view.querySelector("[data-recipe-serves]").textContent = scaled.serves;
      view.querySelector(".ingredient-overview-body").innerHTML = ingredientItemsMarkup(buildIngredientGroups(scaled.ingredients));
      view.querySelector(".method-section .step-grid").innerHTML = methodItemsMarkup(scaled, getStepText, buildMethodRenderer(scaled));
    });
  }

  document.addEventListener("click", copyIngredients);
  window.recipeCookingUI = { ingredientOverviewMarkup, stepCardMarkup, methodItemsMarkup, methodNoteMarkup, bindServingSlider };
})();
