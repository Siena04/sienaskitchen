export const UNITS = [
  { id: "us_cup", label: "US cups", kind: "volume", toMl: 236.588 },
  { id: "au_cup", label: "Australian/UK cups", kind: "volume", toMl: 250 },
  { id: "ml", label: "mL", kind: "volume", toMl: 1 },
  { id: "g", label: "grams", kind: "weight", toGram: 1 },
  { id: "us_tbsp", label: "US tablespoons", kind: "volume", toMl: 14.7868 },
  { id: "au_tbsp", label: "Australian/UK tablespoons", kind: "volume", toMl: 20 },
  { id: "tsp", label: "teaspoons", kind: "volume", toMl: 5 },
];

export const INGREDIENTS = [
  { id: "all-purpose-flour", label: "All-purpose flour / plain flour", gramsPerUsCup: 120 },
  { id: "self-raising-flour", label: "Self-raising flour", gramsPerUsCup: 120 },
  { id: "bread-flour", label: "Bread flour", gramsPerUsCup: 127 },
  { id: "caster-sugar", label: "Caster sugar", gramsPerUsCup: 200 },
  { id: "granulated-sugar", label: "Granulated sugar", gramsPerUsCup: 200 },
  { id: "brown-sugar", label: "Brown sugar (packed)", gramsPerUsCup: 220 },
  { id: "icing-sugar", label: "Icing sugar / powdered sugar", gramsPerUsCup: 120 },
  { id: "butter", label: "Butter", gramsPerUsCup: 227 },
  { id: "honey", label: "Honey", gramsPerUsCup: 340 },
  { id: "rolled-oats", label: "Rolled oats", gramsPerUsCup: 90 },
  { id: "cocoa-powder", label: "Cocoa powder", gramsPerUsCup: 85 },
  { id: "rice", label: "Rice (uncooked)", gramsPerUsCup: 185 },
  { id: "milk", label: "Milk", gramsPerUsCup: 240 },
  { id: "greek-yogurt", label: "Greek yogurt", gramsPerUsCup: 280 },
  { id: "oil", label: "Oil", gramsPerUsCup: 218 },
];

export const POPULAR_INGREDIENTS = [
  "all-purpose-flour",
  "butter",
  "caster-sugar",
  "honey",
];
