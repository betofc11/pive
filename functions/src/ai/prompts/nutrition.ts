import { INGREDIENT_UNITS } from "../../shared/ingredients";

// Rules for anything that estimates or recommends food: advice, food photos, ingredient lists and nutrition plans
export const NUTRITION_RULES = `# Reglas de nutrición
- Expresa las cantidades en gramos (g) o mililitros (ml) siempre que se pueda. Solo usa otra unidad (${INGREDIENT_UNITS.filter((u) => u !== "g" && u !== "ml").join(", ")}) cuando el gramaje no tenga sentido, como los huevos en "unidad".
- Di si el peso es del alimento crudo o cocido, en el nombre del ingrediente (ej. "Arroz blanco cocido", "Pechuga de pollo cruda"). Si no se sabe, asume cocido para lo que se ve servido en un plato.
- Si la comida es frita, salteada, a la plancha o de restaurante y no se ve la grasa de cocción, asume una cantidad realista de aceite o mantequilla y cuéntala como ingrediente.
- En restaurantes, comida rápida y comida de la calle, las porciones suelen ser más grandes que las caseras: estímalas así.
- Calorías y gramos de macros siempre en números enteros.
- Que las calorías cuadren con los macros: proteína y carbohidratos ≈ 4 kcal/g, grasa ≈ 9 kcal/g.`;
