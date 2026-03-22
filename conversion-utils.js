import { UNITS, INGREDIENTS } from "./conversion-data.js";

const unitMap = new Map(UNITS.map((unit) => [unit.id, unit]));
const ingredientMap = new Map(INGREDIENTS.map((ingredient) => [ingredient.id, ingredient]));

const FRACTIONS = [
  { value: 0.25, label: "1/4" },
  { value: 1 / 3, label: "1/3" },
  { value: 0.5, label: "1/2" },
  { value: 2 / 3, label: "2/3" },
  { value: 0.75, label: "3/4" },
];

const FRACTION_TOLERANCE = 0.04;

export function getUnit(unitId) {
  return unitMap.get(unitId);
}

export function getIngredient(ingredientId) {
  return ingredientMap.get(ingredientId);
}

export function isVolumeUnit(unitId) {
  return getUnit(unitId)?.kind === "volume";
}

export function isWeightUnit(unitId) {
  return getUnit(unitId)?.kind === "weight";
}

export function requiresIngredient(fromId, toId) {
  return isVolumeUnit(fromId) !== isVolumeUnit(toId);
}

export function convertValue(value, fromId, toId, ingredientId) {
  const fromUnit = getUnit(fromId);
  const toUnit = getUnit(toId);

  if (!fromUnit || !toUnit || Number.isNaN(value)) {
    return { error: "invalid" };
  }

  if (fromId === toId) {
    return { value, approx: false };
  }

  if (fromUnit.kind === toUnit.kind) {
    if (fromUnit.kind === "volume") {
      const ml = value * fromUnit.toMl;
      return { value: ml / toUnit.toMl, approx: false };
    }
    const grams = value * (fromUnit.toGram || 1);
    return { value: grams / (toUnit.toGram || 1), approx: false };
  }

  if (!ingredientId) {
    return { error: "ingredient_required" };
  }

  const ingredient = getIngredient(ingredientId);
  if (!ingredient) {
    return { error: "ingredient_required" };
  }

  const gramsPerMl = ingredient.gramsPerUsCup / 236.588;

  if (fromUnit.kind === "volume") {
    const ml = value * fromUnit.toMl;
    return { value: ml * gramsPerMl, approx: true };
  }

  const grams = value * (fromUnit.toGram || 1);
  const ml = grams / gramsPerMl;
  return { value: ml / toUnit.toMl, approx: true };
}

export function formatNumber(value) {
  const abs = Math.abs(value);
  let decimals = 2;
  if (abs >= 100) {
    decimals = 0;
  } else if (abs >= 10) {
    decimals = 1;
  } else if (abs < 1) {
    decimals = 3;
  }

  return value
    .toFixed(decimals)
    .replace(/\\.0+$/, "")
    .replace(/(\\.\\d*[1-9])0+$/, "$1");
}

export function formatCupValue(value) {
  const whole = Math.floor(value + 1e-6);
  const remainder = value - whole;
  const fraction = FRACTIONS.find((candidate) => Math.abs(remainder - candidate.value) < FRACTION_TOLERANCE);

  if (!fraction) {
    return formatNumber(value);
  }

  if (whole <= 0) {
    return fraction.label;
  }

  return `${whole} ${fraction.label}`;
}
