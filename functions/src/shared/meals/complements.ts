// Curated foods to close the gap of a plan option ("agrega 40 g de queso tierno").
// Shared by the app and the Cloud Functions: pure TypeScript, no imports from npm, React Native or Node.
import type { Macros } from '../macros';

export interface Complement {
  id: string;
  /** As Pive says it, in Spanish */
  name: string;
  /** Regional names and plain forms, normalized (lowercase, no accents), to match plan foods and the memory */
  aliases: string[];
  group: 'protein' | 'carb' | 'fat' | 'dairy' | 'fruit' | 'vegetable';
  per100g: Macros;
  minGrams: number;
  maxGrams: number;
  /** Grams are rounded to this */
  step: number;
  /** For saying "3 claras" instead of "100 g" */
  piece?: { label: string; grams: number };
  /** Measured in ml (1 ml ≈ 1 g). Default 'g' */
  unit?: 'g' | 'ml';
}

/**
 * False until the user or their nutritionist reviews the table. Values per 100 g, rounded, from USDA
 * FoodData Central (SR Legacy / Foundation): cooked weight where the name says "cocido", raw otherwise.
 */
export const COMPLEMENTS_REVIEWED = false;

const m = (calories: number, protein: number, carbs: number, fats: number): Macros => ({ calories, protein, carbs, fats });

export const COMPLEMENTS: Complement[] = [
  // Protein
  { id: 'chicken_breast', name: 'Pechuga de pollo cocida', aliases: ['pechuga de pollo', 'pollo'], group: 'protein', per100g: m(165, 31, 0, 3.6), minGrams: 30, maxGrams: 150, step: 10 },
  { id: 'tuna_water', name: 'Atún en agua', aliases: ['atun en agua', 'atun'], group: 'protein', per100g: m(116, 25.5, 0, 0.8), minGrams: 30, maxGrams: 120, step: 10 },
  { id: 'egg_white', name: 'Claras de huevo', aliases: ['claras de huevo', 'clara de huevo', 'claras', 'clara'], group: 'protein', per100g: m(52, 10.9, 0.7, 0.2), minGrams: 33, maxGrams: 198, step: 33, piece: { label: 'clara', grams: 33 } },
  { id: 'egg', name: 'Huevo', aliases: ['huevo entero', 'huevo'], group: 'protein', per100g: m(143, 12.6, 0.7, 9.5), minGrams: 50, maxGrams: 150, step: 50, piece: { label: 'huevo', grams: 50 } },
  { id: 'fresh_cheese', name: 'Queso tierno', aliases: ['queso tierno', 'queso fresco', 'queso blanco', 'queso turrialba', 'queso campesino'], group: 'protein', per100g: m(299, 18.1, 3, 23.8), minGrams: 20, maxGrams: 60, step: 10 },
  { id: 'cottage_cheese', name: 'Queso cottage', aliases: ['queso cottage', 'cottage'], group: 'protein', per100g: m(81, 10.5, 4.8, 2.3), minGrams: 50, maxGrams: 200, step: 25 },
  { id: 'greek_yogurt', name: 'Yogur griego natural', aliases: ['yogur griego', 'yogurt griego'], group: 'protein', per100g: m(59, 10.2, 3.6, 0.4), minGrams: 100, maxGrams: 250, step: 25 },
  { id: 'lean_ground_beef', name: 'Carne molida magra cocida', aliases: ['carne molida magra', 'carne molida'], group: 'protein', per100g: m(217, 26.1, 0, 11.7), minGrams: 30, maxGrams: 150, step: 10 },
  { id: 'black_beans', name: 'Frijoles cocidos', aliases: ['frijoles', 'frijol', 'frijoles negros', 'porotos'], group: 'protein', per100g: m(132, 8.9, 23.7, 0.5), minGrams: 50, maxGrams: 200, step: 25 },
  { id: 'lentils', name: 'Lentejas cocidas', aliases: ['lentejas', 'lenteja'], group: 'protein', per100g: m(116, 9, 20.1, 0.4), minGrams: 50, maxGrams: 200, step: 25 },
  { id: 'tofu', name: 'Tofu firme', aliases: ['tofu'], group: 'protein', per100g: m(144, 17.3, 2.8, 8.7), minGrams: 50, maxGrams: 200, step: 25 },
  { id: 'turkey_ham', name: 'Jamón de pavo', aliases: ['jamon de pavo', 'pechuga de pavo'], group: 'protein', per100g: m(110, 17, 3, 3), minGrams: 20, maxGrams: 90, step: 10 },

  // Carbohydrate
  { id: 'white_rice', name: 'Arroz blanco cocido', aliases: ['arroz blanco', 'arroz'], group: 'carb', per100g: m(130, 2.7, 28.2, 0.3), minGrams: 50, maxGrams: 200, step: 25 },
  { id: 'corn_tortilla', name: 'Tortilla de maíz', aliases: ['tortilla de maiz', 'tortilla'], group: 'carb', per100g: m(218, 5.7, 44.6, 2.9), minGrams: 30, maxGrams: 90, step: 30, piece: { label: 'tortilla', grams: 30 } },
  { id: 'whole_wheat_bread', name: 'Pan integral', aliases: ['pan integral'], group: 'carb', per100g: m(252, 12.4, 42.7, 3.5), minGrams: 30, maxGrams: 90, step: 30, piece: { label: 'rebanada', grams: 30 } },
  { id: 'oats', name: 'Avena en hojuelas (cruda)', aliases: ['avena'], group: 'carb', per100g: m(389, 16.9, 66.3, 6.9), minGrams: 20, maxGrams: 80, step: 10 },
  { id: 'potato', name: 'Papa cocida', aliases: ['papa', 'papas', 'patata'], group: 'carb', per100g: m(87, 1.9, 20.1, 0.1), minGrams: 50, maxGrams: 250, step: 25 },
  { id: 'sweet_potato', name: 'Camote cocido', aliases: ['camote', 'batata', 'boniato'], group: 'carb', per100g: m(76, 1.4, 17.7, 0.1), minGrams: 50, maxGrams: 250, step: 25 },
  { id: 'ripe_plantain', name: 'Plátano maduro cocido', aliases: ['platano maduro', 'maduro'], group: 'carb', per100g: m(116, 0.8, 31.2, 0.2), minGrams: 50, maxGrams: 200, step: 25 },
  { id: 'pasta', name: 'Pasta cocida', aliases: ['pasta', 'espagueti', 'fideos'], group: 'carb', per100g: m(158, 5.8, 30.9, 0.9), minGrams: 50, maxGrams: 200, step: 25 },

  // Fat
  { id: 'avocado', name: 'Aguacate', aliases: ['aguacate', 'palta'], group: 'fat', per100g: m(160, 2, 8.5, 14.7), minGrams: 20, maxGrams: 100, step: 10 },
  { id: 'olive_oil', name: 'Aceite de oliva', aliases: ['aceite de oliva'], group: 'fat', per100g: m(884, 0, 0, 100), minGrams: 5, maxGrams: 15, step: 5, piece: { label: 'cucharadita', grams: 5 } },
  { id: 'peanuts', name: 'Maní tostado', aliases: ['mani', 'cacahuate', 'cacahuete'], group: 'fat', per100g: m(585, 24.4, 21.3, 49.7), minGrams: 10, maxGrams: 40, step: 5 },
  { id: 'almonds', name: 'Almendras', aliases: ['almendras', 'almendra'], group: 'fat', per100g: m(579, 21.2, 21.6, 49.9), minGrams: 10, maxGrams: 40, step: 5 },
  { id: 'peanut_butter', name: 'Mantequilla de maní', aliases: ['mantequilla de mani', 'crema de cacahuate'], group: 'fat', per100g: m(588, 25.1, 20, 50.4), minGrams: 16, maxGrams: 32, step: 16, piece: { label: 'cucharada', grams: 16 } },

  // Dairy
  { id: 'skim_milk', name: 'Leche descremada', aliases: ['leche descremada', 'leche'], group: 'dairy', per100g: m(34, 3.4, 5, 0.1), minGrams: 100, maxGrams: 300, step: 50, unit: 'ml' },

  // Fruit
  { id: 'banana', name: 'Banano', aliases: ['banano', 'banana', 'guineo', 'cambur'], group: 'fruit', per100g: m(89, 1.1, 22.8, 0.3), minGrams: 60, maxGrams: 240, step: 60, piece: { label: 'banano', grams: 120 } },
  { id: 'apple', name: 'Manzana', aliases: ['manzana'], group: 'fruit', per100g: m(52, 0.3, 13.8, 0.2), minGrams: 90, maxGrams: 180, step: 90, piece: { label: 'manzana', grams: 180 } },
  { id: 'strawberries', name: 'Fresas', aliases: ['fresas', 'fresa', 'frutillas'], group: 'fruit', per100g: m(32, 0.7, 7.7, 0.3), minGrams: 100, maxGrams: 250, step: 50 },
  { id: 'papaya', name: 'Papaya', aliases: ['papaya', 'lechosa'], group: 'fruit', per100g: m(43, 0.5, 10.8, 0.3), minGrams: 100, maxGrams: 300, step: 50 },

  // Vegetable
  { id: 'green_salad', name: 'Ensalada verde', aliases: ['ensalada verde', 'ensalada', 'lechuga'], group: 'vegetable', per100g: m(15, 1.4, 2.9, 0.2), minGrams: 50, maxGrams: 200, step: 50 },
  { id: 'broccoli', name: 'Brócoli cocido', aliases: ['brocoli'], group: 'vegetable', per100g: m(35, 2.4, 7.2, 0.4), minGrams: 50, maxGrams: 200, step: 50 },
  { id: 'carrot', name: 'Zanahoria', aliases: ['zanahoria'], group: 'vegetable', per100g: m(41, 0.9, 9.6, 0.2), minGrams: 50, maxGrams: 150, step: 50 },
];
