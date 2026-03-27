const PREVIEW_STORAGE_KEY = "recipe-site-draft";

const listScroll = document.getElementById("azListScroll");
const listContainer = document.getElementById("azList");
const viewContainer = document.getElementById("azRecipeView");
const searchInput = document.getElementById("azSearchInput");
const seriesFilter = document.getElementById("azSeriesFilter");
const suggestions = document.getElementById("azSuggestions");
const scrollBubble = document.getElementById("azScrollBubble");

let allRecipes = [];
let filteredRecipes = [];
let selectedRecipeId = null;
let activeCategory = "";
let standaloneRecipeView = false;
let letterMarkers = [];
let bubbleTimer = null;
let measurementSystem = "au";

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

async function loadRecipes() {
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

const COOKING_KEYWORDS = [
  "preheat",
  "bake",
  "roast",
  "broil",
  "grill",
  "simmer",
  "boil",
  "fry",
  "saute",
  "sauté",
  "stir-fry",
  "air fry",
  "cook",
  "oven",
  "microwave",
  "skillet",
  "pan",
  "heat",
  "sear",
  "brown",
  "golden",
  "crispy",
];

function isCookingInstruction(text) {
  const normalized = normalizeText(text);
  if (!normalized) {
    return false;
  }
  if (COOKING_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return true;
  }
  if (/\b\d+\s?(mins?|minutes?|hrs?|hours?)\b/.test(normalized)) {
    return true;
  }
  if (/\b\d{2,3}\s?°\s?[cf]?\b/.test(normalized)) {
    return true;
  }
  if (/\b\d{2,3}\s?(c|f|celsius|fahrenheit)\b/.test(normalized)) {
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

const TAG_COLORS = [
  "tag-color-rose",
  "tag-color-peach",
  "tag-color-mint",
  "tag-color-sky",
  "tag-color-lemon",
  "tag-color-lilac",
];

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function getTagColorClass(tag) {
  const index = hashString(tag.toLowerCase()) % TAG_COLORS.length;
  return TAG_COLORS[index];
}

const MEASUREMENT_STORAGE_KEY = "recipe-site-measurement";
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
      return category.includes("dessert") || haystack.includes("bake");
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
  if (lower.startsWith("kg")) {
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

function convertMeasurementText(text, fromSystem, toSystem) {
  if (!text) {
    return text;
  }
  return text.replace(MEASURE_REGEX, (match, startValue, endValue, unitToken) => {
    const unit = normalizeMeasureUnit(unitToken);
    const start = parseInlineQuantity(startValue);
    if (!Number.isFinite(start)) {
      return match;
    }
    if (isWeightUnit(unit)) {
      if (endValue) {
        const end = parseInlineQuantity(endValue);
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
        return `${formatMeasureAmount(convertedStart, targetUnit)}-${formatMeasureAmount(
          convertedEnd,
          targetUnit
        )} ${label}`;
      }
      const converted = convertWeight(start, unit, toSystem);
      const label = formatMeasureLabel(converted.unit, converted.value);
      return `${formatMeasureAmount(converted.value, converted.unit)} ${label}`;
    }
    const convertedStart = convertMeasure(start, unit, fromSystem, toSystem);
    if (endValue) {
      const end = parseInlineQuantity(endValue);
      if (!Number.isFinite(end)) {
        return match;
      }
      const convertedEnd = convertMeasure(end, unit, fromSystem, toSystem);
      const label = formatMeasureLabel(
        convertedStart.unit,
        Math.max(convertedStart.value, convertedEnd.value)
      );
      return `${formatMeasureAmount(convertedStart.value, convertedStart.unit)}-${formatMeasureAmount(
        convertedEnd.value,
        convertedStart.unit
      )} ${label}`;
    }
    const label = formatMeasureLabel(convertedStart.unit, convertedStart.value);
    return `${formatMeasureAmount(convertedStart.value, convertedStart.unit)} ${label}`;
  });
}

function applyMeasurementSystem(recipe) {
  if (!recipe) {
    return recipe;
  }
  return {
    ...recipe,
    ingredients: (recipe.ingredients || []).map((item) =>
      convertMeasurementText(item, MEASUREMENT_BASE, measurementSystem)
    ),
    steps: (recipe.steps || []).map((step) => {
      const converted = convertMeasurementText(
        getStepText(step),
        MEASUREMENT_BASE,
        measurementSystem
      );
      if (step && typeof step === "object") {
        return { ...step, text: converted };
      }
      return converted;
    }),
    notes: recipe.notes
      ? convertMeasurementText(recipe.notes, MEASUREMENT_BASE, measurementSystem)
      : recipe.notes,
  };
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

function buildShoppingItems(groups) {
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
      output.push(`${formatWeight(entry.weightG)} ${name}`);
      return;
    }
    if (entry.hasVolume && Object.keys(entry.volumeUnits).length) {
      const units = Object.keys(entry.volumeUnits).sort(
        (a, b) => volumeOrder.indexOf(a) - volumeOrder.indexOf(b)
      );
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
  const currentMeasureLabel = MEASUREMENT_SYSTEMS[measureSystem]?.label || "US";
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

  const shoppingItems = buildShoppingItems(groups);
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
          <span class="measure-label">US</span>
          <span class="measure-label">AU/UK</span>
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
        <button
          class="ingredient-copy-button"
          type="button"
          data-action="copy-grocery"
          aria-label="Copy grocery list"
          title="Copy grocery list"
          hidden
        >
          <i data-lucide="clipboard"></i>
        </button>
        <button
          class="button button-ghost ingredient-toggle-button"
          type="button"
          data-action="toggle-ingredients"
          aria-pressed="false"
        >
          Convert to grocery list
        </button>
      </div>
    </section>
  `;
}

function buildRecipeViewMarkup(recipe, options = {}) {
  if (!recipe) {
    return '<div class="empty-state">No recipe is available yet.</div>';
  }

  const showCookButton = options.showCookButton !== false;
  const showBackButton = options.showBackButton === true;
  const backHref = options.backHref || "./index.html";
  const backLabel = options.backLabel || "Return to main page";
  const yieldLabel = getYieldLabel(recipe);
  const showNutrition = isHealthyRecipe(recipe);
  const ingredientOverviewMarkup = buildIngredientOverviewMarkup(recipe.ingredients || [], {
    measureSystem: measurementSystem,
  });

  const methodItems = (recipe.steps || [])
    .map((item, index) => {
      const stepText = getStepText(item);
      const stepIsCook = isCookStep(item);
      return `
        <article class="step-card notebook-card${stepIsCook ? " is-cook-step" : ""}">
          <div class="step-card-header">
            <div class="step-number">Step ${index + 1}</div>
            ${
              stepIsCook
                ? '<span class="step-cook-badge"><i data-lucide="flame"></i><span>Cook</span></span>'
                : ""
            }
          </div>
          <p>${escapeHtml(stepText)}</p>
        </article>
      `;
    })
    .join("");
  const tagItems = (recipe.tags || [])
    .map(
      (tag) => `<span class="${getTagColorClass(tag)}">${escapeHtml(tag)}</span>`
    )
    .join("");

  const metaItems = [
    recipe.prepTime && ["Prep", recipe.prepTime],
    recipe.cookTime && ["Cook", recipe.cookTime],
    recipe.serves && [yieldLabel, recipe.serves],
  ].filter(Boolean);

  const metaMarkup = metaItems.length
    ? metaItems
        .map(
          ([label, value]) => `
            <div class="recipe-meta-item">
              <span>${escapeHtml(label)}</span>
              <strong>${escapeHtml(value)}</strong>
            </div>
          `
        )
        .join("")
    : "";
  const nutritionEntries = showNutrition
    ? [
        ["Calories", recipe.nutrition?.calories],
        ["Protein", recipe.nutrition?.protein],
        ["Carbs", recipe.nutrition?.carbs],
        ["Fat", recipe.nutrition?.fat],
      ].filter(([, value]) => value)
    : [];
  const nutritionMarkup = nutritionEntries.length
    ? `
        <section class="sidebar-card notebook-card">
          <div class="subsection-heading compact">
            <p class="section-kicker">Nutrition</p>
            <h2>Per serve</h2>
          </div>
          <div class="info-stack nutrition-stack">
            ${nutritionEntries
              .map(
                ([label, value]) =>
                  `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`
              )
              .join("")}
          </div>
        </section>
      `
    : "";

  const cookButtonMarkup = showCookButton
    ? `
        <button class="button button-ghost lets-cook-button" type="button" data-action="lets-cook">
          Let's cook
        </button>
      `
    : "";

  return `
    <article class="recipe-layout">
      <section class="recipe-main notebook-card">
        ${
          showBackButton
            ? `
              <div class="recipe-main-top">
                <a
                  class="button button-ghost back-button recipe-back-button hero-action-right"
                  href="${backHref}"
                >
                  ${escapeHtml(backLabel)}
                </a>
              </div>
            `
            : ""
        }
        <div class="recipe-hero-grid">
          <div class="recipe-hero-media">
            <img
              class="recipe-hero-image"
              src="${escapeHtml(recipe.image || "")}" 
              alt="${escapeHtml(recipe.title)}"
            />
          </div>
          <div class="recipe-hero-copy">
            <p class="recipe-category">${escapeHtml(recipe.category || "Recipe")}</p>
            <h1 class="recipe-page-title">${escapeHtml(recipe.title)}</h1>
            <p class="recipe-page-description">${escapeHtml(recipe.description || "")}</p>
            ${metaMarkup ? `<div class="recipe-meta-grid">${metaMarkup}</div>` : ""}
            ${tagItems ? `<div class="tag-row">${tagItems}</div>` : ""}
            <div class="recipe-cta-row">${cookButtonMarkup}</div>
          </div>
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
        ${ingredientOverviewMarkup}
        ${nutritionMarkup}
      </aside>
    </article>
  `;
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
    !normalizedCategory || normalizeText(recipe.category) === normalizedCategory;
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

function selectRecipe(recipeId) {
  selectedRecipeId = recipeId;
  const selected = filteredRecipes.find((recipe) => recipe.id === recipeId) || filteredRecipes[0];
  renderRecipeView(selected || null);
  updateActiveListItem();
}

function renderRecipeView(recipe) {
  if (!viewContainer) {
    return;
  }
  const displayRecipe = applyMeasurementSystem(recipe);
  viewContainer.innerHTML = buildRecipeViewMarkup(displayRecipe, {
    showCookButton: false,
    showBackButton: false,
  });
  refreshIcons();
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
    listContainer.innerHTML = '<div class="empty-state">No recipes match this search yet.</div>';
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

    const item = document.createElement("button");
    item.type = "button";
    item.className = "az-list-item notebook-card";
    item.dataset.recipeId = recipe.id;
    item.innerHTML = `
      <div class="az-list-row">
        <strong class="az-list-title">${escapeHtml(recipe.title || "Untitled recipe")}</strong>
        <span class="az-list-category">${escapeHtml(recipe.category || "Recipe")}</span>
      </div>
      <p class="az-list-description">${escapeHtml(recipe.description || "")}</p>
    `;
    item.addEventListener("click", () => {
      selectRecipe(recipe.id);
    });

    listContainer.append(item);
  });

  letterMarkers = Array.from(listContainer.querySelectorAll(".az-letter-marker"));
  updateActiveListItem();
  updateScrollBubble();
}

function updateScrollBubble() {
  if (!scrollBubble || !listScroll || !letterMarkers.length) {
    if (scrollBubble) {
      scrollBubble.classList.remove("is-visible");
    }
    return;
  }

  const scrollTop = listScroll.scrollTop;
  let currentLetter = letterMarkers[0]?.dataset.letter || "";

  for (const marker of letterMarkers) {
    if (marker.offsetTop <= scrollTop + 12) {
      currentLetter = marker.dataset.letter;
    } else {
      break;
    }
  }

  if (currentLetter) {
    scrollBubble.textContent = currentLetter;
  }
}

function handleListScroll() {
  updateScrollBubble();
  if (!scrollBubble) {
    return;
  }
  scrollBubble.classList.add("is-visible");
  if (bubbleTimer) {
    clearTimeout(bubbleTimer);
  }
  bubbleTimer = setTimeout(() => {
    scrollBubble.classList.remove("is-visible");
  }, 800);
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

  const matches = allRecipes
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
  const searchTerm = normalizeText(searchInput?.value || "");
  const series = seriesFilter?.value || "all";
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

function updateSeriesParam(series) {
  const url = new URL(window.location.href);
  if (series && series !== "all") {
    url.searchParams.set("series", series);
  } else {
    url.searchParams.delete("series");
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
    copyGroceryList(container);
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
    const copyToggle = container.querySelector(".ingredient-copy-button");
    if (copyToggle) {
      copyToggle.hidden = !isShoppingView;
    }
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
  const copyToggle = container.querySelector(".ingredient-copy-button");
  if (copyToggle) {
    copyToggle.hidden = !isShoppingView;
  }
  if (toggleButton) {
    toggleButton.setAttribute("aria-pressed", String(isShoppingView));
    toggleButton.textContent = isShoppingView ? "Back to ingredients list" : "Convert to grocery list";
  }
}

function copyGroceryList(container) {
  const items = Array.from(container.querySelectorAll(".shopping-item span"))
    .map((node) => node.textContent.trim())
    .filter(Boolean);
  if (!items.length) {
    return;
  }
  const text = items.join("\n");
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch((error) => console.error(error));
  } else {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
  const copyButton = container.querySelector(".ingredient-copy-button");
  if (copyButton) {
    copyButton.classList.add("is-copied");
    setTimeout(() => copyButton.classList.remove("is-copied"), 1200);
  }
}

async function initLibrary() {
  measurementSystem = loadMeasurementSystem();
  allRecipes = await loadRecipes();
  allRecipes.sort((a, b) =>
    String(a?.title || "").localeCompare(String(b?.title || ""), undefined, {
      sensitivity: "base",
    })
  );
  filteredRecipes = [...allRecipes];

  const params = new URLSearchParams(window.location.search);
  const seriesParam = params.get("series");
  const categoryParam = params.get("category");
  const recipeParam = params.get("recipe");
  if (categoryParam) {
    activeCategory = categoryParam;
  }
  if (recipeParam) {
    selectedRecipeId = recipeParam;
    standaloneRecipeView = true;
    document.body.classList.add("is-standalone-recipe");
  }
  if (seriesFilter && seriesParam) {
    const match = Array.from(seriesFilter.options).find(
      (option) => normalizeText(option.value) === normalizeText(seriesParam)
    );
    if (match) {
      seriesFilter.value = match.value;
    }
  }

  selectedRecipeId = selectedRecipeId || filteredRecipes[0]?.id || null;
  applyFilters();

  if (listScroll) {
    listScroll.addEventListener("scroll", handleListScroll);
  }

  if (searchInput) {
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

  if (seriesFilter) {
    seriesFilter.addEventListener("change", () => {
      applyFilters();
      updateSeriesParam(seriesFilter.value);
    });
  }

  document.addEventListener("click", handleIngredientTabs);
  document.addEventListener("click", handleMeasurementToggle);
  refreshIcons();
}

initLibrary();
