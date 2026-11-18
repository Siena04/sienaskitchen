(() => {
  const number = String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?(?:\s*[¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])?|[¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])`;
  const quantity = String.raw`${number}(?:(?:\s*[-–—]\s*|\s+to\s+)${number})?`;
  const unit = String.raw`(?:kilograms?|kg|milligrams?|mg|grams?|g|millilit(?:res?|ers?)|ml|lit(?:res?|ers?)|l|ounces?|oz|pounds?|lbs?|tablespoons?|tbsp\.?|teaspoons?|tsp\.?|cups?|pints?|quarts?|pinche?s?|dashes?|handfuls?|bunch(?:es)?|bags?|packs?|packets?|tins?|cans?|cloves?|slices?|pieces?|sheets?|stalks?|sprigs?|heads?|drops?)`;
  const leadingAmount = new RegExp(String.raw`^(${quantity}(?:\s*(?:x|×)\s*${quantity})?(?:\s*${unit})?)(?=\s|$)`, 'i');
  const existingPrefix = new RegExp(String.raw`(?:^|[\s(])(?:${quantity}(?:\s*${unit})?|a\s+(?:pinch|dash|handful)|half|remaining|rest)(?:\s+of)?(?:\s+the)?\s*$`, 'i');
  const existingSuffix = new RegExp(String.raw`^\s*\(\s*(?:(?:about|approx\.?|roughly)\s+)?${quantity}`, 'i');
  const termKey = (term) => term.trim().toLowerCase().replace(/\s+/g, ' ');

  function createLookup(ingredients, buildTerms) {
    const matches = new Map();
    for (const item of ingredients) {
      const line = String(item ?? '').trim().replace(/^[•*–—-]\s*/, '');
      if (!line || line.endsWith(':')) continue;
      const amount = line.match(leadingAmount)?.[1] || '';
      const name = line.slice(amount.length).trim().replace(/^of\s+/i, '');
      for (const term of buildTerms([name])) {
        const key = termKey(term);
        if (!matches.has(key)) matches.set(key, new Set());
        matches.get(key).add(amount);
      }
    }

    return (text, start, mention) => {
      const candidates = matches.get(termKey(mention));
      if (candidates?.size !== 1) return '';
      if (existingPrefix.test(text.slice(0, start)) || existingSuffix.test(text.slice(start + mention.length))) return '';
      return candidates.values().next().value;
    };
  }

  let showAmounts = false;
  function toggleMarkup() {
    return `<button class="button button-ghost method-quantity-toggle" type="button" aria-pressed="${showAmounts}">Add quantities to method</button>`;
  }

  document.addEventListener('click', (event) => {
    const toggle = event.target.closest('.method-quantity-toggle');
    if (!toggle) return;
    showAmounts = !showAmounts;
    document.body.classList.toggle('show-method-quantities', showAmounts);
    document.querySelectorAll('.method-quantity-toggle').forEach((button) => {
      button.setAttribute('aria-pressed', String(showAmounts));
    });
  });

  window.methodQuantities = { createLookup, toggleMarkup };
})();
