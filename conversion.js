import { UNITS, INGREDIENTS, POPULAR_INGREDIENTS } from "./conversion-data.js";
import {
  getUnit,
  getIngredient,
  requiresIngredient,
  convertValue,
  formatNumber,
  formatCupValue,
} from "./conversion-utils.js";

const amountInput = document.getElementById("amountInput");
const fromUnitSelect = document.getElementById("fromUnit");
const toUnitSelect = document.getElementById("toUnit");
const ingredientSelect = document.getElementById("ingredientSelect");
const swapButton = document.getElementById("swapButton");
const convertButton = document.getElementById("convertButton");
const copyButton = document.getElementById("copyButton");
const helperText = document.getElementById("converterHelper");
const resultBox = document.getElementById("converterResult");
const resultOutput = document.getElementById("resultOutput");
const referenceConversions = document.getElementById("referenceConversions");

const UNIT_LABELS = {
  us_cup: { singular: "US cup", plural: "US cups" },
  au_cup: { singular: "Australian/UK cup", plural: "Australian/UK cups" },
  ml: { singular: "mL", plural: "mL" },
  g: { singular: "g", plural: "g" },
  us_tbsp: { singular: "US tbsp", plural: "US tbsp" },
  au_tbsp: { singular: "Australian/UK tbsp", plural: "Australian/UK tbsp" },
  tsp: { singular: "tsp", plural: "tsp" },
};

const DEFAULTS = {
  amount: "1",
  fromUnit: "au_cup",
  toUnit: "g",
  ingredient: "",
};

function getUnitLabel(unitId, value) {
  const entry = UNIT_LABELS[unitId];
  if (!entry) {
    return unitId;
  }
  const abs = Math.abs(value);
  return abs === 1 ? entry.singular : entry.plural;
}

function formatValueForUnit(value, unitId) {
  if (unitId.endsWith("_cup")) {
    return formatCupValue(value);
  }
  return formatNumber(value);
}

function populateUnits() {
  UNITS.forEach((unit) => {
    const option = document.createElement("option");
    option.value = unit.id;
    option.textContent = unit.label;
    fromUnitSelect.append(option.cloneNode(true));
    toUnitSelect.append(option);
  });
}

function populateIngredients() {
  INGREDIENTS.forEach((ingredient) => {
    const option = document.createElement("option");
    option.value = ingredient.id;
    option.textContent = ingredient.label;
    ingredientSelect.append(option);
  });
}

function updateHelper(message) {
  helperText.textContent = message || "";
}

function buildResultLine({
  amount,
  fromUnit,
  toValue,
  toUnit,
  ingredient,
  approx,
}) {
  const fromValue = formatValueForUnit(amount, fromUnit);
  const toValueFormatted = formatValueForUnit(toValue, toUnit);
  const fromLabel = getUnitLabel(fromUnit, amount);
  const toLabel = getUnitLabel(toUnit, toValue);
  const ingredientLabel = ingredient ? ` ${ingredient.label}` : "";
  const symbol = approx ? "≈" : "=";

  return `${fromValue} ${fromLabel}${ingredientLabel} ${symbol} ${toValueFormatted} ${toLabel}`;
}

function updateResult() {
  const amount = Number.parseFloat(amountInput.value);
  const fromUnit = fromUnitSelect.value;
  const toUnit = toUnitSelect.value;
  const ingredientId = ingredientSelect.value;

  if (!amountInput.value || Number.isNaN(amount) || amount <= 0) {
    updateHelper("Enter a number to convert.");
    resultBox.textContent = "";
    if (resultOutput) {
      resultOutput.value = "";
      resultOutput.placeholder = "";
    }
    convertButton.disabled = true;
    return;
  }

  const needsIngredient = requiresIngredient(fromUnit, toUnit);

  if (needsIngredient && !ingredientId) {
    updateHelper("Pick an ingredient to convert between grams and cups accurately.");
    resultBox.textContent = "";
    if (resultOutput) {
      resultOutput.value = "";
      resultOutput.placeholder = "Pick ingredient";
    }
    convertButton.disabled = true;
    return;
  }

  convertButton.disabled = false;

  const conversion = convertValue(amount, fromUnit, toUnit, ingredientId);
  if (conversion.error) {
    updateHelper("Pick an ingredient to convert between grams and cups accurately.");
    resultBox.textContent = "";
    if (resultOutput) {
      resultOutput.value = "";
      resultOutput.placeholder = "Pick ingredient";
    }
    return;
  }

  const ingredient = ingredientId ? getIngredient(ingredientId) : null;
  const line = buildResultLine({
    amount,
    fromUnit,
    toValue: conversion.value,
    toUnit,
    ingredient,
    approx: conversion.approx,
  });

  if (resultOutput) {
    resultOutput.value = formatValueForUnit(conversion.value, toUnit);
    resultOutput.placeholder = "";
  }

  updateHelper(
    needsIngredient ? "Weight conversions depend on ingredient." : "Ingredient optional for this conversion."
  );

  resultBox.innerHTML = `
    <div class="result-line">${line}</div>
    <div class="result-sub">${conversion.approx ? "Approximate result" : "Exact volume conversion"}</div>
  `;
}

async function copyResult() {
  const text = resultBox.querySelector(".result-line")?.textContent?.trim();
  if (!text) {
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    copyButton.textContent = "Copied!";
    setTimeout(() => {
      copyButton.textContent = "Copy result";
    }, 1600);
  } catch (error) {
    console.error(error);
  }
}

function swapUnits() {
  const fromValue = fromUnitSelect.value;
  const toValue = toUnitSelect.value;
  fromUnitSelect.value = toValue;
  toUnitSelect.value = fromValue;
  updateResult();
}

function handlePopularIngredient(event) {
  const target = event.target.closest(".chip");
  if (!target) {
    return;
  }
  const ingredientId = target.dataset.ingredient;
  if (ingredientId) {
    ingredientSelect.value = ingredientId;
    updateResult();
  }
}

function buildReferenceTable() {
  if (!referenceConversions) {
    return;
  }

  const headers = ["Ingredient", "1/4 cup", "1/3 cup", "1/2 cup", "1 cup"];
  const headerMarkup = headers
    .map((label) => `<div class="reference-cell head">${label}</div>`)
    .join("");
  const rows = POPULAR_INGREDIENTS.map((id) => {
    const ingredient = getIngredient(id);
    if (!ingredient) {
      return "";
    }
    const amounts = [0.25, 1 / 3, 0.5, 1].map((fraction) =>
      formatNumber(ingredient.gramsPerUsCup * fraction)
    );
    const cells = [
      `<div class="reference-cell">${ingredient.label}</div>`,
      ...amounts.map((value) => `<div class="reference-cell">${value} g</div>`),
    ];
    return cells.join("");
  }).join("");

  referenceConversions.innerHTML = `
    <div class="reference-grid">
      ${headerMarkup}
      ${rows}
    </div>
  `;
}

function init() {
  populateUnits();
  populateIngredients();

  amountInput.value = DEFAULTS.amount;
  fromUnitSelect.value = DEFAULTS.fromUnit;
  toUnitSelect.value = DEFAULTS.toUnit;
  ingredientSelect.value = DEFAULTS.ingredient;

  updateResult();
  buildReferenceTable();

  amountInput.addEventListener("input", updateResult);
  fromUnitSelect.addEventListener("change", updateResult);
  toUnitSelect.addEventListener("change", updateResult);
  ingredientSelect.addEventListener("change", updateResult);
  convertButton.addEventListener("click", updateResult);
  swapButton.addEventListener("click", swapUnits);
  copyButton.addEventListener("click", copyResult);
  document.addEventListener("click", handlePopularIngredient);

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

init();
