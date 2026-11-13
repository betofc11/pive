import { Schema, Type } from "@google/genai";
import { INGREDIENT_UNITS } from "../shared/ingredients";
import { MEAL_SLOTS, PLANNED_SLOTS } from "../shared/meals/slots";
import { MUSCLE_GROUPS } from "../shared/workouts/exercises";

// Response schemas for Gemini's structured output. The code still validates and normalizes every response
// (ai/tasks/*): a schema guides the model, it doesn't guarantee the values.

const enumOf = (values: readonly string[], extra: Partial<Schema> = {}): Schema => ({
  type: Type.STRING,
  format: "enum",
  enum: [...values],
  ...extra,
});

export const MACROS_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    calories: { type: Type.NUMBER, description: "kcal, entero" },
    protein: { type: Type.NUMBER, description: "gramos, entero" },
    carbs: { type: Type.NUMBER, description: "gramos, entero" },
    fats: { type: Type.NUMBER, description: "gramos, entero" },
  },
  required: ["calories", "protein", "carbs", "fats"],
  propertyOrdering: ["calories", "protein", "carbs", "fats"],
};

/** An ingredient with its own macros, for `quantity` of it */
const ingredientSchema = (unit: Schema): Schema => ({
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "En español, diciendo si es crudo o cocido cuando importa" },
    quantity: { type: Type.NUMBER },
    unit,
    macros: { ...MACROS_SCHEMA, description: "Macros de esa cantidad del ingrediente" },
  },
  required: ["name", "quantity", "unit", "macros"],
  propertyOrdering: ["name", "quantity", "unit", "macros"],
});

export const FOOD_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "Nombre corto del plato, en español" },
    ingredients: { type: Type.ARRAY, items: ingredientSchema(enumOf(INGREDIENT_UNITS)) },
    assumptions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Supuestos que hiciste y el usuario puede corregir, en frases cortas. Vacío si no hiciste ninguno.",
    },
    mentionedSlot: enumOf(MEAL_SLOTS, {
      nullable: true,
      description: "Solo si el usuario dice explícitamente qué comida es. Si no lo dice, null.",
    }),
  },
  required: ["name", "ingredients", "assumptions", "mentionedSlot"],
  propertyOrdering: ["name", "ingredients", "assumptions", "mentionedSlot"],
};

export const INGREDIENTS_MACROS_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    // The user's own units, which can be anything ("oz", "rebanadas"): no enum here
    ingredients: { type: Type.ARRAY, items: ingredientSchema({ type: Type.STRING }) },
  },
  required: ["ingredients"],
};

export const NUTRITION_PLAN_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    calories: { type: Type.NUMBER },
    protein: { type: Type.NUMBER },
    carbs: { type: Type.NUMBER },
    fats: { type: Type.NUMBER },
    advice: { type: Type.STRING },
    restrictions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Alergias, intolerancias y alimentos que el plan prohíbe o pide evitar, tal como los dice el plan. Vacío si no hay.",
    },
    exchanges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Nombre del grupo de intercambio, ej. Proteínas, Harinas, Frutas, Leche, Grasas, etc." },
          qty: { type: Type.STRING, description: "Cantidad diaria recomendada, ej. '12', '7', 'Libres', '2+'" },
        },
        required: ["name", "qty"],
      },
      description: "Lista de porciones o grupos de intercambio diarios recomendados en el plan (si están de alguna forma presentes).",
    },
    equivalences: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          group: { type: Type.STRING, description: "Grupo de intercambio, igual que en exchanges" },
          food: { type: Type.STRING },
          quantity: { type: Type.NUMBER },
          unit: { type: Type.STRING },
        },
        required: ["group", "food", "quantity", "unit"],
      },
      description: "Tabla de equivalencias del plan: cuánto de cada alimento cuenta como una porción de su grupo. Solo si el plan la trae.",
    },
    meals: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, description: "Nombre del tiempo de comida tal como lo dice el plan, ej. Desayuno, Media mañana, Almuerzo, Cena" },
          slot: enumOf(PLANNED_SLOTS, {
            description:
              "Tiempo normalizado: breakfast = desayuno, morning_snack = merienda o snack de media mañana, lunch = almuerzo o comida, afternoon_snack = merienda de la tarde, dinner = cena o snack nocturno",
          }),
          options: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: "Título de la opción, ej. Avena con frutas" },
                macros: MACROS_SCHEMA,
                ingredients: { type: Type.ARRAY, items: ingredientSchema({ type: Type.STRING }) },
              },
              required: ["title", "macros", "ingredients"],
            },
          },
        },
        required: ["type", "slot", "options"],
      },
    },
  },
  required: ["name", "calories", "protein", "carbs", "fats", "restrictions", "meals"],
};

export const BODY_COMPOSITION_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    weight: { type: Type.NUMBER, description: "kg" },
    bodyFat: { type: Type.NUMBER, description: "% de 0 a 100" },
    muscleMass: { type: Type.NUMBER, description: "kg" },
    measuredAt: { type: Type.STRING, nullable: true, description: "Fecha de la medición en formato YYYY-MM-DD, o null si el reporte no la trae" },
  },
  required: ["weight", "measuredAt"],
};

export const WORKOUT_PLAN_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    days: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Ej. Día 1: Push" },
          exercises: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING, description: "Nombre del ejercicio en español" },
                sets: { type: Type.STRING, description: "Series" },
                reps: { type: Type.STRING, description: "Repeticiones" },
                description: { type: Type.STRING, description: "Breve descripción de técnica" },
                muscleGroups: { type: Type.ARRAY, items: enumOf(MUSCLE_GROUPS) },
              },
              required: ["name", "sets", "reps", "description", "muscleGroups"],
            },
          },
        },
        required: ["name", "exercises"],
      },
    },
  },
  required: ["name", "days"],
};
