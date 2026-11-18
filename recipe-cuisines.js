const recipeCuisines = [
  { id: "chinese", label: "Chinese", recipes: ["chinese-sauteed-wombok", "pork-prawn-dumplings"] },
  { id: "mediterranean", label: "Mediterranean", recipes: ["greek-sheet-pan-chicken"], aliases: ["greek"] },
  { id: "japanese", label: "Japanese", recipes: ["chicken-karaage", "simmered-hijiki-salad", "miso-edamame-risoni"], aliases: ["japanese-inspired"] },
  { id: "italian", label: "Italian", recipes: ["chicken-crust-pizza"], aliases: ["italian-inspired"] },
  { id: "thai", label: "Thai", recipes: [] },
  { id: "indian", label: "Indian", recipes: [] },
  { id: "greek", label: "Greek", recipes: ["greek-sheet-pan-chicken"] },
  { id: "korean", label: "Korean", recipes: ["korean-tofu-pancakes", "korean-mayak-drug-eggs", "korean-chicken-tteokbokki-stew"] },
  { id: "tex-mex", label: "Tex-Mex-inspired", recipes: ["chilli-con-carne"] },
];

function recipeMatchesCuisine(recipe, cuisine) {
  return cuisine.recipes.includes(recipe.id) || (recipe.tags || []).some((tag) => {
    const name = String(tag).trim().toLowerCase();
    return name === cuisine.id || name === cuisine.label.toLowerCase() || cuisine.aliases?.includes(name);
  });
}
