const PREVIEW_STORAGE_KEY = "recipe-site-draft";
const CURATED_RECIPE_SERIES = new Map([
  ["my-picks", new Set(["greek-sheet-pan-chicken"])],
  ["christmas", new Set(["mr-beans-apple-snaps", "mini-beef-wellington", "garlic-milk-bread"])],
]);

const listScroll = document.getElementById("azListScroll");
const listContainer = document.getElementById("azList");
const viewContainer = document.getElementById("azRecipeView");
const recipePageHeading = document.getElementById("recipePageHeading");
const saveToast = document.getElementById("recipeSaveToast");
const searchInput = document.getElementById("azSearchInput");
const seriesFilter = document.getElementById("azSeriesFilter");
const suggestions = document.getElementById("azSuggestions");
const scrollBar = document.getElementById("azScrollbar");
const scrollThumb = document.getElementById("azScrollThumb");
const scrollLetter = document.getElementById("azScrollLetter");
const cookOverlay = document.getElementById("cookOverlay");
const cookOverlayContent = document.getElementById("cookOverlayContent");
const cookPrevButton = document.getElementById("cookPrev");
const cookNextButton = document.getElementById("cookNext");

let allRecipes = [];
let filteredRecipes = [];
let selectedRecipeId = null;
let activeCategory = "";
let lockedSeries = "";
let collectionTitle = "";
let standaloneRecipeView = false;
let letterMarkers = [];
let measurementSystem = "au";
let cookStepIndex = 0;
let saveToastTimer;

function isRecipePublished(recipe) {
  return recipe?.published !== false;
}

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

async function loadRecipes() {
  const params = new URLSearchParams(window.location.search);
  const previewRecipes = loadPreviewRecipes();
  if (params.get("preview") === "1" && previewRecipes.length) {
    return previewRecipes.filter(isRecipePublished);
  }

  try {
    const response = await fetch("./data/recipes.json");
    if (!response.ok) {
      throw new Error("Unable to load recipes.json");
    }
    return (await response.json()).filter(isRecipePublished);
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

const COOKING_PATTERNS = [
  /\bpreheat\b/,
  /\bbake\b/,
  /\broast\b/,
  /\bbroil\b/,
  /\bgrill\b/,
  /\bsimmer\b/,
  /\bboil\b/,
  /\bfry\b/,
  /\bsaute\b/,
  /\bsauté\b/,
  /\bstir[- ]?fry\b/,
  /\bair\s?fry\b/,
  /\bsear\b/,
  /\btoast\b/,
  /\bbraise\b/,
  /\bsteam\b/,
  /\bpoach\b/,
  /\bblanch\b/,
  /\bsmoke\b/,
  /\bcarameliz(e|ing)\b/,
  /\breduce\b/,
  /\bglaze\b/,
  /\bmelt\b/,
];

const COOK_CONTEXT_PATTERN = /\bcook(ing)?\s+(for|until|over|on|in|at)\b/;
const HEAT_CONTEXT_PATTERN = /\b(oven|stove|stovetop|cooktop|heat|heated|microwave)\b/;
const COOK_ACTION_PATTERN =
  /\b(cook|bake|roast|simmer|boil|fry|grill|broil|reduce|heat)\b/;

function isCookingInstruction(text) {
  const normalized = normalizeText(text);
  if (!normalized) {
    return false;
  }
  if (COOKING_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return true;
  }
  if (COOK_CONTEXT_PATTERN.test(normalized)) {
    return true;
  }
  const hasTime = /\b\d+\s?(mins?|minutes?|hrs?|hours?)\b/.test(normalized);
  const hasTemp =
    /\b\d{2,3}\s?°\s?[cf]?\b/.test(normalized) ||
    /\b\d{2,3}\s?(c|f|celsius|fahrenheit)\b/.test(normalized);
  if ((hasTime || hasTemp) && (HEAT_CONTEXT_PATTERN.test(normalized) || COOK_ACTION_PATTERN.test(normalized))) {
    return true;
  }
  return false;
}

function getStepText(step) {
  if (step && typeof step === "object") {
    return String(step.text ?? step.value ?? "");
  }
  return String(step || "");
}

function isCookStep(step) {
  if (step && typeof step === "object" && typeof step.cook === "boolean") {
    return step.cook;
  }
  return isCookingInstruction(getStepText(step));
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const INGREDIENT_MATCH_STOP_WORDS = new Set([
  "about",
  "approximately",
  "and",
  "as",
  "at",
  "before",
  "each",
  "extra",
  "for",
  "from",
  "if",
  "in",
  "into",
  "more",
  "of",
  "on",
  "or",
  "over",
  "plus",
  "remove",
  "the",
  "then",
  "thinly",
  "to",
  "top",
  "under",
  "until",
  "with",
  "desired",
  "needed",
  "taste",
  "halved",
  "pitted",
  "sliced",
  "juiced",
  "minced",
  "diced",
  "chopped",
  "cubed",
  "softened",
  "melted",
  "packed",
  "room",
  "temperature",
  "freshly",
  "finely",
  "crosswise",
  "shows",
  "middle",
  "centre",
  "center",
  "seeds",
  "press",
  "pressed",
  "firmly",
  "topping",
  "toppings",
  "wedge",
  "wedges",
  "baking",
  "plain",
  "white",
  "brown",
  "red",
  "yellow",
  "low",
  "fat",
  "dried",
  "whole",
  "light",
  "lite",
  "cake",
  "coarse",
  "gala",
  "cherry",
  "grape",
  "tinned",
  "sodium",
  "italian",
]);

const INGREDIENT_SYNONYMS = [
  { source: ["spud", "spud lite"], aliases: ["potato", "potatoes"] },
  { source: ["courgette"], aliases: ["zucchini"] },
  { source: ["aubergine"], aliases: ["eggplant"] },
  { source: ["capsicum"], aliases: ["bell pepper"] },
  { source: ["coriander"], aliases: ["cilantro"] },
  { source: ["rocket"], aliases: ["arugula"] },
  { source: ["prawns"], aliases: ["shrimp"] },
  { source: ["beetroot"], aliases: ["beet", "beets"] },
  { source: ["spring onion", "spring onions"], aliases: ["green onion", "scallion"] },
  { source: ["icing sugar"], aliases: ["powdered sugar", "confectioners sugar"] },
  { source: ["caster sugar"], aliases: ["superfine sugar"] },
];

function addIngredientSynonymTerms(terms, normalized) {
  const sourceText = ` ${normalized} `;

  INGREDIENT_SYNONYMS.forEach(({ source, aliases }) => {
    if (!source.some((term) => sourceText.includes(` ${term} `))) {
      return;
    }
    aliases.forEach((alias) => terms.add(alias));
  });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function addIngredientMatchWord(terms, word) {
  if (word.length < 3 || INGREDIENT_MATCH_STOP_WORDS.has(word)) {
    return;
  }

  terms.add(word);
  if (word.endsWith("ies") && word.length > 4) {
    terms.add(`${word.slice(0, -3)}y`);
  }
}

function buildIngredientMatchTerms(ingredients) {
  const terms = new Set();

  (ingredients || []).forEach((item) => {
    const components = String(item || "")
      .replace(/\([^)]*\)/g, " ")
      .split(",");

    components.forEach((component) => {
      component
        .split(/\s+(?:and|or)\s+/i)
        .map((part) => normalizeIngredientForMatch(part))
        .forEach((normalized) => {
          const rawWords = normalized.split(" ").filter(Boolean);
          addIngredientSynonymTerms(terms, normalized);
          const words = normalized
            .split(" ")
            .filter((word) => word && !INGREDIENT_MATCH_STOP_WORDS.has(word));

          if (!rawWords.length || !words.length) {
            return;
          }

          if (rawWords.length > 1) {
            terms.add(rawWords.join(" "));
          }
          const ingredientName = words.join(" ");
          terms.add(ingredientName);
          words.forEach((word) => addIngredientMatchWord(terms, word));
        });
    });
  });

  return [...terms].sort((a, b) => b.length - a.length);
}

function buildMethodRenderer(recipe) {
  return window.methodQuantities.makeRenderer(
    buildIngredientGroups(recipe.ingredients),
    (recipe.steps || []).map(getStepText),
    normalizeIngredientForMatch,
    escapeHtml
  );
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

const MEASUREMENT_STORAGE_KEY = "recipe-site-measurement-v2";
const MEASUREMENT_SYSTEMS = {
  us: { label: "US", cupMl: 236.588, tbspMl: 14.7868, tspMl: 5 },
  au: { label: "AU/UK", cupMl: 250, tbspMl: 20, tspMl: 5 },
};
const MEASUREMENT_BASE = "au";
const WEIGHT_GRAMS = { g: 1, kg: 1000, oz: 28.3495, lb: 453.592 };

function loadMeasurementSystem() {
  try {
    const stored = localStorage.getItem(MEASUREMENT_STORAGE_KEY);
    return stored && MEASUREMENT_SYSTEMS[stored] ? stored : MEASUREMENT_BASE;
  } catch (error) {
    return MEASUREMENT_BASE;
  }
}

function saveMeasurementSystem(value) {
  try {
    localStorage.setItem(MEASUREMENT_STORAGE_KEY, value);
  } catch (error) {
    console.error(error);
  }
}

function recipeMatchesSeries(recipe, series) {
  if (!series || series === "all") {
    return true;
  }
  const curatedRecipes = CURATED_RECIPE_SERIES.get(series);
  if (curatedRecipes) {
    return curatedRecipes.has(recipe.id);
  }
  if (series.startsWith("cuisine-")) {
    const cuisine = recipeCuisines.find(({ id }) => series === `cuisine-${id}`);
    return Boolean(cuisine && recipeMatchesCuisine(recipe, cuisine));
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
      return ["baking", "dessert"].includes(category) || haystack.includes("bake");
    case "asian-dishes":
      return (
        haystack.includes("asian") ||
        haystack.includes("miso") ||
        haystack.includes("edamame") ||
        haystack.includes("risoni")
      );
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

const UNIT_ALIASES = new Map(
  Object.entries({
    tsp: "tsp",
    "tsp.": "tsp",
    teaspoon: "tsp",
    teaspoons: "tsp",
    tbsp: "tbsp",
    "tbsp.": "tbsp",
    tablespoon: "tbsp",
    tablespoons: "tbsp",
    cup: "cup",
    cups: "cup",
    c: "cup",
    "c.": "cup",
    ml: "ml",
    milliliter: "ml",
    milliliters: "ml",
    millilitre: "ml",
    millilitres: "ml",
    l: "l",
    liter: "l",
    liters: "l",
    litre: "l",
    litres: "l",
    g: "g",
    gram: "g",
    grams: "g",
    kg: "kg",
    kilogram: "kg",
    kilograms: "kg",
    mg: "mg",
    oz: "oz",
    ounce: "oz",
    ounces: "oz",
    lb: "lb",
    lbs: "lb",
    pound: "lb",
    pounds: "lb",
    pinch: "pinch",
    pinches: "pinch",
    dash: "dash",
    dashes: "dash",
    clove: "clove",
    cloves: "clove",
    slice: "slice",
    slices: "slice",
    can: "can",
    cans: "can",
    packet: "packet",
    packets: "packet",
    pack: "pack",
    packs: "pack",
    bunch: "bunch",
    bunches: "bunch",
    piece: "piece",
    pieces: "piece",
    stalk: "stalk",
    stalks: "stalk",
    stick: "stick",
    sticks: "stick",
    fillet: "fillet",
    fillets: "fillet",
    sheet: "sheet",
    sheets: "sheet",
    leaf: "leaf",
    leaves: "leaf",
  })
);

const UNIT_META = {
  tsp: { kind: "volume", toMl: 5 },
  tbsp: { kind: "volume", toMl: 20 },
  cup: { kind: "volume", toMl: 250 },
  ml: { kind: "volume", toMl: 1, metric: true },
  l: { kind: "volume", toMl: 1000, metric: true },
  g: { kind: "weight", toG: 1 },
  kg: { kind: "weight", toG: 1000 },
  mg: { kind: "weight", toG: 0.001 },
  oz: { kind: "weight", toG: 28.3495 },
  lb: { kind: "weight", toG: 453.592 },
  pinch: { kind: "tiny" },
  dash: { kind: "tiny" },
  clove: { kind: "count" },
  slice: { kind: "count" },
  can: { kind: "count" },
  packet: { kind: "count" },
  pack: { kind: "count" },
  bunch: { kind: "count" },
  piece: { kind: "count" },
  stalk: { kind: "count" },
  stick: { kind: "count" },
  fillet: { kind: "count" },
  sheet: { kind: "count" },
  leaf: { kind: "count" },
};

const PANTRY_ALWAYS_DROP = [
  "salt",
  "pepper",
  "black pepper",
  "white pepper",
  "sea salt",
  "kosher salt",
  "baking soda",
  "bicarbonate",
  "bicarbonate of soda",
  "baking powder",
];

const SPICE_WORDS = [
  "cinnamon",
  "nutmeg",
  "paprika",
  "oregano",
  "thyme",
  "rosemary",
  "cumin",
  "coriander",
  "basil",
  "parsley",
  "chilli",
  "chili",
  "chilli flakes",
  "chili flakes",
  "garlic powder",
  "onion powder",
  "bay leaf",
  "bay leaves",
  "cardamom",
  "turmeric",
  "ginger",
  "allspice",
  "cloves",
  "stock powder",
  "bouillon",
  "vanilla",
];

const QUANTITY_IMPORTANT = [
  "flour",
  "sugar",
  "brown sugar",
  "caster sugar",
  "icing sugar",
  "rice",
  "pasta",
  "noodles",
  "oats",
  "breadcrumbs",
  "bread crumbs",
  "butter",
  "milk",
  "cream",
  "cheese",
  "yoghurt",
  "yogurt",
  "oil",
  "chicken",
  "beef",
  "pork",
  "fish",
  "salmon",
  "tuna",
  "egg",
  "eggs",
  "potato",
  "potatoes",
  "onion",
  "onions",
  "garlic",
  "tomato",
  "tomatoes",
];

const LIQUID_WORDS = [
  "water",
  "milk",
  "cream",
  "stock",
  "broth",
  "juice",
  "vinegar",
  "soy sauce",
  "fish sauce",
  "oil",
  "coconut milk",
  "coconut cream",
  "maple syrup",
  "honey",
  "lemon juice",
  "lime juice",
  "wine",
];

function normalizeFractionCharacters(value) {
  return String(value || "")
    .replace(/⅛/g, "1/8")
    .replace(/⅜/g, "3/8")
    .replace(/⅝/g, "5/8")
    .replace(/⅞/g, "7/8")
    .replace(/¼/g, "1/4")
    .replace(/½/g, "1/2")
    .replace(/¾/g, "3/4")
    .replace(/⅓/g, "1/3")
    .replace(/⅔/g, "2/3")
    .replace(/(\d)(\s*[1-3]\/[2-8])/g, "$1 $2");
}

function parseFraction(value) {
  const [num, den] = value.split("/").map(Number);
  if (!den) {
    return NaN;
  }
  return num / den;
}

function parseQuantityToken(token) {
  const trimmed = token.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.includes("/")) {
    return parseFraction(trimmed);
  }
  const value = Number.parseFloat(trimmed);
  return Number.isNaN(value) ? null : value;
}

function parseInlineQuantity(value) {
  if (!value) {
    return NaN;
  }
  const normalized = normalizeFractionCharacters(value);
  if (normalized.includes(" ")) {
    const [whole, fraction] = normalized.split(/\s+/);
    return (parseQuantityToken(whole) || 0) + (parseQuantityToken(fraction) || 0);
  }
  return parseQuantityToken(normalized);
}

function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const temp = y;
    y = x % y;
    x = temp;
  }
  return x || 1;
}

function formatFractionAmount(amount) {
  if (!Number.isFinite(amount)) {
    return "";
  }
  const whole = Math.floor(amount + 1e-6);
  const remainder = amount - whole;
  if (remainder < 0.01) {
    return `${whole}`;
  }
  const denominators = [2, 3, 4, 8];
  let best = { diff: Infinity, num: 0, den: 1 };
  denominators.forEach((den) => {
    const num = Math.round(remainder * den);
    const diff = Math.abs(remainder - num / den);
    if (diff < best.diff) {
      best = { diff, num, den };
    }
  });
  let carry = whole;
  let num = best.num;
  let den = best.den;
  if (num >= den) {
    carry += 1;
    num = 0;
  }
  if (num === 0) {
    return `${carry}`;
  }
  const divisor = gcd(num, den);
  num /= divisor;
  den /= divisor;
  const fraction = `${num}/${den}`;
  return carry ? `${carry} ${fraction}` : fraction;
}

const MEASURE_REGEX =
  /(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)(?:\s*[-–]\s*(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?))?\s*(cups?|cup|tbsp|tablespoons?|tsp|teaspoons?|g|grams?|kg|kilograms?|oz|ounces?|lb|lbs|pounds?|ml|mL|liters?|litres?|l)\b/gi;

function normalizeMeasureUnit(unitToken) {
  const lower = unitToken.toLowerCase();
  if (lower.startsWith("cup")) {
    return "cup";
  }
  if (lower.startsWith("tbsp") || lower.startsWith("table")) {
    return "tbsp";
  }
  if (lower.startsWith("tsp") || lower.startsWith("tea")) {
    return "tsp";
  }
  if (lower.startsWith("kg") || lower.startsWith("kilo")) {
    return "kg";
  }
  if (lower === "g" || lower.startsWith("gram")) {
    return "g";
  }
  if (lower === "oz" || lower.startsWith("ounce")) {
    return "oz";
  }
  if (lower === "lb" || lower === "lbs" || lower.startsWith("pound")) {
    return "lb";
  }
  if (lower === "ml" || lower === "mL") {
    return "ml";
  }
  if (lower === "l" || lower.startsWith("liter") || lower.startsWith("litre")) {
    return "l";
  }
  return lower;
}

function isWeightUnit(unit) {
  return unit === "g" || unit === "kg" || unit === "oz" || unit === "lb";
}

function unitToGrams(unit) {
  return WEIGHT_GRAMS[unit] || null;
}

function convertWeight(value, unit, toSystem) {
  const gramsPerUnit = unitToGrams(unit);
  if (!gramsPerUnit) {
    return { value, unit };
  }
  const grams = value * gramsPerUnit;
  if (!Number.isFinite(grams)) {
    return { value, unit };
  }
  if (toSystem === "us") {
    const unitOut = grams >= WEIGHT_GRAMS.lb ? "lb" : "oz";
    return { value: grams / WEIGHT_GRAMS[unitOut], unit: unitOut };
  }
  if (toSystem === "au") {
    const unitOut = grams >= 1000 ? "kg" : "g";
    return { value: grams / WEIGHT_GRAMS[unitOut], unit: unitOut };
  }
  return { value, unit };
}

function convertMeasure(value, unit, fromSystem, toSystem) {
  if (fromSystem === toSystem) {
    return { value, unit };
  }
  const from = MEASUREMENT_SYSTEMS[fromSystem];
  const to = MEASUREMENT_SYSTEMS[toSystem];
  if (!from || !to) {
    return { value, unit };
  }
  if (unit === "cup") {
    return { value: (value * from.cupMl) / to.cupMl, unit };
  }
  if (unit === "tbsp") {
    return { value: (value * from.tbspMl) / to.tbspMl, unit };
  }
  if (unit === "tsp") {
    return { value: (value * from.tspMl) / to.tspMl, unit };
  }
  if (isWeightUnit(unit)) {
    return convertWeight(value, unit, toSystem);
  }
  return { value, unit };
}

function formatMeasureAmount(value, unit) {
  if (unit === "cup" || unit === "tbsp" || unit === "tsp") {
    return formatFractionAmount(value);
  }
  if (unit === "oz" || unit === "lb") {
    return formatNumber(value, value >= 10 ? 1 : 2);
  }
  return formatNumber(value, value >= 10 ? 1 : 2);
}

function formatMeasureLabel(unit, value) {
  if (unit === "cup") {
    return value > 1.01 ? "cups" : "cup";
  }
  if (unit === "tbsp") {
    return "tbsp";
  }
  if (unit === "tsp") {
    return "tsp";
  }
  if (unit === "lb") {
    return value > 1.01 ? "lb" : "lb";
  }
  if (unit === "oz") {
    return "oz";
  }
  if (unit === "kg") {
    return "kg";
  }
  if (unit === "g") {
    return "g";
  }
  if (unit === "ml") {
    return "ml";
  }
  if (unit === "l") {
    return "l";
  }
  return unit;
}

function convertMeasurementText(text, fromSystem, toSystem, factor = 1) {
  if (!text) {
    return text;
  }
  const format = factor === 1 ? formatMeasureAmount : (value, unit) =>
    window.recipeServings.formatAmount(value, ["cup", "tbsp", "tsp"].includes(unit));
  return text.replace(MEASURE_REGEX, (match, startValue, endValue, unitToken) => {
    const unit = normalizeMeasureUnit(unitToken);
    const start = parseInlineQuantity(startValue) * factor;
    if (!Number.isFinite(start)) {
      return match;
    }
    if (isWeightUnit(unit)) {
      if (endValue) {
        const end = parseInlineQuantity(endValue) * factor;
        if (!Number.isFinite(end)) {
          return match;
        }
        const startGrams = start * (unitToGrams(unit) || 1);
        const endGrams = end * (unitToGrams(unit) || 1);
        const maxGrams = Math.max(startGrams, endGrams);
        const targetUnit =
          toSystem === "us"
            ? maxGrams >= WEIGHT_GRAMS.lb
              ? "lb"
              : "oz"
            : maxGrams >= 1000
              ? "kg"
              : "g";
        const convertedStart = startGrams / WEIGHT_GRAMS[targetUnit];
        const convertedEnd = endGrams / WEIGHT_GRAMS[targetUnit];
        const label = formatMeasureLabel(targetUnit, Math.max(convertedStart, convertedEnd));
        return `${format(convertedStart, targetUnit)}-${format(
          convertedEnd,
          targetUnit
        )} ${label}`;
      }
      const converted = convertWeight(start, unit, toSystem);
      const label = formatMeasureLabel(converted.unit, converted.value);
      return `${format(converted.value, converted.unit)} ${label}`;
    }
    const convertedStart = convertMeasure(start, unit, fromSystem, toSystem);
    if (endValue) {
      const end = parseInlineQuantity(endValue) * factor;
      if (!Number.isFinite(end)) {
        return match;
      }
      const convertedEnd = convertMeasure(end, unit, fromSystem, toSystem);
      const label = formatMeasureLabel(
        convertedStart.unit,
        Math.max(convertedStart.value, convertedEnd.value)
      );
      return `${format(convertedStart.value, convertedStart.unit)}-${format(
        convertedEnd.value,
        convertedStart.unit
      )} ${label}`;
    }
    const label = formatMeasureLabel(convertedStart.unit, convertedStart.value);
    return `${format(convertedStart.value, convertedStart.unit)} ${label}`;
  });
}

function applyMeasurementSystem(recipe) {
  return window.recipeServings.displayRecipe(
    recipe, measurementSystem, convertMeasurementText, getStepText, normalizeIngredientForMatch
  );
}

function handleMeasurementToggle(event) {
  const button = event.target.closest(".measure-option, .measure-toggle-button");
  if (!button) {
    return;
  }
  const next = button.dataset.measure;
  if (!next || next === measurementSystem || !MEASUREMENT_SYSTEMS[next]) {
    return;
  }
  const previous = measurementSystem;
  measurementSystem = next;
  saveMeasurementSystem(next);

  if (button.classList.contains("measure-toggle-button")) {
    button.classList.remove("is-us", "is-au");
    button.classList.add(`is-${next}`);
    button.dataset.measure = previous;
    button.setAttribute(
      "aria-label",
      `Switch to ${MEASUREMENT_SYSTEMS[previous]?.label || "US"} measurements`
    );
  }

  setTimeout(() => {
    renderRecipeView(getSelectedRecipe(filteredRecipes));
  }, 180);
}

function parseLeadingQuantity(text) {
  const normalized = normalizeFractionCharacters(text);
  const rangeMatch = normalized.match(
    /^(\d+(?:\.\d+)?)(?:\s*[-–]\s*(\d+(?:\.\d+)?))(?=\s|$)/
  );
  if (rangeMatch) {
    return {
      amount: Number.parseFloat(rangeMatch[2]),
      raw: rangeMatch[0],
      rest: normalized.slice(rangeMatch[0].length).trim(),
    };
  }
  const match = normalized.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)(?=\s|$)/);
  if (!match) {
    return { amount: null, raw: null, rest: normalized.trim() };
  }
  const chunk = match[1];
  let amount = null;
  if (chunk.includes(" ")) {
    const [whole, fraction] = chunk.split(/\s+/);
    amount = parseQuantityToken(whole) + parseQuantityToken(fraction);
  } else {
    amount = parseQuantityToken(chunk);
  }
  return { amount, raw: chunk, rest: normalized.slice(match[0].length).trim() };
}

function normalizeUnitToken(token) {
  return token.toLowerCase().replace(/[.,]/g, "");
}

function parseIngredientLine(raw) {
  let working = normalizeFractionCharacters(String(raw || "")).trim();
  if (!working) {
    return null;
  }
  working = working.replace(/^[•*\-–—]\s*/, "");

  let amount = null;
  let unit = null;
  let amountText = null;

  const compactMatch = working.match(/^(\d+(?:\.\d+)?)([a-zA-Z]+)(?=\s|$)/);
  if (compactMatch) {
    const unitToken = normalizeUnitToken(compactMatch[2]);
    if (UNIT_ALIASES.has(unitToken)) {
      amount = Number.parseFloat(compactMatch[1]);
      unit = UNIT_ALIASES.get(unitToken);
      amountText = compactMatch[1];
      working = working.slice(compactMatch[0].length).trim();
    }
  }

  if (amount === null) {
    const parsed = parseLeadingQuantity(working);
    amount = parsed.amount;
    amountText = parsed.raw;
    working = parsed.rest;
  }

  const tokens = working.split(/\s+/);
  let startIndex = 0;
  if (amount !== null && tokens.length) {
    let candidate = normalizeUnitToken(tokens[0]);
    if (candidate === "x" && tokens[1]) {
      startIndex = 1;
      candidate = normalizeUnitToken(tokens[1]);
    }
    if (UNIT_ALIASES.has(candidate)) {
      unit = UNIT_ALIASES.get(candidate);
      startIndex += 1;
      working = tokens.slice(startIndex).join(" ");
    }
  }

  let name = working.replace(/^of\s+/i, "").trim();
  name = name.replace(/\s*\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  name = name.replace(/\s*,?\s*to taste$/i, "").trim();
  name = name.replace(/\s*,?\s*for serving$/i, "").trim();

  return {
    amount: amount !== null && !Number.isNaN(amount) ? amount : null,
    amountText,
    unit,
    name,
  };
}

function normalizeGroceryKey(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(
      /\b(chopped|minced|diced|sliced|ground|fresh|dried|softened|melted|packed|room|temperature|optional|for|to|taste|plus|extra)\b/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

function includesKeyword(name, keywords) {
  const lower = ` ${normalizeGroceryKey(name)} `;
  return keywords.some((keyword) => lower.includes(` ${keyword} `) || lower.includes(keyword));
}

function isLiquidIngredient(name) {
  return includesKeyword(name, LIQUID_WORDS);
}

function shouldDropQuantity(entry, name) {
  if (!entry.hasAmount) {
    return false;
  }
  if (includesKeyword(name, PANTRY_ALWAYS_DROP)) {
    return true;
  }
  if (includesKeyword(name, QUANTITY_IMPORTANT)) {
    return false;
  }

  if (entry.hasTinyUnit) {
    return true;
  }

  const smallVolume = entry.volumeMl > 0 && entry.volumeMl <= 15;
  const smallWeight = entry.weightG > 0 && entry.weightG <= 10;
  const smallCount = entry.count > 0 && entry.count <= 1;

  if (includesKeyword(name, SPICE_WORDS) && (smallVolume || smallWeight || smallCount)) {
    return true;
  }

  return false;
}

function formatNumber(value, decimals = 1) {
  return value
    .toFixed(decimals)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*[1-9])0+$/, "$1");
}

function formatWeight(grams) {
  if (grams >= 1000) {
    return `${formatNumber(grams / 1000, 2)} kg`;
  }
  return `${formatNumber(grams, grams >= 10 ? 0 : 1)} g`;
}

function formatWeightForSystem(grams, system) {
  if (system === "us") {
    const unit = grams >= WEIGHT_GRAMS.lb ? "lb" : "oz";
    const value = grams / WEIGHT_GRAMS[unit];
    return `${formatNumber(value, value >= 10 ? 1 : 2)} ${unit}`;
  }
  return formatWeight(grams);
}

function formatVolume(ml, name, preferMetric) {
  const useMetric = preferMetric || isLiquidIngredient(name);
  if (useMetric) {
    if (ml >= 1000) {
      return `${formatNumber(ml / 1000, 2)} l`;
    }
    return `${formatNumber(ml, ml >= 100 ? 0 : 1)} ml`;
  }

  if (includesKeyword(name, QUANTITY_IMPORTANT) && !isLiquidIngredient(name)) {
    const cups = ml / 240;
    const unitLabel = Math.abs(cups - 1) < 0.01 ? "cup" : "cups";
    return `${formatNumber(cups, 2)} ${unitLabel}`;
  }

  const tsp = ml / 4.92892;
  if (tsp >= 48) {
    const cups = tsp / 48;
    const unitLabel = Math.abs(cups - 1) < 0.01 ? "cup" : "cups";
    return `${formatNumber(cups, 2)} ${unitLabel}`;
  }
  if (tsp >= 3) {
    return `${formatNumber(tsp / 3, 2)} tbsp`;
  }
  return `${formatNumber(tsp, 2)} tsp`;
}

function formatVolumeFromMl(ml, system) {
  if (system !== "us") {
    if (ml >= 1000) {
      return `${formatNumber(ml / 1000, 2)} l`;
    }
    return `${formatNumber(ml, ml >= 100 ? 0 : 1)} ml`;
  }
  const cups = ml / MEASUREMENT_SYSTEMS.us.cupMl;
  if (cups >= 1) {
    return `${formatNumber(cups, 2)} ${Math.abs(cups - 1) < 0.01 ? "cup" : "cups"}`;
  }
  const tbsp = ml / MEASUREMENT_SYSTEMS.us.tbspMl;
  if (tbsp >= 1) {
    return `${formatNumber(tbsp, 2)} tbsp`;
  }
  const tsp = ml / MEASUREMENT_SYSTEMS.us.tspMl;
  return `${formatNumber(tsp, 2)} tsp`;
}

function formatVolumeUnit(amount, unit) {
  const value = formatNumber(amount, amount >= 10 ? 1 : 2);
  if (unit === "cup") {
    const label = Math.abs(amount - 1) < 0.01 ? "cup" : "cups";
    return `${value} ${label}`;
  }
  if (unit === "tbsp") {
    return `${value} tbsp`;
  }
  if (unit === "tsp") {
    return `${value} tsp`;
  }
  if (unit === "l") {
    return `${formatNumber(amount, 2)} l`;
  }
  if (unit === "ml") {
    return `${formatNumber(amount, amount >= 100 ? 0 : 1)} ml`;
  }
  return `${value} ${unit}`;
}

function formatCount(count) {
  return Number.isInteger(count) ? String(count) : formatNumber(count, 1);
}

function buildShoppingItems(groups, options = {}) {
  const system = options.system || measurementSystem || MEASUREMENT_BASE;
  const items = new Map();

  groups.forEach((group) => {
    group.items.forEach((item) => {
      const parsed = parseIngredientLine(item);
      if (!parsed || !parsed.name) {
        return;
      }

      const key = normalizeGroceryKey(parsed.name);
      if (!key) {
        return;
      }

      if (!items.has(key)) {
        items.set(key, {
          key,
          name: parsed.name,
          weightG: 0,
          volumeMl: 0,
          metricMl: 0,
          volumeUnits: {},
          count: 0,
          hasWeight: false,
          hasVolume: false,
          hasCount: false,
          hasAmount: false,
          hasTinyUnit: false,
          preferMetricVolume: false,
        });
      }

      const entry = items.get(key);
      if (entry && parsed.name.length < entry.name.length) {
        entry.name = parsed.name;
      }

      if (parsed.amount === null) {
        return;
      }

      if (!parsed.unit) {
        entry.count += parsed.amount;
        entry.hasCount = true;
        entry.hasAmount = true;
        return;
      }

      const unitMeta = UNIT_META[parsed.unit];
      if (!unitMeta) {
        return;
      }

      entry.hasAmount = true;

      if (unitMeta.kind === "weight") {
        entry.weightG += parsed.amount * unitMeta.toG;
        entry.hasWeight = true;
        return;
      }

      if (unitMeta.kind === "volume") {
        entry.volumeMl += parsed.amount * unitMeta.toMl;
        entry.hasVolume = true;
        if (!entry.volumeUnits[parsed.unit]) {
          entry.volumeUnits[parsed.unit] = { total: 0, raw: [] };
        }
        entry.volumeUnits[parsed.unit].total += parsed.amount;
        if (parsed.amountText) {
          entry.volumeUnits[parsed.unit].raw.push(parsed.amountText);
        }
        if (unitMeta.metric) {
          entry.metricMl += parsed.amount * unitMeta.toMl;
          entry.preferMetricVolume = true;
        }
        return;
      }

      if (unitMeta.kind === "count") {
        entry.count += parsed.amount;
        entry.hasCount = true;
        return;
      }

      if (unitMeta.kind === "tiny") {
        entry.hasTinyUnit = true;
      }
    });
  });

  const output = [];
  const volumeOrder = ["cup", "tbsp", "tsp", "l", "ml"];

  Array.from(items.values()).forEach((entry) => {
    const name = entry.name;
    if (shouldDropQuantity(entry, name)) {
      output.push(name);
      return;
    }
    if (entry.hasWeight && entry.weightG > 0) {
      output.push(`${formatWeightForSystem(entry.weightG, system)} ${name}`);
      return;
    }
    if (entry.hasVolume && Object.keys(entry.volumeUnits).length) {
      const units = Object.keys(entry.volumeUnits).sort(
        (a, b) => volumeOrder.indexOf(a) - volumeOrder.indexOf(b)
      );
      if (system === "us") {
        units
          .filter((unit) => ["cup", "tbsp", "tsp"].includes(unit))
          .forEach((unit) => {
            const unitData = entry.volumeUnits[unit];
            if (unitData.raw.length) {
              const pieces = unitData.raw.map((raw) => {
                const amount = parseInlineQuantity(raw);
                const label =
                  unit === "cup" && amount > 1.01 ? "cups" : unit === "cup" ? "cup" : unit;
                return `${raw} ${label}`;
              });
              output.push(`${pieces.join(" + ")} ${name}`);
              return;
            }
            output.push(`${formatVolumeUnit(unitData.total, unit)} ${name}`);
          });
        if (entry.metricMl > 0) {
          output.push(`${formatVolumeFromMl(entry.metricMl, system)} ${name}`);
        }
        return;
      }
      units.forEach((unit) => {
        const unitData = entry.volumeUnits[unit];
        if (["cup", "tbsp", "tsp"].includes(unit) && unitData.raw.length) {
          const pieces = unitData.raw.map((raw) => {
            const amount = parseInlineQuantity(raw);
            const label = unit === "cup" && amount > 1.01 ? "cups" : unit === "cup" ? "cup" : unit;
            return `${raw} ${label}`;
          });
          output.push(`${pieces.join(" + ")} ${name}`);
          return;
        }
        output.push(`${formatVolumeUnit(unitData.total, unit)} ${name}`);
      });
      return;
    }
    if (entry.hasCount && entry.count > 0) {
      output.push(`${formatCount(entry.count)} ${name}`);
      return;
    }
    output.push(name);
  });

  return output.filter(Boolean);
}

function buildIngredientOverviewMarkup(ingredients, options = {}) {
  const measureSystem = options.measureSystem || MEASUREMENT_BASE;
  const nextMeasureSystem = measureSystem === "us" ? "au" : "us";
  const nextMeasureLabel = MEASUREMENT_SYSTEMS[nextMeasureSystem]?.label || "AU/UK";
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

  const shoppingItems = buildShoppingItems(groups, { system: measureSystem });
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
      <div class="ingredient-heading">
        <div class="subsection-heading compact">
          <h2>Ingredients list</h2>
        </div>
        <button
          class="measure-toggle-button is-${measureSystem}"
          type="button"
          data-measure="${nextMeasureSystem}"
          aria-label="Switch to ${escapeHtml(nextMeasureLabel)} measurements"
        >
          <span class="measure-label">AU/UK</span>
          <span class="measure-label">US</span>
          <span class="measure-knob" aria-hidden="true"></span>
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
      <div class="ingredient-actions">
        ${hasGroups ? `<button
          class="ingredient-copy-button"
          type="button"
          data-action="copy-ingredients"
          aria-label="Copy ingredients list"
          title="Copy ingredients list"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
            <rect x="5" y="4" width="14" height="17" rx="2" />
            <rect x="9" y="2" width="6" height="4" rx="1" fill="#f4f4ef" />
          </svg>
        </button>` : ""}
        <button
          class="button button-ghost ingredient-toggle-button"
          type="button"
          data-action="toggle-ingredients"
          aria-pressed="false"
        >
          Convert to grocery list
        </button>
      </div>
      <span class="sr-only" role="status" data-copy-status></span>
      ${hasGroups ? window.methodQuantities.toggleMarkup() : ""}
    </section>
  `;
}

function normalizeIngredientForMatch(item) {
  return String(item || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[0-9]/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(
      /\b(cups?|cup|tbsp|tablespoons?|tsp|teaspoons?|g|kg|mg|ml|l|oz|lb|lbs|grams?|milliliters?|liters?|pinch|dash|clove|cloves|slice|slices|can|cans|packet|packets)\b/g,
      " "
    )
    .replace(
      /\b(large|small|medium|fresh|ground|chopped|minced|diced|sliced|softened|melted|packed|room|temperature|optional|for|to)\b/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

function ingredientMatchesStep(item, stepEntry) {
  const step = normalizeText(getStepText(stepEntry));
  return buildIngredientMatchTerms([item]).some((term) => {
    const pattern = term.split(" ").map(escapeRegExp).join("\\s+");
    return new RegExp(`(^|[^A-Za-z0-9_])${pattern}(?=$|[^A-Za-z0-9_])`, "i").test(step);
  });
}

function buildCookIngredients(ingredients, stepEntry) {
  const groups = buildIngredientGroups(ingredients);
  if (!groups.length) {
    return [];
  }

  const matchedGroups = groups
    .map((group) => ({
      title: group.title,
      items: group.items.filter((item) => ingredientMatchesStep(item, stepEntry)),
    }))
    .filter((group) => group.items.length);

  if (matchedGroups.length) {
    return matchedGroups;
  }

  return [];
}

function buildCookModeMarkup(recipe, stepIndex) {
  if (!recipe) {
    return '<div class="empty-state">No recipe selected.</div>';
  }
  const steps = recipe.steps || [];
  const totalSteps = steps.length;
  const safeIndex = totalSteps ? Math.min(Math.max(stepIndex, 0), totalSteps - 1) : 0;
  const stepEntry = steps[safeIndex];
  const stepText = getStepText(stepEntry) || "No steps added yet.";
  const stepMarkup = buildMethodRenderer(recipe)(stepText, safeIndex);
  const ingredientGroups = buildCookIngredients(recipe.ingredients || [], stepEntry);
  const showGroupTitles =
    ingredientGroups.length > 1 ||
    (ingredientGroups[0] && normalizeText(ingredientGroups[0].title) !== "main");
  const ingredientMarkup = ingredientGroups.length
    ? ingredientGroups
        .map((group) => {
          const titleMarkup = showGroupTitles
            ? `<h3>${escapeHtml(group.title)}</h3>`
            : "";
          const itemsMarkup = group.items
            .map((item) => `<li>${escapeHtml(item)}</li>`)
            .join("");
          return `
            <div class="cook-ingredient-group">
              ${titleMarkup}
              <ul class="ingredient-list">${itemsMarkup}</ul>
            </div>
          `;
        })
        .join("")
    : '<div class="empty-state">No listed ingredients for this step.</div>';

  return `
    <section class="cook-mode">
      <div class="cook-mode__header">
        <p class="section-kicker">Let's cook</p>
        <div class="cook-mode__title-row">
          <strong>${escapeHtml(recipe.title)}</strong>
          ${totalSteps ? `<span>Step ${safeIndex + 1} of ${totalSteps}</span>` : ""}
        </div>
      </div>
      <div class="cook-mode__grid">
        ${window.recipeCookingUI.stepCardMarkup(stepEntry, safeIndex, stepText, stepMarkup, "cook-step-card")}
        <aside class="cook-ingredients-card notebook-card">
          <div class="subsection-heading compact">
            <p class="section-kicker">Ingredients</p>
            <h2>For this step</h2>
          </div>
          ${ingredientMarkup}
        </aside>
      </div>
    </section>
  `;
}

// Keep the longer introductions on recipe detail pages.
const recipeIntroductions = {
  "mr-beans-apple-snaps": "These buttery spiced biscuits are topped with thin slices of Gala apple. Ginger, cinnamon, and a little molasses give the dough its warm flavour.",
  "best-air-fried-chips": "A quick turn in the microwave softens the potatoes before they go into the air fryer. Season them however you like and serve them straight from the basket.",
  "greek-sheet-pan-chicken": "Cherry tomatoes and red onion roast beneath the lemon-and-herb chicken. The olives and feta go in near the end, adding a salty finish to everything on the tray.",
  "chicken-crust-pizza": "Cottage cheese and nutritional yeast go into the base, which you press into shape by hand. Salami, pineapple and mozzarella give it that familiar pizza-night flavour.",
  "deli-style-marinated-chicken-breast": "Chicken breast gets a honey, Dijon and herb marinade before roasting. Slice it thinly and toss with Kewpie mayo and a little extra mustard for a deli-style sandwich filling.",
  "simmered-hijiki-salad": "Hijiki and strips of fried tofu simmer in dashi, soy sauce and mirin for a savoury Japanese side. Shelled edamame adds a little colour and bite if you have some on hand.",
  "chinese-sauteed-wombok": "Wombok is stir-fried with garlic, dried chillies and Sichuan peppercorns, then coated in a sweet-sour soy glaze. The thick stems and soft leaves give the same dish two different textures.",
  "chilli-con-carne": "Lean beef mince and black beans make this a hearty chilli, with cumin and paprika running through the tomato base. Adjust the chilli to taste.",
  "healthy-chicken-and-leek-pie": "Chicken and leeks meet a Greek yoghurt and thyme filling under a puff pastry lid.",
  "korean-tofu-pancakes": "Silken tofu and potato starch form the base for these savoury pancakes, packed with shredded vegetables and chopped kimchi. Gochujang adds a little heat and depth.",
  "miso-edamame-risoni": "Risoni cooks in vegetable stock with tahini and edamame, then gets a swirl of kale and white miso. A squeeze of lemon brightens the creamy sauce.",
  "healthy-banana-bread": "Bananas, oat flour and Greek yoghurt make up this loaf, with vanilla and cinnamon in the batter. Chocolate chips add a little sweetness to each slice.",
  "pork-prawn-dumplings": "Pork and prawns make up the filling, with ginger, garlic and sesame oil for flavour. Spoon it into ready-made wrappers and steam the dumplings until cooked through.",
  "korean-mayak-drug-eggs": "Soft-boiled eggs soak overnight in soy sauce, honey, sesame oil and chilli. Spoon the eggs and some of the marinade over warm rice.",
  "chicken-karaage": "Chicken thighs are marinated with soy, sake, ginger and garlic, then fried in a light cornflour coating. Serve the golden pieces with mayo and sliced spring onion.",
  "cinnamon-protein-granola": "Oats, nuts and seeds bake with protein powder, nut butter and cinnamon. Give the tray a stir halfway through so it toasts evenly.",
  "korean-chicken-tteokbokki-stew": "Seared chicken thighs and potatoes cook in a garlicky sauce with gochugaru and gochujang. The chewy rice cakes make it the sort of stew you want to eat straight from a big bowl.",
};

function getRecipeDescription(recipe) {
  const introduction = recipeIntroductions[recipe.id];
  const description = recipe.description?.trim();
  return [description, introduction].filter(Boolean).join(" ");
}

function buildRelatedRecipesMarkup(recipe) {
  const tags = new Set((recipe.tags || []).map(normalizeText));
  const category = normalizeText(recipe.category);
  const preview = new URLSearchParams(window.location.search).get("preview") === "1";
  const candidates = allRecipes.filter((candidate) => candidate.id !== recipe.id);
  const photographed = candidates.filter((candidate) => candidate.image);
  const related = (photographed.length ? photographed : candidates)
    .map((candidate) => ({
      candidate,
      score: Number(normalizeText(candidate.category) === category) * 2
        + (candidate.tags || []).filter((tag) => tags.has(normalizeText(tag))).length,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  if (!related.length) return "";

  return `
    <section class="recipe-related" aria-labelledby="recipeRelatedHeading">
      <h2 id="recipeRelatedHeading">You might also like</h2>
      <ul class="recipe-related-list">
        ${related.map(({ candidate }) => {
          const params = new URLSearchParams({ recipe: candidate.id });
          if (preview) params.set("preview", "1");
          return `<li><a class="recipe-photo-card" data-related-recipe-id="${escapeHtml(candidate.id)}" href="./recipe-library.html?${escapeHtml(params.toString())}">
            <span class="recipe-photo-card-media">${candidate.image
              ? `<img src="${escapeHtml(candidate.image)}" alt="" loading="lazy" />`
              : escapeHtml(candidate.category || "Recipe")}</span>
            <span class="recipe-photo-card-title">${escapeHtml(candidate.title)}</span>
          </a></li>`;
        }).join("")}
      </ul>
    </section>
  `;
}

// First appearances in the site's recipe archive. These predate publication timestamps.
const recipeArchiveDates = {
  "mr-beans-apple-snaps": "2026-03-22",
  "best-air-fried-chips": "2026-03-22",
  "greek-sheet-pan-chicken": "2026-03-22",
  "chicken-crust-pizza": "2026-03-22",
  "deli-style-marinated-chicken-breast": "2026-03-27",
  "simmered-hijiki-salad": "2026-03-27",
  "chinese-sauteed-wombok": "2026-03-27",
  "chilli-con-carne": "2026-03-27",
  "healthy-chicken-and-leek-pie": "2026-03-27",
  "korean-tofu-pancakes": "2026-03-27",
  "miso-edamame-risoni": "2026-03-27",
  "healthy-banana-bread": "2026-03-27",
  "pork-prawn-dumplings": "2026-03-27",
  "korean-mayak-drug-eggs": "2026-03-27",
  "chicken-karaage": "2026-03-27",
  "cinnamon-protein-granola": "2026-03-27",
  "korean-chicken-tteokbokki-stew": "2026-08-17",
};

const photoDateFormatter = new Intl.DateTimeFormat("en-AU", {
  dateStyle: "medium",
  timeZone: "Australia/Brisbane",
});

function buildRecipePhotoMeta(recipe) {
  const posted = typeof recipe.publishedAt === "string" && Number.isFinite(Date.parse(recipe.publishedAt));
  const date = posted ? recipe.publishedAt : recipeArchiveDates[recipe.id];
  const dateMarkup = date
    ? `<time datetime="${escapeHtml(date)}">${photoDateFormatter.format(new Date(date))}</time>`
    : "";
  const count = Number.isSafeInteger(recipe.cookedCount) && recipe.cookedCount >= 0 ? recipe.cookedCount : 0;
  return `
    <div class="recipe-photo-meta">
      ${dateMarkup}
      <span class="recipe-photo-count">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M7 17v-4a4 4 0 1 1 1.5-7.7 4.1 4.1 0 0 1 7 0A4 4 0 1 1 17 13v4M7 17h10v3H7z"/>
        </svg>
        <span class="sr-only">People who cooked this</span>
        ${count.toLocaleString("en-AU")}
      </span>
    </div>
  `;
}

function buildRecipeViewMarkup(recipe, nutrition) {
  if (!recipe) {
    return '<div class="empty-state">No recipe is available yet.</div>';
  }

  const description = getRecipeDescription(recipe);
  const saved = window.recipeSaves.has(recipe.id);
  const ingredientOverviewMarkup = window.recipeCookingUI.ingredientOverviewMarkup(
    buildIngredientGroups(recipe.ingredients), measurementSystem, Boolean(recipe.steps?.length), recipe.serves
  );

  const methodItems = window.recipeCookingUI.methodItemsMarkup(recipe, getStepText, buildMethodRenderer(recipe));
  const category = normalizeText(recipe.category);
  const tags = [...new Set((recipe.tags || []).map(normalizeText))];
  const tagItems = tags.filter((tag) => tag && tag !== category).slice(0, 4)
    .map((tag) => `<li>${escapeHtml(tag)}</li>`)
    .join("");

  const metaItems = [
    recipe.prepTime && { label: "Prep time", value: recipe.prepTime },
    recipe.cookTime && { label: "Cook time", value: recipe.cookTime },
    { label: "Serves", value: recipe.serves, servingIndicator: true },
  ].filter(Boolean);

  const metaMarkup = metaItems.length
    ? metaItems
        .map(
          ({ label, value, servingIndicator }) => `
            <div class="recipe-meta-item">
              <dt>${escapeHtml(label)}</dt>
              <dd${servingIndicator ? " data-recipe-serves" : ""}>${escapeHtml(value)}</dd>
            </div>
          `
        )
        .join("")
    : "";
  const nutritionEntries = [
    ["Calories", nutrition.calories],
    ["Protein", nutrition.protein],
    ["Carbs", nutrition.carbs],
    ["Fat", nutrition.fat],
  ].filter(([, value]) => value != null && String(value).trim() !== "");
  const nutritionHeading = "Nutrition per serve";
  const nutritionMarkup = nutritionEntries.length
    ? `
        <section class="recipe-nutrition" aria-label="${escapeHtml(nutritionHeading)}">
          <h2>${escapeHtml(nutritionHeading)}</h2>
          <dl class="recipe-meta-grid">
          ${nutritionEntries
            .map(
              ([label, value]) =>
                `<div class="recipe-meta-item"><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`
            )
            .join("")}
          </dl>
        </section>
      `
    : `<p class="recipe-nutrition-note">${recipe.id === "miso-edamame-risoni"
      ? "Macros pending quantities for the risoni and other unmeasured ingredients."
      : "Macros pending ingredient amounts or yield."}</p>`;

  const cookButtonMarkup = recipe.steps?.length
    ? `
        <button class="button button-ghost lets-cook-button" type="button" data-action="lets-cook">
          Let's cook <span aria-hidden="true">→</span>
        </button>
      `
    : "";

  return `
    <article class="recipe-layout">
        <div class="recipe-detail-hero">
          <div class="recipe-hero-media">
            ${recipe.image ? `<img
              class="recipe-hero-image"
              src="${escapeHtml(recipe.image)}"
              alt="${escapeHtml(recipe.title)}"
            />${buildRecipePhotoMeta(recipe)}` : '<span class="recipe-photo-placeholder">Photo coming soon</span>'}
          </div>
          <div class="recipe-hero-details">
            <div class="recipe-detail-topline">
              <p class="recipe-category">${escapeHtml(recipe.category || "Recipe")}</p>
              <button class="recipe-save-button" type="button" aria-label="Save recipe"
                aria-pressed="${saved}" data-save-recipe="${escapeHtml(recipe.id)}">
                <span class="recipe-save-icon" aria-hidden="true"></span>
              </button>
            </div>
            ${description ? `<p class="recipe-page-description">${escapeHtml(description)}</p>` : ""}
            ${tagItems ? `<ul class="recipe-detail-tags" aria-label="Recipe tags">${tagItems}</ul>` : ""}
            <div class="recipe-detail-controls">
              <div class="recipe-detail-stats">
                <dl class="recipe-meta-grid recipe-timing">${metaMarkup}</dl>
                ${nutritionMarkup}
              </div>
              <div class="recipe-detail-actions">
                <button class="recipe-planner-launch" type="button" aria-haspopup="dialog"
                  aria-controls="recipeMealPlanner" data-open-recipe-planner
                  data-recipe-id="${escapeHtml(recipe.id)}" data-recipe-title="${escapeHtml(recipe.title)}">
                  <span class="recipe-planner-icon" aria-hidden="true">
                    <img src="./assets/notion-app-logo.png" alt="" width="48" height="48" />
                    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="m4 8 5-5M5.5 3H9v3.5" />
                    </svg>
                  </span>
                  <span>Add to meal planner</span>
                </button>
                ${cookButtonMarkup}
              </div>
            </div>
            <span class="sr-only" role="status" data-save-status></span>
            ${buildRelatedRecipesMarkup(recipe)}
          </div>
        </div>

        ${recipe.detailPhoto?.src ? `<img
          class="recipe-detail-photo"
          src="${escapeHtml(recipe.detailPhoto.src)}"
          alt="${escapeHtml(recipe.detailPhoto.alt || "")}"
          loading="lazy"
          decoding="async"
        />` : ""}

        ${recipe.detailVideo ? `<video
          class="recipe-detail-video"
          src="${escapeHtml(recipe.detailVideo)}"
          poster="${escapeHtml(recipe.image || "")}"
          aria-label="${escapeHtml(recipe.title)} video"
          controls
          playsinline
          preload="none"
        ></video>` : ""}

        <div class="recipe-reading-grid">
          <aside class="recipe-sidebar">
            ${ingredientOverviewMarkup}
          </aside>
          <section class="method-section">
            <div class="subsection-heading">
              <h2>Method</h2>
            </div>
            <div class="step-grid">${methodItems}</div>
            ${window.recipeCookingUI.methodNoteMarkup(recipe)}
          </section>
        </div>
    </article>
  `;
}

function matchesBrowseCategory(recipe, category) {
  const selected = normalizeText(category);
  const actual = normalizeText(recipe.category);
  if (selected === "baking & dessert") {
    return ["baking", "dessert"].includes(actual);
  }
  if (selected === "breakfast") {
    return actual === "breakfast" || (recipe.tags || []).some((tag) => normalizeText(tag) === "breakfast") || /granola|porridge|overnight oats/i.test(recipe.title || "");
  }
  return actual === selected;
}

function recipeMatches(recipe, searchTerm, categoryFilter) {
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

  const normalizedCategory = normalizeText(categoryFilter || "");
  const categoryMatch =
    !normalizedCategory || matchesBrowseCategory(recipe, normalizedCategory);
  const searchMatch = !searchTerm || haystack.includes(searchTerm);
  return categoryMatch && searchMatch;
}

function getSelectedRecipe(recipes) {
  const matched =
    selectedRecipeId && recipes.find((recipe) => recipe.id === selectedRecipeId);

  if (matched) {
    return matched;
  }

  return recipes[0] || allRecipes[0] || null;
}

function renderRecipeView(recipe) {
  if (!viewContainer) {
    return;
  }
  if (!standaloneRecipeView) return;

  recipePageHeading.textContent = recipe?.title || "Recipe";
  document.title = `${recipePageHeading.textContent} | Siena's Kitchen`;
  viewContainer.innerHTML = buildRecipeViewMarkup(
    applyMeasurementSystem(recipe), window.siteHeader.getNutritionPerServe(recipe)
  );
  for (const link of viewContainer.querySelectorAll("[data-related-recipe-id]")) {
    const related = allRecipes.find(({ id }) => id === link.dataset.relatedRecipeId);
    if (related) window.siteHeader.addCardNutrition(link.querySelector(".recipe-photo-card-title"), related);
  }
  refreshIcons();
}

function handleRecipeSave(event) {
  const button = event.target.closest("[data-save-recipe]");
  if (!button) return;

  const { saveRecipe: recipeId } = button.dataset;
  const saved = !window.recipeSaves.has(recipeId);
  const status = viewContainer.querySelector("[data-save-status]");
  try {
    window.recipeSaves.set(recipeId, saved);
  } catch {
    status.textContent = "This browser could not save the recipe.";
    return;
  }
  button.setAttribute("aria-pressed", String(saved));
  status.textContent = saved ? "Added to Saved Recipes." : "Recipe removed from Saved Recipes.";
  if (!saveToast) return;

  saveToast.hidden = !saved;
  scheduleSaveToastDismissal();
}

function scheduleSaveToastDismissal() {
  clearTimeout(saveToastTimer);
  if (saveToast.hidden || saveToast.matches(":hover, :focus-within")) return;
  saveToastTimer = setTimeout(() => { saveToast.hidden = true; }, 7000);
}

function updateCookOverlayNav(recipe) {
  if (!cookPrevButton || !cookNextButton) {
    return;
  }
  const steps = recipe?.steps || [];
  const totalSteps = steps.length;
  cookPrevButton.disabled = cookStepIndex <= 0;
  cookNextButton.disabled = totalSteps === 0 || cookStepIndex >= totalSteps - 1;
}

function renderCookOverlay(recipe) {
  if (!cookOverlayContent) {
    return;
  }
  const displayRecipe = applyMeasurementSystem(recipe);
  cookOverlayContent.innerHTML = buildCookModeMarkup(displayRecipe, cookStepIndex);
  refreshIcons();
  updateCookOverlayNav(displayRecipe);
}

function openCookOverlay() {
  if (!cookOverlay) {
    return;
  }
  cookStepIndex = 0;
  renderCookOverlay(getSelectedRecipe(filteredRecipes));
  cookOverlay.classList.add("is-open");
  cookOverlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("is-overlay-open");
}

function closeCookOverlay() {
  if (!cookOverlay) {
    return;
  }
  cookOverlay.classList.remove("is-open");
  cookOverlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("is-overlay-open");
}

function navigateCookStep(delta) {
  const recipe = getSelectedRecipe(filteredRecipes);
  if (!recipe) {
    return;
  }
  const totalSteps = recipe.steps?.length || 0;
  if (!totalSteps) {
    return;
  }
  const nextIndex = cookStepIndex + delta;
  if (nextIndex < 0 || nextIndex >= totalSteps) {
    return;
  }
  cookStepIndex = nextIndex;
  renderCookOverlay(recipe);
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
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.textContent = collectionTitle ? "No recipes in this collection yet." : "No recipes match this search yet.";
    listContainer.append(emptyState);
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

    const item = document.createElement("a");
    item.className = "az-list-item notebook-card";
    item.dataset.recipeId = recipe.id;
    item.href = `./recipe-library.html?recipe=${encodeURIComponent(recipe.id)}`;
    const imageMarkup = recipe.image
      ? `<img src="${escapeHtml(recipe.image)}" alt="${escapeHtml(recipe.title || "Recipe image")}" />`
      : `<div class="az-list-image-placeholder">No recipe photo</div>`;
    item.innerHTML = `
      <div class="az-list-row">
        <div class="az-list-media">${imageMarkup}</div>
        <div class="az-list-body">
          <div class="az-list-header">
            <strong class="az-list-title">${escapeHtml(recipe.title || "Untitled recipe")}</strong>
            <span class="az-list-category">${escapeHtml(recipe.category || "Recipe")}</span>
          </div>
          <p class="az-list-description">${escapeHtml(recipe.description || "")}</p>
        </div>
      </div>
    `;

    window.siteHeader.addCardNutrition(item.querySelector(".az-list-header"), recipe);
    listContainer.append(item);
  });

  letterMarkers = Array.from(listContainer.querySelectorAll(".az-letter-marker"));
  updateActiveListItem();
  updateScrollBubble();
}

function updateScrollBubble() {
  if (!listScroll || !scrollThumb || !scrollBar) {
    return;
  }

  const scrollRange = listScroll.scrollHeight - listScroll.clientHeight;
  const trackHeight = scrollBar.clientHeight;
  const thumbHeight = scrollThumb.offsetHeight;
  const maxTop = Math.max(trackHeight - thumbHeight, 0);
  const ratio = scrollRange > 0 ? listScroll.scrollTop / scrollRange : 0;
  scrollThumb.style.top = `${maxTop * ratio}px`;

  const scrollTop = listScroll.scrollTop;
  let currentLetter = letterMarkers[0]?.dataset.letter || "";

  for (const marker of letterMarkers) {
    if (marker.offsetTop <= scrollTop + 12) {
      currentLetter = marker.dataset.letter;
    } else {
      break;
    }
  }

  if (scrollLetter && currentLetter) {
    scrollLetter.textContent = currentLetter;
  }
}

function handleListScroll() {
  updateScrollBubble();
}

let isDraggingThumb = false;
let thumbDragOffset = 0;

function setScrollFromThumb(top) {
  if (!listScroll || !scrollBar || !scrollThumb) {
    return;
  }
  const trackHeight = scrollBar.clientHeight;
  const thumbHeight = scrollThumb.offsetHeight;
  const maxTop = Math.max(trackHeight - thumbHeight, 0);
  const clampedTop = Math.max(0, Math.min(maxTop, top));
  const ratio = maxTop > 0 ? clampedTop / maxTop : 0;
  const scrollRange = listScroll.scrollHeight - listScroll.clientHeight;
  listScroll.scrollTop = ratio * scrollRange;
}

function handleThumbPointerDown(event) {
  if (!scrollThumb) {
    return;
  }
  event.preventDefault();
  isDraggingThumb = true;
  const rect = scrollThumb.getBoundingClientRect();
  thumbDragOffset = event.clientY - rect.top;
  scrollThumb.setPointerCapture(event.pointerId);
}

function handleThumbPointerMove(event) {
  if (!isDraggingThumb || !scrollBar) {
    return;
  }
  const trackRect = scrollBar.getBoundingClientRect();
  const nextTop = event.clientY - trackRect.top - thumbDragOffset;
  setScrollFromThumb(nextTop);
}

function handleThumbPointerUp(event) {
  if (!scrollThumb) {
    return;
  }
  isDraggingThumb = false;
  scrollThumb.releasePointerCapture(event.pointerId);
}

function handleScrollBarPointerDown(event) {
  if (!scrollThumb || !scrollBar) {
    return;
  }
  if (event.target === scrollThumb || scrollThumb.contains(event.target)) {
    return;
  }
  const trackRect = scrollBar.getBoundingClientRect();
  const nextTop = event.clientY - trackRect.top - scrollThumb.offsetHeight / 2;
  setScrollFromThumb(nextTop);
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

  const series = seriesFilter?.value || "all";
  const matches = allRecipes
    .filter((recipe) => recipeMatches(recipe, "", activeCategory) && recipeMatchesSeries(recipe, series))
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
  const searchTerm = collectionTitle ? "" : normalizeText(searchInput?.value || "");
  const series = lockedSeries || seriesFilter?.value || "all";
  filteredRecipes = allRecipes.filter(
    (recipe) =>
      recipeMatches(recipe, searchTerm, activeCategory) && recipeMatchesSeries(recipe, series)
  );

  if (standaloneRecipeView && selectedRecipeId) {
    const selected = allRecipes.find((recipe) => recipe.id === selectedRecipeId);
    if (selected) {
      filteredRecipes = [selected];
    }
  }

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

function updateSeriesHeading() {
  if (standaloneRecipeView) return;
  const filterTitle = seriesFilter?.value !== "all" ? seriesFilter?.selectedOptions[0]?.textContent : "";
  const title = collectionTitle || filterTitle;
  recipePageHeading.textContent = title || "Browse every recipe";
  document.title = `${title || "A-Z Recipe Library"} | Siena's Kitchen`;
}

function updateFilterParam(series) {
  const url = new URL(window.location.href);
  url.searchParams.delete("series");
  if (series && series !== "all") {
    url.searchParams.set("filter", series);
  } else {
    url.searchParams.delete("filter");
  }
  window.history.replaceState({}, "", url);
}

function handleIngredientTabs(event) {
  const tab = event.target.closest(".ingredient-tab");
  const toggleButton = event.target.closest(".ingredient-toggle-button");
  const copyButton = event.target.closest(".ingredient-copy-button");
  if (!tab && !toggleButton && !copyButton) {
    return;
  }
  const container = (tab || toggleButton || copyButton).closest(".ingredient-overview");
  if (!container) {
    return;
  }

  if (copyButton) {
    copyIngredientList(container);
    return;
  }

  if (tab) {
    const view = tab.dataset.view;
    container.querySelectorAll(".ingredient-tab").forEach((button) => {
      button.classList.toggle("is-active", button === tab);
    });
    container.querySelectorAll(".ingredient-view").forEach((panel) => {
      panel.classList.toggle("is-active", panel.dataset.view === view);
    });
    const isShoppingView = view === "shopping";
    container.classList.toggle("is-shopping", isShoppingView);
    const heading = container.querySelector(".subsection-heading h2");
    if (heading) {
      heading.textContent = isShoppingView ? "Grocery list" : "Ingredients list";
    }
    updateIngredientCopyLabel(container, isShoppingView);
    return;
  }

  const views = Array.from(container.querySelectorAll(".ingredient-view"));
  const activeView = views.find((panel) => panel.classList.contains("is-active"));
  const nextView = views.find((panel) => panel !== activeView) || activeView;
  views.forEach((panel) => {
    panel.classList.toggle("is-active", panel === nextView);
  });
  const isShoppingView = nextView?.dataset.view === "shopping";
  container.classList.toggle("is-shopping", isShoppingView);
  const heading = container.querySelector(".subsection-heading h2");
  if (heading) {
    heading.textContent = isShoppingView ? "Grocery list" : "Ingredients list";
  }
  updateIngredientCopyLabel(container, isShoppingView);
  if (toggleButton) {
    toggleButton.setAttribute("aria-pressed", String(isShoppingView));
    toggleButton.textContent = isShoppingView ? "Back to ingredients list" : "Convert to grocery list";
  }
}

function updateIngredientCopyLabel(container, isShoppingView) {
  const button = container.querySelector(".ingredient-copy-button");
  if (!button) return;
  const label = isShoppingView ? "Copy grocery list" : "Copy ingredients list";
  button.setAttribute("aria-label", label);
  button.title = label;
}

async function copyIngredientList(container) {
  const activeView = container.querySelector(".ingredient-view.is-active");
  if (!activeView) return;

  const isShoppingView = activeView.dataset.view === "shopping";
  const items = Array.from(activeView.querySelectorAll(
    isShoppingView ? ".shopping-item span" : ".ingredient-component h3, .ingredient-list li"
  ))
    .map((node) => node.textContent.trim())
    .filter(Boolean);
  if (!items.length) {
    return;
  }
  const copyButton = container.querySelector(".ingredient-copy-button");
  const status = container.querySelector("[data-copy-status]");
  const text = items.join("\n");
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      try {
        textarea.select();
        if (!document.execCommand("copy")) throw new Error("Clipboard unavailable");
      } finally {
        textarea.remove();
        copyButton.focus({ preventScroll: true });
      }
    }
  } catch {
    status.textContent = "Could not copy the list.";
    return;
  }
  status.textContent = isShoppingView ? "Grocery list copied." : "Ingredients list copied.";
  copyButton.classList.add("is-copied");
  setTimeout(() => copyButton.classList.remove("is-copied"), 1200);
}

function handleCookActions(event) {
  const actionTarget = event.target.closest("[data-action]");
  if (!actionTarget) {
    return;
  }
  const action = actionTarget.dataset.action;

  if (action === "lets-cook") {
    openCookOverlay();
    return;
  }
  if (action === "close-cook") {
    closeCookOverlay();
    return;
  }
  if (action === "cook-prev") {
    navigateCookStep(-1);
  }
  if (action === "cook-next") {
    navigateCookStep(1);
  }
}

async function initLibrary() {
  const params = new URLSearchParams(window.location.search);
  const seriesParam = params.get("series");
  const categoryParam = params.get("category");
  const recipeParam = params.get("recipe");
  if (seriesFilter) {
    const cuisineOptions = document.createElement("optgroup");
    cuisineOptions.label = "Cuisines";
    recipeCuisines.forEach((cuisine) => {
      cuisineOptions.append(new Option(cuisine.label, `cuisine-${cuisine.id}`));
    });
    seriesFilter.append(cuisineOptions);
  }
  if (categoryParam) {
    activeCategory = categoryParam;
  }
  if (recipeParam) {
    selectedRecipeId = recipeParam;
    standaloneRecipeView = true;
    document.body.classList.add("is-standalone-recipe");
  }
  const findOption = (value) => Array.from(seriesFilter?.options || []).find(
    (option) => option.value === normalizeText(value)
  );
  const linkedOption = findOption(seriesParam);
  const isCuisine = linkedOption?.value.startsWith("cuisine-");
  const collectionOption = linkedOption && linkedOption.value !== "all" && !isCuisine ? linkedOption : null;

  if (!standaloneRecipeView && !isCuisine) {
    lockedSeries = collectionOption?.value || "";
    collectionTitle = collectionOption?.textContent.trim() || categoryParam?.trim() || "";
  }
  if (collectionTitle) {
    document.body.classList.add("is-recipe-collection");
  } else if (seriesFilter) {
    seriesFilter.value = (linkedOption || findOption(params.get("filter")))?.value || "all";
  }

  measurementSystem = loadMeasurementSystem();
  allRecipes = await loadRecipes();
  allRecipes.sort((a, b) =>
    String(a?.title || "").localeCompare(String(b?.title || ""), undefined, {
      sensitivity: "base",
    })
  );
  filteredRecipes = [...allRecipes];

  selectedRecipeId = selectedRecipeId || filteredRecipes[0]?.id || null;
  updateSeriesHeading();
  applyFilters();

  if (listScroll) {
    listScroll.addEventListener("scroll", handleListScroll);
  }

  if (scrollThumb) {
    scrollThumb.addEventListener("pointerdown", handleThumbPointerDown);
    scrollThumb.addEventListener("pointermove", handleThumbPointerMove);
    scrollThumb.addEventListener("pointerup", handleThumbPointerUp);
    scrollThumb.addEventListener("pointercancel", handleThumbPointerUp);
  }

  if (scrollBar) {
    scrollBar.addEventListener("pointerdown", handleScrollBarPointerDown);
  }

  if (!collectionTitle && searchInput) {
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

  if (!collectionTitle && seriesFilter) {
    seriesFilter.addEventListener("change", () => {
      updateSeriesHeading();
      updateSuggestions(searchInput?.value || "");
      applyFilters();
      updateFilterParam(seriesFilter.value);
    });
  }

  document.addEventListener("click", handleMeasurementToggle);
  window.recipeCookingUI.bindServingSlider(viewContainer, {
    getRecipe: () => getSelectedRecipe(filteredRecipes),
    displayRecipe: applyMeasurementSystem,
    buildIngredientGroups,
    getStepText,
    buildMethodRenderer,
  });
  document.addEventListener("click", handleCookActions);
  viewContainer?.addEventListener("click", handleRecipeSave);
  window.recipeSaves.subscribe(() => {
    const button = viewContainer?.querySelector("[data-save-recipe]");
    if (button) button.setAttribute("aria-pressed", String(window.recipeSaves.has(button.dataset.saveRecipe)));
  });
  if (saveToast) {
    saveToast.addEventListener("pointerenter", scheduleSaveToastDismissal);
    saveToast.addEventListener("pointerleave", scheduleSaveToastDismissal);
    saveToast.addEventListener("focusin", scheduleSaveToastDismissal);
    saveToast.addEventListener("focusout", () => setTimeout(scheduleSaveToastDismissal, 0));
    saveToast.querySelector("button").addEventListener("click", () => {
      saveToast.hidden = true;
      scheduleSaveToastDismissal();
      viewContainer.querySelector("[data-save-recipe]")?.focus({ preventScroll: true });
    });
  }
  refreshIcons();
}

initLibrary();
