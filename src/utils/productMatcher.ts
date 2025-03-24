import { type Product } from "@prisma/client";
import stringSimilarity from "string-similarity";

export async function matchProductsInText(
  text: string,
  allProducts: Product[],
) {
  const words = text.toLowerCase().split(/\s+/);
  const results: Array<{ product: Product; quantity: number }> = [];

  // Expressões comuns para quantidades
  const quantityRegex =
    /(\d+)\s*(un|unidade|unidades|kg|kilo|kilos|litro|litros|l|g|grama|gramas|pacote|pacotes|caixa|caixas|garrafa|garrafas)/i;

  // Procurar por menções a produtos
  for (const product of allProducts) {
    const productName = product.name.toLowerCase();

    // Verificar menção direta ou similar
    const nameWords = productName.split(/\s+/);
    const foundInText = nameWords.every((word) =>
      words.some((w) => stringSimilarity.compareTwoStrings(w, word) > 0.8),
    );

    if (foundInText) {
      // Tentar encontrar quantidade
      let quantity = 1;
      const quantityMatch = text.match(
        new RegExp(
          `(\\d+)\\s*(?:un|unidade|unidades)?\\s*(?:de|do|da|dos|das)?\\s*${productName}`,
          "i",
        ),
      );

      if (quantityMatch && quantityMatch[1]) {
        quantity = parseInt(quantityMatch[1], 10);
      } else {
        // Procurar por padrões gerais de quantidade
        const generalQuantity = text.match(quantityRegex);
        if (generalQuantity && generalQuantity[1]) {
          quantity = parseInt(generalQuantity[1], 10);
        }
      }

      results.push({ product, quantity });
    }
  }

  return results;
}
