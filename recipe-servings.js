(() => {
  const selectedServings = new Map();
  const quantity = String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)`;
  const range = String.raw`(${quantity})(?:\s*(?:[-–—]|to)\s*(${quantity}))?`;
  const unit = String.raw`(?:cups?|tbsp|tablespoons?|tsp|teaspoons?|kg|kilograms?|g|grams?|oz|ounces?|lbs?|pounds?|ml|liters?|litres?|l)\b`;
  const leadingAmount = new RegExp(String.raw`^\s*${range}(?=\s|${unit}|$)`, "i");
  const leadingMeasure = new RegExp(String.raw`^\s*${range}\s*${unit}`, "i");
  const methodAmount = new RegExp(String.raw`\b${range}(\s*${unit})?`, "gi");
  const measureRange = new RegExp(String.raw`${range}\s*(?=${unit})`, "gi");
  const fractions = { "¼": "1/4", "½": "1/2", "¾": "3/4", "⅓": "1/3", "⅔": "2/3",
    "⅛": "1/8", "⅜": "3/8", "⅝": "5/8", "⅞": "7/8", "⅙": "1/6", "⅚": "5/6" };

  function normalizeFractions(text) {
    return text.replace(/[¼½¾⅓⅔⅛⅜⅝⅞⅙⅚]/g, (symbol, index) =>
      (/\d/.test(text[index - 1] || "") ? " " : "") + fractions[symbol]
    );
  }

  function parseAmount(value) {
    return value.split(/\s+/).reduce((sum, part) => {
      const [number, denominator = 1] = part.split("/").map(Number);
      return sum + number / denominator;
    }, 0);
  }

  function formatAmount(value, preferFraction = true) {
    if (!Number.isFinite(value)) return "";
    const whole = Math.floor(value);
    const fraction = value - whole;
    if (preferFraction && fraction > 0) {
      for (const denominator of [2, 3, 4, 6, 8, 12, 16]) {
        const numerator = Math.round(fraction * denominator);
        if (numerator > 0 && numerator < denominator && Math.abs(fraction - numerator / denominator) < 0.00001) {
          return (whole ? `${whole} ` : "") + `${numerator}/${denominator}`;
        }
      }
    }
    return String(Number(value.toPrecision(4)));
  }

  function scaleRange(start, end, factor) {
    const first = formatAmount(parseAmount(start) * factor);
    return end ? `${first}–${formatAmount(parseAmount(end) * factor)}` : first;
  }

  function originalServings(value) {
    const match = normalizeFractions(String(value ?? "")).match(new RegExp(quantity));
    const count = match ? parseAmount(match[0]) : 1;
    return Number.isFinite(count) && count > 0 ? count : 1;
  }

  function sliderValue(value) {
    return Math.max(0.5, Math.min(10, Math.round(value * 2) / 2));
  }

  function set(recipeId, value) {
    if (Number.isFinite(value)) selectedServings.set(recipeId, sliderValue(value));
  }

  function displayRecipe(recipe, system, convert, getStepText, normalizeIngredientName) {
    if (!recipe) return recipe;
    const base = originalServings(recipe.serves);
    const servings = selectedServings.get(recipe.id) ?? sliderValue(base);
    const factor = servings / base;
    const source = recipe.measurementSystem === "us" ? "us" : "au";
    const ingredients = recipe.ingredients || [];
    const convertText = (text, ratio = 1) => convert(text, source, system, ratio);
    let ingredientFactor = factor;
    let scalingPerPerson = false;
    const methodIngredients = [];
    const scaledIngredients = ingredients.map((item) => {
      if (item.trim().endsWith(":")) {
        const perPerson = /\s*\(per person\)(?=:\s*$)/i;
        scalingPerPerson = factor !== 1 && perPerson.test(item);
        ingredientFactor = scalingPerPerson ? servings : factor;
        return scalingPerPerson ? item.replace(perPerson, "") : item;
      }
      if (factor !== 1) {
        const name = normalizeIngredientName(normalizeFractions(item).split(/[,()]/, 1)[0]);
        if (name) methodIngredients.push({ name, factor: ingredientFactor });
      }
      if (ingredientFactor === 1 && !scalingPerPerson) return convertText(item);
      let line = normalizeFractions(item);
      if (scalingPerPerson) {
        const batch = line.match(/\(\s*(\d+(?:\.\d+)?)\s+[^()]+?\s+for\s+(\d+(?:\.\d+)?)\s+(?:people|servings)\s*\)/i);
        if (batch && Number(batch[2]) > 0 && leadingAmount.test(line) && !leadingMeasure.test(line)) {
          return convertText(line.replace(batch[0], "").replace(leadingAmount, formatAmount(Number(batch[1]) * servings / Number(batch[2]))).trimEnd(), ingredientFactor);
        }
      }
      // Equivalent amounts in parentheses are part of the ingredient, unlike times.
      line = line.replace(measureRange, (_, start, end) => end ? `${start}-${end} ` : `${start} `);
      if (!leadingMeasure.test(line)) {
        line = line.replace(leadingAmount, (_, start, end) => scaleRange(start, end, ingredientFactor));
      }
      return convertText(line, ingredientFactor);
    });

    methodIngredients.sort((a, b) => b.name.length - a.name.length);
    const steps = (recipe.steps || []).map((step) => {
      const raw = getStepText(step);
      const text = factor === 1 ? convertText(raw) : normalizeFractions(raw)
        .replace(methodAmount, (match, start, end, measurement, offset, full) => {
          const following = normalizeIngredientName(full.slice(offset + match.length)).replace(/^(?:(?:of|the)\s+)+/, "");
          const ratio = methodIngredients.find(({ name }) => following === name || following.startsWith(name + " "))?.factor ?? 1;
          if (!measurement) return ratio === 1 ? match : scaleRange(start, end, ratio);
          return convertText(`${start}${end ? "-" + end : ""}${measurement}`, ratio);
        });
      return step && typeof step === "object" ? { ...step, text } : text;
    });
    return { ...recipe, serves: servings, ingredients: scaledIngredients, steps, notes: recipe.notes ? convertText(recipe.notes) : recipe.notes };
  }

  window.recipeServings = { displayRecipe, formatAmount, set };
})();
