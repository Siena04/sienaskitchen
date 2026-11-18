(() => {
  const number = String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?(?:\s*[¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])?|[¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])`;
  const quantity = String.raw`${number}(?:(?:\s*[-–—]\s*|\s+to\s+)${number})?`;
  const unit = String.raw`(?:kilograms?|kg|milligrams?|mg|grams?|g|millilit(?:res?|ers?)|ml|lit(?:res?|ers?)|l|ounces?|oz|pounds?|lbs?|tablespoons?|tbsp\.?|teaspoons?|tsp\.?|cups?|pints?|quarts?|pinche?s?|dashes?|handfuls?|bunch(?:es)?|bags?|packs?|packets?|tins?|cans?|cloves?|slices?|pieces?|sheets?|stalks?|sprigs?|heads?|drops?)`;
  const leadingAmount = new RegExp(String.raw`^(${quantity}(?:\s*(?:x|×)\s*${quantity})?(?:\s*${unit})?)(?=\s|$)`, 'i');
  const explicitAmount = new RegExp('(?:^|[\\s(])(?:' + quantity + '(?:\\s*' + unit + ')?(?:\\s+more)?|a\\s+(?:pinch|dash|handful|splash|knob)|a|an|half|remaining|rest|extra|reserved|leftover)(?:\\s+of)?(?:\\s+the)?\\s*$', 'i');
  const measuredOrPrepared = new RegExp('^\\s*(?:\\(\\s*(?:(?:about|approx\\.?|roughly)\\s+)?' + quantity + '|\\b(?:mixture|batter|dough|ingredients|crust|strips?|slices?|pieces?|turns?|is|are)\\b)', 'i');
  const termKey = (term) => term.trim().toLowerCase().replace(/\s+/g, ' ');
  const escapePattern = (term) => term.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');

  const genericTerms = new Set([
    'cheese', 'flour', 'juice', 'oil', 'paste', 'pepper', 'powder', 'sauce', 'stock', 'water',
  ]);
  const preparation = /^(?:(?:finely|roughly|thinly|freshly|fresh|dried|ground|grated|chopped|minced|sliced|diced|crushed|large|medium|small|plain)\s+)+/i;

  function makeRenderer(groups, steps, normalizeName, escapeHtml) {
    const matches = new Map();
    const componentPatterns = groups.map(({ title, items }, groupIndex) => {
      for (const item of items) {
        const line = item.replace(/^[•*–—-]\s*/, '');
        const amount = line.match(leadingAmount)?.[1] || '';
        const name = line.slice(amount.length).trim().replace(/^of\s+/i, '');
        const literalName = termKey(name.split(/[,()]/, 1)[0]);
        const canonicalName = normalizeName(literalName);
        const words = canonicalName.split(' ');
        const ends = words.map((_, index) => words.slice(index).join(' '));
        const terms = new Set([
          literalName,
          canonicalName,
          literalName.replace(preparation, ''),
          ...ends.slice(1).filter((term) => !genericTerms.has(term)),
        ]);
        if (literalName === 'large egg' || literalName === 'egg') terms.add('whole egg');
        if (/^(?:lemon|lime), juiced\b/i.test(name)) terms.add(literalName + ' juice');
        if (/^wombok \(Chinese cabbage\)/i.test(name)) {
          terms.add('chinese cabbage');
          terms.add('cabbage');
        }
        if (/^chicken (?:breasts?|thighs?|thigh (?:fillets?|cutlets?))$/i.test(literalName)) terms.add('chicken');
        if (literalName === 'feta cheese') terms.add('feta');
        if (/^finely chopped fresh parsley$/i.test(literalName)) terms.add('chopped parsley');

        const exactTerms = new Set([literalName, canonicalName, literalName.replace(preparation, '')]);
        if (!amount && /, to taste$/i.test(name)) {
          name.replace(/, to taste$/i, '').split(/,\s*(?:and\s+)?|\s+and\s+/i).forEach((part) => {
            const key = termKey(part);
            exactTerms.add(key);
            terms.add(key);
          });
        }
        if (literalName === 'butter' && /, cubed\b/i.test(name)) terms.add('butter cube');
        const row = { line, groupIndex, amount, exactTerms };
        for (const term of terms) {
          if (!term) continue;
          if (!matches.has(term)) matches.set(term, []);
          matches.get(term).push(row);
        }
      }

      const heading = escapePattern(title.replace(/\s*\([^)]*\)\s*$/, ''));
      return new RegExp(
        '^(?:for\\s+(?:the\\s+)?)?' + heading + '(?=\\s*[:,–—]|\\s*$)|' +
        '\\b(?:for|make|prepare|start with)\\s+(?:the\\s+)?' + heading + '(?=\\s*(?:[:,.;–—]|$)|\\s+(?:by|mixture)\\b)|' +
        '\\b' + heading + '\\s+ingredients\\b',
        'gi',
      );
    });

    if (!matches.size) return (text) => escapeHtml(text);
    const pattern = [...matches.keys()].sort((a, b) => b.length - a.length).map(escapePattern).join('|');
    const matcher = new RegExp('(^|[^A-Za-z0-9_])(' + pattern + ')(?=$|[^A-Za-z0-9_])', 'gi');
    let activeGroup = -1;
    const rendered = steps.map((text) => {
      const cues = componentPatterns
        .flatMap((pattern, groupIndex) => Array.from(text.matchAll(pattern), (match) => ({
          groupIndex,
          start: match.index,
          end: match.index + match[0].length,
        })))
        .sort((a, b) => a.start - b.start);
      const startingGroup = cues.length === 1 ? cues[0].groupIndex : activeGroup;
      if (cues.length) activeGroup = cues.at(-1).groupIndex;
      const usedRows = new Set();

      let markup = '';
      let lastIndex = 0;
      text.replace(matcher, (match, prefix, mention, offset) => {
        const start = offset + prefix.length;
        const end = start + mention.length;
        const before = text.slice(0, start);
        const after = text.slice(end);
        if (cues.some((cue) => start < cue.end && end > cue.start)) return match;
        const key = termKey(mention);
        const candidates = matches.get(key);
        const component = cues.filter((cue) => cue.end <= start).at(-1)?.groupIndex ?? startingGroup;
        const groupMatches = candidates.filter((row) => row.groupIndex === component);
        const rows = groupMatches.length ? groupMatches : candidates;
        const exactRows = rows.filter((row) => row.exactTerms.has(key));
        const bestRows = exactRows.length ? exactRows : rows;
        const row = bestRows.length === 1 ? bestRows[0] : null;
        let content = escapeHtml(mention);
        const boilingEggs = /\bboil\s+(?:the\s+)?$/i.test(before) && /\bboiled eggs?\b/i.test(row?.line || '');
        if (row?.amount && !usedRows.has(row) && !explicitAmount.test(before) && !measuredOrPrepared.test(after) && !boilingEggs) {
          usedRows.add(row);
          content = '<span class="method-ingredient-original">' + content + '</span>' +
            '<span class="method-ingredient-replacement">' + escapeHtml(row.line) + '</span>';
        }
        markup += escapeHtml(text.slice(lastIndex, start)) + '<strong class="ingredient-mention">' + content + '</strong>';
        lastIndex = end;
        return match;
      });
      return markup + escapeHtml(text.slice(lastIndex));
    });

    return (text, index) => rendered[index] || escapeHtml(text);
  }

  const toggleLabel = () => showAmounts ? 'Remove quantities from method' : 'Add quantities to method';
  let showAmounts = false;
  function toggleMarkup() {
    return `<button class="button button-ghost method-quantity-toggle" type="button" aria-pressed="${showAmounts}">${toggleLabel()}</button>`;
  }

  document.addEventListener('click', (event) => {
    const toggle = event.target.closest('.method-quantity-toggle');
    if (!toggle) return;
    showAmounts = !showAmounts;
    document.body.classList.toggle('show-method-quantities', showAmounts);
    document.querySelectorAll('.method-quantity-toggle').forEach((button) => {
      button.setAttribute('aria-pressed', String(showAmounts));
      button.textContent = toggleLabel();
    });
  });

  window.methodQuantities = { makeRenderer, toggleMarkup };
})();
