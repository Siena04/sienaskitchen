const DATA = window.SIENA_ADMIN_DATA || {};

const elements = {
  authScreen: document.getElementById("authScreen"),
  authForm: document.getElementById("authForm"),
  authTitle: document.getElementById("authTitle"),
  authEyebrow: document.getElementById("authEyebrow"),
  authCopy: document.getElementById("authCopy"),
  authMessage: document.getElementById("authMessage"),
  authSubmit: document.getElementById("authSubmit"),
  passwordInput: document.getElementById("passwordInput"),
  passwordLabel: document.getElementById("passwordLabel"),
  confirmPasswordField: document.getElementById("confirmPasswordField"),
  confirmPasswordInput: document.getElementById("confirmPasswordInput"),
  togglePassword: document.getElementById("togglePassword"),
  studioApp: document.getElementById("studioApp"),
  logoutButton: document.getElementById("logoutButton"),
  viewTitle: document.getElementById("viewTitle"),
  globalSearchWrap: document.getElementById("globalSearchWrap"),
  recipeSearch: document.getElementById("recipeSearch"),
  newRecipeButton: document.getElementById("newRecipeButtonV2"),
  statusFilter: document.getElementById("statusFilter"),
  categoryFilter: document.getElementById("categoryFilterV2"),
  recipeList: document.getElementById("recipeListV2"),
  visibleRecipeCount: document.getElementById("visibleRecipeCount"),
  allRecipeCount: document.getElementById("allRecipeCount"),
  publishedRecipeCount: document.getElementById("publishedRecipeCount"),
  draftRecipeCount: document.getElementById("draftRecipeCount"),
  editorEmpty: document.getElementById("editorEmpty"),
  editor: document.getElementById("recipeEditorV2"),
  editorRecipeId: document.getElementById("editorRecipeId"),
  editorStatusBadge: document.getElementById("editorStatusBadge"),
  editorSaveMessage: document.getElementById("editorSaveMessage"),
  saveDraftButton: document.getElementById("saveDraftButton"),
  publishRecipeButton: document.getElementById("publishRecipeButton"),
  unpublishRecipeButton: document.getElementById("unpublishRecipeButton"),
  deleteRecipeButton: document.getElementById("deleteRecipeV2"),
  title: document.getElementById("editorTitle"),
  description: document.getElementById("editorDescription"),
  category: document.getElementById("editorCategory"),
  complexity: document.getElementById("editorComplexity"),
  prepTime: document.getElementById("editorPrepTime"),
  cookTime: document.getElementById("editorCookTime"),
  yieldLabel: document.getElementById("editorYieldLabel"),
  recipeYield: document.getElementById("editorYield"),
  tags: document.getElementById("editorTags"),
  notes: document.getElementById("editorNotes"),
  calories: document.getElementById("editorCalories"),
  protein: document.getElementById("editorProtein"),
  carbs: document.getElementById("editorCarbs"),
  fat: document.getElementById("editorFat"),
  coverUploader: document.getElementById("coverUploader"),
  coverUploadButton: document.getElementById("coverUploadButton"),
  coverInput: document.getElementById("coverImageInputV2"),
  coverPreview: document.getElementById("coverPreviewV2"),
  coverPlaceholder: document.getElementById("coverPlaceholderV2"),
  coverStatus: document.getElementById("coverStatusV2"),
  removeCover: document.getElementById("removeCoverV2"),
  ingredientRows: document.getElementById("ingredientRowsV2"),
  ingredientTemplate: document.getElementById("ingredientRowTemplate"),
  addIngredient: document.getElementById("addIngredientV2"),
  addIngredientSection: document.getElementById("addIngredientSectionV2"),
  measurementNote: document.getElementById("measurementNote"),
  methodRows: document.getElementById("methodRowsV2"),
  methodTemplate: document.getElementById("methodRowTemplate"),
  addMethodStep: document.getElementById("addMethodStepV2"),
  macroAssistant: document.getElementById("macroAssistant"),
  openMacroAssistant: document.getElementById("openMacroAssistant"),
  macroIngredientList: document.getElementById("macroIngredientList"),
  macroReadiness: document.getElementById("macroReadiness"),
  macroAssistantMessage: document.getElementById("macroAssistantMessage"),
  calculateMacros: document.getElementById("calculateMacrosV2"),
  featureSearch: document.getElementById("featureSearch"),
  featureRecipeList: document.getElementById("featureRecipeList"),
  currentFeatureCard: document.getElementById("currentFeatureCard"),
  siteContentForm: document.getElementById("siteContentForm"),
  siteHeroTitle: document.getElementById("siteHeroTitle"),
  siteHeroText: document.getElementById("siteHeroText"),
  siteLibraryTitle: document.getElementById("siteLibraryTitle"),
  siteFooterTitle: document.getElementById("siteFooterTitle"),
  categoryManager: document.getElementById("categoryManagerV2"),
  addCategory: document.getElementById("addCategoryV2"),
  toast: document.getElementById("toast"),
};

let studioState = null;
let selectedRecipeId = "";
let authNeedsSetup = false;
let currentMeasurementSystem = "au";
let currentImagePath = "";
let editorDirty = false;
let toastTimer = null;
let draggedMethodRow = null;
let macroOverrides = {};

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stripUnit(value) {
  return String(value || "").replace(/[^0-9.\-]/g, "");
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove("is-visible"), 2600);
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (response.status === 401 && !url.includes("/auth/")) {
    showAuthScreen(false);
  }
  if (!response.ok) {
    throw new Error(payload.error || "Something went wrong.");
  }
  return payload;
}

function configureAuthScreen(needsSetup) {
  authNeedsSetup = needsSetup;
  elements.authEyebrow.textContent = needsSetup ? "First-time setup" : "Private studio";
  elements.authTitle.textContent = needsSetup ? "Create your owner password." : "Welcome back, Siena.";
  elements.authCopy.textContent = needsSetup
    ? "This password protects the new recipe studio. It stays on this computer."
    : "Sign in to manage your recipes and homepage.";
  elements.passwordLabel.textContent = needsSetup ? "Create password" : "Password";
  elements.passwordInput.autocomplete = needsSetup ? "new-password" : "current-password";
  elements.confirmPasswordField.hidden = !needsSetup;
  elements.confirmPasswordInput.required = needsSetup;
  elements.authSubmit.textContent = needsSetup ? "Create private studio" : "Sign in";
  elements.authMessage.textContent = "";
}

function showAuthScreen(needsSetup = authNeedsSetup) {
  configureAuthScreen(needsSetup);
  elements.studioApp.hidden = true;
  elements.authScreen.hidden = false;
  setTimeout(() => elements.passwordInput.focus(), 50);
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const password = elements.passwordInput.value;
  if (authNeedsSetup && password !== elements.confirmPasswordInput.value) {
    elements.authMessage.textContent = "The passwords do not match.";
    return;
  }
  elements.authSubmit.disabled = true;
  elements.authSubmit.textContent = authNeedsSetup ? "Creating..." : "Signing in...";
  try {
    await api(authNeedsSetup ? "/api/admin/auth/setup" : "/api/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
    elements.passwordInput.value = "";
    elements.confirmPasswordInput.value = "";
    await enterStudio();
  } catch (error) {
    elements.authMessage.textContent = error.message;
  } finally {
    elements.authSubmit.disabled = false;
    elements.authSubmit.textContent = authNeedsSetup ? "Create private studio" : "Sign in";
  }
}

async function enterStudio() {
  elements.authScreen.hidden = true;
  elements.studioApp.hidden = false;
  await loadStudioState();
  refreshIcons();
}

async function loadStudioState() {
  const payload = await api("/api/admin/state");
  studioState = payload.state;
  studioState.categories = Array.isArray(studioState.categories) ? studioState.categories : [];
  studioState.recipes = Array.isArray(studioState.recipes) ? studioState.recipes : [];
  renderStudio();
}

function renderStudio() {
  renderRecipeSummary();
  renderCategoryOptions();
  renderRecipeList();
  renderFeatureView();
  renderSiteContent();
}

function renderRecipeSummary() {
  const published = studioState.recipes.filter((recipe) => recipe.status === "published").length;
  elements.allRecipeCount.textContent = studioState.recipes.length;
  elements.publishedRecipeCount.textContent = published;
  elements.draftRecipeCount.textContent = studioState.recipes.length - published;
}

function getFilteredRecipes() {
  const query = elements.recipeSearch.value.trim().toLowerCase();
  const status = elements.statusFilter.value;
  const category = elements.categoryFilter.value;
  return studioState.recipes
    .filter((recipe) => status === "all" || recipe.status === status)
    .filter((recipe) => category === "all" || recipe.category === category)
    .filter((recipe) => {
      if (!query) return true;
      const haystack = [
        recipe.title,
        recipe.category,
        recipe.description,
        ...(recipe.tags || []),
        ...(recipe.ingredients || []),
      ].join(" ").toLowerCase();
      return haystack.includes(query);
    })
    .sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));
}

function renderCategoryOptions() {
  const currentFilter = elements.categoryFilter.value || "all";
  const currentEditor = elements.category.value || "";
  const categories = Array.from(new Set([
    ...studioState.categories,
    ...studioState.recipes.map((recipe) => recipe.category).filter(Boolean),
  ])).sort((a, b) => a.localeCompare(b));
  studioState.categories = categories;

  elements.categoryFilter.innerHTML = '<option value="all">All categories</option>';
  elements.category.innerHTML = '<option value="">Select category</option>';
  categories.forEach((category) => {
    elements.categoryFilter.add(new Option(category, category));
    elements.category.add(new Option(category, category));
  });
  if (categories.includes(currentFilter)) elements.categoryFilter.value = currentFilter;
  if (categories.includes(currentEditor)) elements.category.value = currentEditor;
}

function renderRecipeList() {
  const recipes = getFilteredRecipes();
  elements.visibleRecipeCount.textContent = `${recipes.length} shown`;
  elements.recipeList.innerHTML = "";
  if (!recipes.length) {
    elements.recipeList.innerHTML = '<div class="recipe-list-empty">No recipes match those filters.</div>';
    return;
  }
  recipes.forEach((recipe) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `recipe-list-card${recipe.id === selectedRecipeId ? " is-active" : ""}`;
    const media = recipe.image
      ? `<img src="${escapeHtml(recipe.image)}" alt="" />`
      : '<span class="recipe-list-placeholder"><i data-lucide="utensils"></i></span>';
    button.innerHTML = `
      ${media}
      <span class="recipe-list-copy">
        <strong>${escapeHtml(recipe.title || "Untitled recipe")}</strong>
        <span>${escapeHtml(recipe.category || "Uncategorised")} · ${recipe.status === "published" ? "Published" : "Draft"}</span>
      </span>
      <span class="recipe-list-status ${recipe.status === "published" ? "is-published" : ""}" aria-hidden="true"></span>
    `;
    button.addEventListener("click", () => openRecipe(recipe.id));
    elements.recipeList.append(button);
  });
  refreshIcons();
}

function createBlankRecipe() {
  return {
    id: "",
    title: "",
    category: studioState.categories[0] || "",
    description: "",
    prepTime: "",
    cookTime: "",
    serves: "",
    yieldLabel: "serves",
    complexity: "Easy",
    tags: [],
    nutrition: { calories: "", protein: "", carbs: "", fat: "" },
    image: "",
    ingredients: [],
    ingredientItems: [],
    steps: [],
    notes: "",
    measurementSystem: "au",
    status: "draft",
    macroAssistant: {},
  };
}

function getSelectedRecipe() {
  return studioState.recipes.find((recipe) => recipe.id === selectedRecipeId) || null;
}

function openRecipe(recipeId) {
  if (editorDirty && !window.confirm("Discard your unsaved changes and open another recipe?")) {
    return;
  }
  selectedRecipeId = recipeId;
  const recipe = getSelectedRecipe();
  if (!recipe) return;
  populateEditor(recipe);
  renderRecipeList();
}

function startNewRecipe() {
  if (editorDirty && !window.confirm("Discard your unsaved changes and start a new recipe?")) {
    return;
  }
  selectedRecipeId = "";
  populateEditor(createBlankRecipe());
  renderRecipeList();
}

function updateEditorStatus(recipe) {
  const published = recipe.status === "published";
  elements.editorStatusBadge.textContent = published ? "Published" : "Draft";
  elements.editorStatusBadge.className = `status-badge ${published ? "is-published" : "is-draft"}`;
  elements.publishRecipeButton.innerHTML = published
    ? '<i data-lucide="send"></i> Push changes'
    : '<i data-lucide="send"></i> Publish';
  elements.unpublishRecipeButton.hidden = !published;
  refreshIcons();
}

function populateEditor(recipe) {
  elements.editorEmpty.hidden = true;
  elements.editor.hidden = false;
  elements.editorRecipeId.value = recipe.id || "";
  elements.title.value = recipe.title || "";
  autoResizeTextarea(elements.title);
  elements.description.value = recipe.description || "";
  elements.category.value = recipe.category || "";
  elements.complexity.value = recipe.complexity || "Easy";
  elements.prepTime.value = recipe.prepTime || "";
  elements.cookTime.value = recipe.cookTime || "";
  elements.yieldLabel.value = recipe.yieldLabel || "serves";
  elements.recipeYield.value = recipe.serves || "";
  elements.tags.value = (recipe.tags || []).join(", ");
  elements.notes.value = recipe.notes || "";
  elements.calories.value = stripUnit(recipe.nutrition?.calories);
  elements.protein.value = stripUnit(recipe.nutrition?.protein);
  elements.carbs.value = stripUnit(recipe.nutrition?.carbs);
  elements.fat.value = stripUnit(recipe.nutrition?.fat);
  currentMeasurementSystem = recipe.measurementSystem === "us" ? "us" : "au";
  currentImagePath = recipe.image || "";
  macroOverrides = { ...(recipe.macroAssistant || {}) };
  updateMeasurementToggle();
  setCoverPreview(currentImagePath);
  renderIngredientRows(recipe.ingredientItems?.length ? recipe.ingredientItems : parseIngredientList(recipe.ingredients));
  renderMethodRows(recipe.steps || []);
  updateEditorStatus(recipe);
  setEditorDirty(false);
}

function setEditorDirty(dirty = true) {
  editorDirty = dirty;
  elements.editorSaveMessage.textContent = dirty ? "Unsaved changes" : "No unsaved changes";
}

function autoResizeTextarea(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function parseIngredientList(items) {
  return (items || []).map((item) => {
    const text = String(item || "").trim();
    if (text.endsWith(":")) {
      return { type: "section", name: text.slice(0, -1).trim() };
    }
    const quantityMatch = text.match(/^(\d+(?:\.\d+)?|\d+\/\d+|\d+\s+\d+\/\d+|[¼½¾⅓⅔⅛⅜⅝⅞])(?:\s*[-–]\s*(\d+(?:\.\d+)?|\d+\/\d+))?\s+/);
    let amount = quantityMatch ? quantityMatch[0].trim() : "";
    let remainder = quantityMatch ? text.slice(quantityMatch[0].length) : text;
    const unit = (DATA.units || []).find((candidate) =>
      remainder.toLowerCase().startsWith(`${candidate.toLowerCase()} `)
    );
    if (unit) remainder = remainder.slice(unit.length).trim();
    return { type: "ingredient", amount, unit: unit || "", name: remainder, brand: "" };
  });
}

function buildUnitOptions(selectedValue = "") {
  const options = ['<option value="">—</option>'];
  (DATA.units || []).forEach((unit) => {
    options.push(`<option value="${escapeHtml(unit)}"${unit === selectedValue ? " selected" : ""}>${escapeHtml(unit)}</option>`);
  });
  if (selectedValue && !(DATA.units || []).includes(selectedValue)) {
    options.push(`<option value="${escapeHtml(selectedValue)}" selected>${escapeHtml(selectedValue)}</option>`);
  }
  return options.join("");
}

function renderIngredientRows(items) {
  elements.ingredientRows.innerHTML = "";
  const rows = items?.length ? items : [{ type: "ingredient", amount: "", unit: "", name: "", brand: "" }];
  rows.forEach((item) => addIngredientRow(item, false));
  refreshIcons();
}

function addIngredientRow(item = {}, focus = true) {
  if (item.type === "section") {
    const row = document.createElement("div");
    row.className = "ingredient-section-row";
    row.dataset.rowType = "section";
    row.innerHTML = `
      <input value="${escapeHtml(item.name || "")}" placeholder="Section title, e.g. Pizza sauce" aria-label="Ingredient section title" />
      <button class="row-remove-button" type="button" aria-label="Remove section"><i data-lucide="x"></i></button>
    `;
    row.querySelector("input").addEventListener("input", () => setEditorDirty());
    row.querySelector("button").addEventListener("click", () => {
      row.remove();
      setEditorDirty();
    });
    elements.ingredientRows.append(row);
    if (focus) row.querySelector("input").focus();
    refreshIcons();
    return;
  }

  const fragment = elements.ingredientTemplate.content.cloneNode(true);
  const row = fragment.querySelector(".ingredient-row-v2");
  const amount = row.querySelector(".ingredient-amount");
  const unit = row.querySelector(".ingredient-unit");
  const name = row.querySelector(".ingredient-name");
  const brand = row.querySelector(".ingredient-brand");
  amount.value = item.amount || "";
  unit.innerHTML = buildUnitOptions(item.unit || "");
  name.value = item.name || "";
  brand.value = item.brand || "";
  row.querySelector(".row-remove-button").addEventListener("click", () => {
    row.remove();
    if (!elements.ingredientRows.children.length) addIngredientRow({}, false);
    setEditorDirty();
  });
  row.querySelectorAll("input, select").forEach((input) => {
    input.addEventListener("input", () => setEditorDirty());
    input.addEventListener("change", () => setEditorDirty());
  });
  name.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addIngredientRow({}, true);
    }
  });
  elements.ingredientRows.append(fragment);
  if (focus) amount.focus();
  refreshIcons();
}

function getIngredientItems() {
  return Array.from(elements.ingredientRows.children)
    .map((row) => {
      if (row.dataset.rowType === "section") {
        const name = row.querySelector("input").value.trim();
        return name ? { type: "section", name } : null;
      }
      const name = row.querySelector(".ingredient-name").value.trim();
      const amount = row.querySelector(".ingredient-amount").value.trim();
      const unit = row.querySelector(".ingredient-unit").value;
      const brand = row.querySelector(".ingredient-brand").value.trim();
      return name ? { type: "ingredient", amount, unit, name, brand } : null;
    })
    .filter(Boolean);
}

function serializeIngredientItems(items) {
  return items.map((item) => {
    if (item.type === "section") return `${item.name}:`;
    const brandedName = item.brand ? `${item.name} (${item.brand})` : item.name;
    return [item.amount, item.unit, brandedName].filter(Boolean).join(" ");
  });
}

function updateMeasurementToggle() {
  document.querySelectorAll("[data-measurement]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.measurement === currentMeasurementSystem);
  });
  elements.measurementNote.textContent = currentMeasurementSystem === "au"
    ? "1 AU/UK cup = 250 mL · 1 Tbsp = 20 mL"
    : "1 US cup = 236.6 mL · 1 Tbsp = 14.8 mL";
}

function renderMethodRows(steps) {
  elements.methodRows.innerHTML = "";
  const values = steps?.length ? steps : [""];
  values.forEach((step) => addMethodRow(typeof step === "object" ? step.text || "" : step, false));
  renumberMethodRows();
  refreshIcons();
}

function addMethodRow(value = "", focus = true) {
  const fragment = elements.methodTemplate.content.cloneNode(true);
  const row = fragment.querySelector(".method-row-v2");
  const textarea = row.querySelector("textarea");
  textarea.value = value;
  textarea.addEventListener("input", () => {
    autoResizeTextarea(textarea);
    setEditorDirty();
  });
  textarea.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      addMethodRow("", true);
    }
  });
  row.querySelector(".row-remove-button").addEventListener("click", () => {
    row.remove();
    if (!elements.methodRows.children.length) addMethodRow("", false);
    renumberMethodRows();
    setEditorDirty();
  });
  row.addEventListener("dragstart", (event) => {
    draggedMethodRow = row;
    row.classList.add("is-dragging");
    event.dataTransfer.effectAllowed = "move";
  });
  row.addEventListener("dragend", () => {
    row.classList.remove("is-dragging");
    draggedMethodRow = null;
    renumberMethodRows();
    setEditorDirty();
  });
  row.addEventListener("dragover", (event) => {
    event.preventDefault();
    if (!draggedMethodRow || draggedMethodRow === row) return;
    const box = row.getBoundingClientRect();
    const after = event.clientY > box.top + box.height / 2;
    elements.methodRows.insertBefore(draggedMethodRow, after ? row.nextSibling : row);
  });
  elements.methodRows.append(fragment);
  autoResizeTextarea(textarea);
  renumberMethodRows();
  if (focus) textarea.focus();
  refreshIcons();
}

function renumberMethodRows() {
  Array.from(elements.methodRows.children).forEach((row, index) => {
    row.querySelector(".method-number").textContent = index + 1;
  });
}

function getMethodSteps() {
  return Array.from(elements.methodRows.querySelectorAll("textarea"))
    .map((textarea) => textarea.value.trim())
    .filter(Boolean);
}

function setCoverPreview(path) {
  currentImagePath = path || "";
  elements.coverPreview.hidden = !currentImagePath;
  elements.coverPlaceholder.hidden = Boolean(currentImagePath);
  elements.removeCover.hidden = !currentImagePath;
  if (currentImagePath) {
    elements.coverPreview.src = currentImagePath;
    elements.coverStatus.textContent = "Image ready";
  } else {
    elements.coverPreview.removeAttribute("src");
    elements.coverStatus.textContent = "No image selected";
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Unable to read that image."));
    reader.readAsDataURL(file);
  });
}

async function uploadCoverImage(file) {
  if (!file || !file.type.startsWith("image/")) {
    showToast("Choose an image file.");
    return;
  }
  elements.coverStatus.textContent = "Uploading...";
  elements.coverUploadButton.disabled = true;
  try {
    const dataUrl = await readFileAsDataUrl(file);
    elements.coverPreview.src = dataUrl;
    elements.coverPreview.hidden = false;
    elements.coverPlaceholder.hidden = true;
    const payload = await api("/api/admin/upload", {
      method: "POST",
      body: JSON.stringify({
        dataUrl,
        recipeId: elements.editorRecipeId.value || slugify(elements.title.value),
        title: elements.title.value,
        filename: file.name,
      }),
    });
    setCoverPreview(payload.path);
    setEditorDirty();
    showToast("Cover image uploaded.");
  } catch (error) {
    elements.coverStatus.textContent = "Upload failed";
    showToast(error.message);
  } finally {
    elements.coverUploadButton.disabled = false;
  }
}

function collectRecipeFromEditor() {
  const ingredientItems = getIngredientItems();
  const existing = getSelectedRecipe();
  const title = elements.title.value.trim();
  return {
    ...(existing || {}),
    id: elements.editorRecipeId.value || `${slugify(title) || "recipe"}-${Date.now().toString(36)}`,
    title,
    category: elements.category.value,
    description: elements.description.value.trim(),
    prepTime: elements.prepTime.value.trim(),
    cookTime: elements.cookTime.value.trim(),
    serves: elements.recipeYield.value.trim(),
    yieldLabel: elements.yieldLabel.value,
    complexity: elements.complexity.value,
    tags: elements.tags.value.split(",").map((tag) => tag.trim()).filter(Boolean),
    nutrition: {
      calories: elements.calories.value.trim(),
      protein: elements.protein.value.trim() ? `${elements.protein.value.trim()}g` : "",
      carbs: elements.carbs.value.trim() ? `${elements.carbs.value.trim()}g` : "",
      fat: elements.fat.value.trim() ? `${elements.fat.value.trim()}g` : "",
    },
    image: currentImagePath,
    ingredients: serializeIngredientItems(ingredientItems),
    ingredientItems,
    steps: getMethodSteps(),
    notes: elements.notes.value.trim(),
    measurementSystem: currentMeasurementSystem,
    status: existing?.status || "draft",
    macroAssistant: macroOverrides,
  };
}

async function saveRecipeDraft(options = {}) {
  const recipe = collectRecipeFromEditor();
  if (!recipe.title) {
    elements.title.focus();
    showToast("Add a recipe title before saving.");
    return null;
  }
  elements.saveDraftButton.disabled = true;
  elements.editorSaveMessage.textContent = "Saving...";
  try {
    const payload = await api("/api/admin/recipe/save", {
      method: "POST",
      body: JSON.stringify({ recipe }),
    });
    const index = studioState.recipes.findIndex((entry) => entry.id === payload.recipe.id);
    if (index >= 0) studioState.recipes[index] = payload.recipe;
    else studioState.recipes.unshift(payload.recipe);
    selectedRecipeId = payload.recipe.id;
    elements.editorRecipeId.value = payload.recipe.id;
    setEditorDirty(false);
    elements.editorSaveMessage.textContent = payload.recipe.status === "published"
      ? "Draft changes saved · not pushed yet"
      : "Draft saved";
    renderRecipeSummary();
    renderCategoryOptions();
    renderRecipeList();
    renderFeatureView();
    if (!options.silent) showToast("Recipe saved as a draft.");
    return payload.recipe;
  } catch (error) {
    elements.editorSaveMessage.textContent = "Save failed";
    showToast(error.message);
    return null;
  } finally {
    elements.saveDraftButton.disabled = false;
  }
}

async function publishSelectedRecipe(publish = true) {
  const saved = await saveRecipeDraft({ silent: true });
  if (!saved) return;
  elements.publishRecipeButton.disabled = true;
  elements.editorSaveMessage.textContent = publish ? "Publishing..." : "Removing from public site...";
  try {
    const payload = await api("/api/admin/recipe/publish", {
      method: "POST",
      body: JSON.stringify({ recipeId: saved.id, publish }),
    });
    studioState = payload.state;
    selectedRecipeId = saved.id;
    const recipe = getSelectedRecipe();
    populateEditor(recipe);
    renderStudio();
    showToast(publish ? "Recipe published to the main site." : "Recipe moved back to draft.");
  } catch (error) {
    showToast(error.message);
  } finally {
    elements.publishRecipeButton.disabled = false;
  }
}

async function deleteSelectedRecipe() {
  const recipe = getSelectedRecipe();
  if (!recipe) {
    elements.editor.hidden = true;
    elements.editorEmpty.hidden = false;
    return;
  }
  if (!window.confirm(`Delete “${recipe.title}”? This cannot be undone.`)) return;
  try {
    const payload = await api(`/api/admin/recipe?id=${encodeURIComponent(recipe.id)}`, {
      method: "DELETE",
    });
    studioState = payload.state;
    selectedRecipeId = "";
    elements.editor.hidden = true;
    elements.editorEmpty.hidden = false;
    setEditorDirty(false);
    renderStudio();
    showToast("Recipe deleted.");
  } catch (error) {
    showToast(error.message);
  }
}

function renderFeatureView() {
  if (!studioState) return;
  const current = studioState.recipes.find((recipe) => recipe.id === studioState.featuredRecipeId);
  if (current) {
    const media = current.image
      ? `<img src="${escapeHtml(current.image)}" alt="" />`
      : '<div class="current-feature-placeholder"><i data-lucide="star"></i></div>';
    elements.currentFeatureCard.innerHTML = `
      <article>
        ${media}
        <div class="current-feature-copy">
          <span>Currently featured</span>
          <h3>${escapeHtml(current.title)}</h3>
        </div>
      </article>
    `;
  } else {
    elements.currentFeatureCard.innerHTML = '<p class="section-copy">No recipe is featured yet.</p>';
  }

  const query = elements.featureSearch.value.trim().toLowerCase();
  const published = studioState.recipes
    .filter((recipe) => recipe.status === "published")
    .filter((recipe) => !query || `${recipe.title} ${recipe.category}`.toLowerCase().includes(query))
    .sort((a, b) => String(a.title).localeCompare(String(b.title)));
  elements.featureRecipeList.innerHTML = "";
  published.forEach((recipe) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `feature-choice-card${recipe.id === studioState.featuredRecipeId ? " is-current" : ""}`;
    button.innerHTML = `
      ${recipe.image
        ? `<img src="${escapeHtml(recipe.image)}" alt="" />`
        : '<span class="feature-choice-placeholder"></span>'}
      <span><strong>${escapeHtml(recipe.title)}</strong><span>${escapeHtml(recipe.category || "Recipe")}</span></span>
    `;
    button.addEventListener("click", () => setFeaturedRecipe(recipe.id));
    elements.featureRecipeList.append(button);
  });
  refreshIcons();
}

async function setFeaturedRecipe(recipeId) {
  try {
    const payload = await api("/api/admin/featured", {
      method: "POST",
      body: JSON.stringify({ recipeId }),
    });
    studioState = payload.state;
    renderFeatureView();
    showToast("Recipe of the week updated.");
  } catch (error) {
    showToast(error.message);
  }
}

function renderSiteContent() {
  if (!studioState) return;
  const content = studioState.siteContent || {};
  elements.siteHeroTitle.value = content.heroTitle || "";
  elements.siteHeroText.value = content.heroText || "";
  elements.siteLibraryTitle.value = content.libraryTitle || "";
  elements.siteFooterTitle.value = content.footerTitle || "";
  renderCategoryManager();
}

function renderCategoryManager() {
  elements.categoryManager.innerHTML = "";
  studioState.categories.forEach((category) => {
    const row = document.createElement("div");
    row.className = "category-row-v2";
    const input = document.createElement("input");
    input.value = category;
    input.setAttribute("aria-label", `Rename ${category}`);
    const save = document.createElement("button");
    save.type = "button";
    save.className = "secondary-button";
    save.textContent = "Save";
    save.addEventListener("click", () => renameCategory(category, input.value));
    row.append(input, save);
    elements.categoryManager.append(row);
  });
}

async function renameCategory(previous, nextValue) {
  const next = nextValue.trim();
  if (!next) {
    showToast("Category names cannot be empty.");
    return;
  }
  if (previous !== next && studioState.categories.some((category) => category.toLowerCase() === next.toLowerCase())) {
    showToast("That category already exists.");
    return;
  }
  const categories = studioState.categories.map((category) => category === previous ? next : category);
  try {
    const payload = await api("/api/admin/site", {
      method: "POST",
      body: JSON.stringify({ categories, categoryRenames: { [previous]: next } }),
    });
    studioState = payload.state;
    renderStudio();
    showToast("Category renamed across all recipes.");
  } catch (error) {
    showToast(error.message);
  }
}

async function addCategory() {
  const name = window.prompt("New category name?");
  const category = name?.trim();
  if (!category) return;
  if (studioState.categories.some((entry) => entry.toLowerCase() === category.toLowerCase())) {
    showToast("That category already exists.");
    return;
  }
  try {
    const payload = await api("/api/admin/site", {
      method: "POST",
      body: JSON.stringify({ categories: [...studioState.categories, category] }),
    });
    studioState = payload.state;
    renderStudio();
    showToast("Category added.");
  } catch (error) {
    showToast(error.message);
  }
}

async function saveSiteContent(event) {
  event.preventDefault();
  try {
    const payload = await api("/api/admin/site", {
      method: "POST",
      body: JSON.stringify({
        siteContent: {
          heroTitle: elements.siteHeroTitle.value.trim(),
          heroText: elements.siteHeroText.value.trim(),
          libraryTitle: elements.siteLibraryTitle.value.trim(),
          footerTitle: elements.siteFooterTitle.value.trim(),
        },
      }),
    });
    studioState = payload.state;
    showToast("Homepage content updated.");
  } catch (error) {
    showToast(error.message);
  }
}

function normalizeIngredientName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/\b(minced|diced|chopped|sliced|grated|packed|softened|melted|raw|cooked|large|small|medium|fresh|dried)\b/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumericAmount(value) {
  const text = String(value || "").trim().replace(/[¼½¾⅓⅔⅛⅜⅝⅞]/g, (character) => ({
    "¼": " 1/4", "½": " 1/2", "¾": " 3/4", "⅓": " 1/3", "⅔": " 2/3",
    "⅛": " 1/8", "⅜": " 3/8", "⅝": " 5/8", "⅞": " 7/8",
  })[character]);
  if (!text) return 0;
  const first = text.split(/\s*[-–]\s*/)[0];
  return first.split(/\s+/).reduce((total, part) => {
    if (part.includes("/")) {
      const [top, bottom] = part.split("/").map(Number);
      return total + (bottom ? top / bottom : 0);
    }
    return total + (Number(part) || 0);
  }, 0);
}

function findDataMatch(collection, name) {
  const normalized = normalizeIngredientName(name);
  return Object.keys(collection || {})
    .sort((a, b) => b.length - a.length)
    .find((key) => normalized.includes(key));
}

function isNegligibleIngredient(name) {
  const normalized = normalizeIngredientName(name);
  return (DATA.negligiblePatterns || []).some((pattern) => normalized.includes(pattern));
}

function isPackagedIngredient(name) {
  const normalized = normalizeIngredientName(name);
  return (DATA.packagedPatterns || []).some((pattern) => normalized.includes(pattern));
}

function ingredientWeightInGrams(item) {
  const amount = parseNumericAmount(item.amount);
  if (!amount) return 0;
  const unit = String(item.unit || "").toLowerCase();
  const normalizedName = normalizeIngredientName(item.name);
  const densityKey = findDataMatch(DATA.densities, normalizedName);
  const density = densityKey ? DATA.densities[densityKey] : 1;
  if (unit === "g") return amount;
  if (unit === "kg") return amount * 1000;
  if (unit === "ml") return amount * density;
  if (unit === "l") return amount * 1000 * density;
  if (unit === "cup") return amount * (currentMeasurementSystem === "us" ? 236.588 : 250) * density;
  if (unit === "tbsp") return amount * (currentMeasurementSystem === "us" ? 14.7868 : 20) * density;
  if (unit === "tsp") return amount * 5 * density;
  const countKey = findDataMatch(DATA.countWeights, normalizedName);
  if (countKey) return amount * DATA.countWeights[countKey];
  return 0;
}

function getMacroKey(item, index) {
  return `${index}-${slugify(item.name)}`;
}

function classifyMacroIngredient(item) {
  if (isNegligibleIngredient(item.name)) return "skipped";
  if (isPackagedIngredient(item.name) || item.brand) return "needed";
  const nutrientKey = findDataMatch(DATA.nutrients, item.name);
  const grams = ingredientWeightInGrams(item);
  return nutrientKey && grams > 0 ? "ready" : "unknown";
}

function renderMacroAssistant() {
  const items = getIngredientItems().filter((item) => item.type === "ingredient");
  elements.macroIngredientList.innerHTML = "";
  if (!items.length) {
    elements.macroIngredientList.innerHTML = '<p class="section-copy">Add ingredients before calculating macros.</p>';
    elements.calculateMacros.disabled = true;
    return;
  }
  let needsDetails = 0;
  items.forEach((item, index) => {
    const classification = classifyMacroIngredient(item);
    if (classification === "needed" || classification === "unknown") needsDetails += 1;
    const key = getMacroKey(item, index);
    const saved = macroOverrides[key] || {};
    const estimatedGrams = ingredientWeightInGrams(item);
    const card = document.createElement("article");
    card.className = `macro-ingredient-card is-${classification}`;
    const statusText = classification === "ready"
      ? "Ready"
      : classification === "skipped"
        ? "Negligible"
        : classification === "needed"
          ? "Brand needed"
          : "Review";
    card.innerHTML = `
      <div class="macro-card-heading">
        <span>
          <strong>${escapeHtml([item.amount, item.unit, item.name].filter(Boolean).join(" "))}</strong>
          <span>${classification === "ready" ? `${Math.round(estimatedGrams)} g estimated` : classification === "skipped" ? "Excluded from calculation" : classification === "needed" ? "Enter this brand's package label per 100 g" : "Enter a reliable value per 100 g"}</span>
        </span>
        <span class="macro-status-label">${statusText}</span>
      </div>
    `;
    if (classification === "needed" || classification === "unknown") {
      const fields = document.createElement("div");
      fields.className = "macro-brand-fields";
      fields.innerHTML = `
        <label>${classification === "needed" ? "Brand / product" : "Source (optional)"}<input data-field="brand" value="${escapeHtml(saved.brand || item.brand || "")}" placeholder="${classification === "needed" ? "e.g. Chobani Fit" : "Optional"}" /></label>
        <label>Grams used<input data-field="grams" inputmode="decimal" value="${escapeHtml(saved.grams || (estimatedGrams ? Math.round(estimatedGrams) : ""))}" /></label>
        <label>Calories / 100g<input data-field="calories" inputmode="decimal" value="${escapeHtml(saved.calories || "")}" /></label>
        <label>Protein / 100g<input data-field="protein" inputmode="decimal" value="${escapeHtml(saved.protein || "")}" /></label>
        <label>Carbs / 100g<input data-field="carbs" inputmode="decimal" value="${escapeHtml(saved.carbs || "")}" /></label>
        <label>Fat / 100g<input data-field="fat" inputmode="decimal" value="${escapeHtml(saved.fat || "")}" /></label>
      `;
      fields.querySelectorAll("input").forEach((input) => {
        input.addEventListener("input", () => {
          macroOverrides[key] = {
            ...(macroOverrides[key] || {}),
            [input.dataset.field]: input.value,
          };
          updateMacroReadiness(items);
          setEditorDirty();
        });
      });
      card.append(fields);
    }
    elements.macroIngredientList.append(card);
  });
  elements.calculateMacros.disabled = false;
  elements.macroReadiness.textContent = needsDetails
    ? `${needsDetails} ingredient${needsDetails === 1 ? " needs" : "s need"} brand or label details`
    : "Everything is ready to calculate";
  elements.macroAssistantMessage.textContent = "Spices and tiny seasoning amounts are ignored.";
}

function updateMacroReadiness(items) {
  const incomplete = items.filter((item, index) => {
    const classification = classifyMacroIngredient(item);
    if (classification !== "needed" && classification !== "unknown") return false;
    const saved = macroOverrides[getMacroKey(item, index)] || {};
    const missingBrand = classification === "needed" && !saved.brand;
    return missingBrand || !saved.grams || !saved.calories || saved.protein === "" || saved.carbs === "" || saved.fat === "";
  }).length;
  elements.macroReadiness.textContent = incomplete
    ? `${incomplete} ingredient${incomplete === 1 ? " still needs" : "s still need"} details`
    : "Everything is ready to calculate";
}

function calculateRecipeMacros() {
  const items = getIngredientItems().filter((item) => item.type === "ingredient");
  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const incomplete = [];

  items.forEach((item, index) => {
    const classification = classifyMacroIngredient(item);
    if (classification === "skipped") return;
    let grams = ingredientWeightInGrams(item);
    let nutrients = null;
    if (classification === "ready") {
      const key = findDataMatch(DATA.nutrients, item.name);
      nutrients = key ? DATA.nutrients[key] : null;
    } else {
      const saved = macroOverrides[getMacroKey(item, index)] || {};
      grams = Number(saved.grams);
      const brandMissing = classification === "needed" && !saved.brand;
      if (brandMissing || !grams || saved.calories === "" || saved.protein === "" || saved.carbs === "" || saved.fat === "") {
        incomplete.push(item.name);
        return;
      }
      nutrients = {
        calories: Number(saved.calories),
        protein: Number(saved.protein),
        carbs: Number(saved.carbs),
        fat: Number(saved.fat),
      };
    }
    if (!nutrients || !grams) {
      incomplete.push(item.name);
      return;
    }
    const factor = grams / 100;
    Object.keys(totals).forEach((macro) => {
      totals[macro] += (Number(nutrients[macro]) || 0) * factor;
    });
  });

  if (incomplete.length) {
    elements.macroAssistantMessage.textContent = `Add details for: ${incomplete.slice(0, 3).join(", ")}${incomplete.length > 3 ? "..." : ""}`;
    showToast("Some ingredients still need brand or weight details.");
    return;
  }
  const servings = Math.max(1, Number(elements.recipeYield.value) || 1);
  elements.calories.value = Math.round(totals.calories / servings);
  elements.protein.value = (totals.protein / servings).toFixed(1).replace(/\.0$/, "");
  elements.carbs.value = (totals.carbs / servings).toFixed(1).replace(/\.0$/, "");
  elements.fat.value = (totals.fat / servings).toFixed(1).replace(/\.0$/, "");
  setEditorDirty();
  closeMacroAssistant();
  showToast(`Macros calculated per ${elements.yieldLabel.value === "makes" ? "item" : "serving"}.`);
}

function openMacroAssistant() {
  renderMacroAssistant();
  elements.macroAssistant.classList.add("is-open");
  elements.macroAssistant.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  refreshIcons();
}

function closeMacroAssistant() {
  elements.macroAssistant.classList.remove("is-open");
  elements.macroAssistant.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function switchView(viewName) {
  document.querySelectorAll(".studio-nav-item").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === viewName);
  });
  document.querySelectorAll(".studio-view").forEach((view) => view.classList.remove("is-active"));
  document.getElementById(`${viewName}View`)?.classList.add("is-active");
  const titles = { recipes: "Your recipes", weekly: "Recipe of the week", site: "Site content" };
  elements.viewTitle.textContent = titles[viewName] || "Recipe studio";
  elements.globalSearchWrap.hidden = viewName !== "recipes";
  elements.newRecipeButton.hidden = viewName !== "recipes";
  if (viewName === "weekly") renderFeatureView();
  if (viewName === "site") renderSiteContent();
}

function bindEvents() {
  elements.authForm.addEventListener("submit", handleAuthSubmit);
  elements.togglePassword.addEventListener("click", () => {
    const nextType = elements.passwordInput.type === "password" ? "text" : "password";
    elements.passwordInput.type = nextType;
    elements.confirmPasswordInput.type = nextType;
    elements.togglePassword.setAttribute("aria-label", nextType === "text" ? "Hide password" : "Show password");
  });
  elements.logoutButton.addEventListener("click", async () => {
    await api("/api/admin/auth/logout", { method: "POST", body: "{}" }).catch(() => null);
    showAuthScreen(false);
  });

  document.querySelectorAll(".studio-nav-item").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });
  document.querySelectorAll('[data-action="new-recipe"]').forEach((button) => {
    button.addEventListener("click", startNewRecipe);
  });
  elements.newRecipeButton.addEventListener("click", startNewRecipe);
  elements.recipeSearch.addEventListener("input", renderRecipeList);
  elements.statusFilter.addEventListener("change", renderRecipeList);
  elements.categoryFilter.addEventListener("change", renderRecipeList);
  elements.featureSearch.addEventListener("input", renderFeatureView);

  elements.editor.addEventListener("submit", (event) => {
    event.preventDefault();
    saveRecipeDraft();
  });
  elements.editor.addEventListener("input", (event) => {
    if (event.target === elements.title) autoResizeTextarea(elements.title);
    setEditorDirty();
  });
  elements.editor.addEventListener("change", () => setEditorDirty());
  elements.publishRecipeButton.addEventListener("click", () => publishSelectedRecipe(true));
  elements.unpublishRecipeButton.addEventListener("click", () => {
    if (window.confirm("Remove this recipe from the public website and keep it as a draft?")) {
      publishSelectedRecipe(false);
    }
  });
  elements.deleteRecipeButton.addEventListener("click", deleteSelectedRecipe);

  elements.addIngredient.addEventListener("click", () => addIngredientRow({}, true));
  elements.addIngredientSection.addEventListener("click", () => addIngredientRow({ type: "section", name: "" }, true));
  elements.addMethodStep.addEventListener("click", () => addMethodRow("", true));
  document.querySelectorAll("[data-measurement]").forEach((button) => {
    button.addEventListener("click", () => {
      currentMeasurementSystem = button.dataset.measurement;
      updateMeasurementToggle();
      setEditorDirty();
    });
  });

  elements.coverUploadButton.addEventListener("click", () => elements.coverInput.click());
  elements.coverInput.addEventListener("change", () => uploadCoverImage(elements.coverInput.files?.[0]));
  ["dragenter", "dragover"].forEach((eventName) => {
    elements.coverUploadButton.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.coverUploadButton.classList.add("is-dragging");
    });
  });
  ["dragleave", "drop"].forEach((eventName) => {
    elements.coverUploadButton.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.coverUploadButton.classList.remove("is-dragging");
    });
  });
  elements.coverUploadButton.addEventListener("drop", (event) => {
    uploadCoverImage(event.dataTransfer?.files?.[0]);
  });
  elements.removeCover.addEventListener("click", () => {
    setCoverPreview("");
    setEditorDirty();
  });

  elements.openMacroAssistant.addEventListener("click", openMacroAssistant);
  document.querySelectorAll('[data-action="close-macro"]').forEach((button) => {
    button.addEventListener("click", closeMacroAssistant);
  });
  elements.calculateMacros.addEventListener("click", calculateRecipeMacros);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && elements.macroAssistant.classList.contains("is-open")) {
      closeMacroAssistant();
    }
  });

  elements.siteContentForm.addEventListener("submit", saveSiteContent);
  elements.addCategory.addEventListener("click", addCategory);
  window.addEventListener("beforeunload", (event) => {
    if (!editorDirty) return;
    event.preventDefault();
    event.returnValue = "";
  });
}

async function init() {
  bindEvents();
  refreshIcons();
  try {
    const status = await api("/api/admin/auth/status");
    if (status.authenticated) {
      await enterStudio();
    } else {
      showAuthScreen(status.needsSetup);
    }
  } catch (error) {
    configureAuthScreen(false);
    elements.authMessage.textContent = "The studio server is not available yet. Refresh in a moment.";
  }
}

init();
