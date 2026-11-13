import { Schema, Type } from "@google/genai";

// Response schemas for Gemini's structured output

export const MACROS_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    calories: { type: Type.NUMBER },
    protein: { type: Type.NUMBER },
    carbs: { type: Type.NUMBER },
    fats: { type: Type.NUMBER },
  },
  required: ["calories", "protein", "carbs", "fats"],
};

const INGREDIENT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    quantity: { type: Type.NUMBER },
    unit: { type: Type.STRING },
  },
  required: ["name", "quantity", "unit"],
};

export const FOOD_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    macros: MACROS_SCHEMA,
    ingredients: { type: Type.ARRAY, items: INGREDIENT_SCHEMA },
  },
  required: ["name", "ingredients", "macros"],
};

export const INGREDIENTS_MACROS_SCHEMA: Schema = MACROS_SCHEMA;

export const NUTRITION_PLAN_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    calories: { type: Type.NUMBER },
    protein: { type: Type.NUMBER },
    carbs: { type: Type.NUMBER },
    fats: { type: Type.NUMBER },
    advice: { type: Type.STRING },
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
    meals: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, description: "Ej. Desayuno, Merienda, Almuerzo, Cena" },
          options: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: "Título de la opción, ej. Avena con frutas" },
                macros: MACROS_SCHEMA,
                ingredients: { type: Type.ARRAY, items: INGREDIENT_SCHEMA },
              },
              required: ["title", "ingredients"],
            },
          },
        },
        required: ["type", "options"],
      },
    },
  },
  required: ["name", "calories", "protein", "carbs", "fats"],
};

export const BODY_COMPOSITION_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    weight: { type: Type.NUMBER },
    bodyFat: { type: Type.NUMBER },
    muscleMass: { type: Type.NUMBER },
  },
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
                name: { type: Type.STRING, description: "Nombre del ejercicio" },
                sets: { type: Type.STRING, description: "Series" },
                reps: { type: Type.STRING, description: "Repeticiones" },
                description: { type: Type.STRING, description: "Breve descripción de técnica" },
                youtubeUrl: { type: Type.STRING, description: "URL de búsqueda en YouTube" },
                muscleGroups: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Categorías de grupos musculares asociados. Deben ser uno o más de: Pecho, Espalda, Piernas, Hombros, Brazos, Core.",
                },
              },
              required: ["name", "sets", "reps", "description", "youtubeUrl", "muscleGroups"],
            },
          },
        },
        required: ["name", "exercises"],
      },
    },
  },
  required: ["name", "days"],
};
