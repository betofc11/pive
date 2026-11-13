// Only re-exports the endpoints. Their names are the deployed function names and the URLs the app calls:
// don't rename them.
export { obtenerConsejoPive } from "./endpoints/obtenerConsejoPive";
export { analizarImagenComida } from "./endpoints/analizarImagenComida";
export { calcularMacrosIngredientes } from "./endpoints/calcularMacrosIngredientes";
export { analizarPlanNutricional } from "./endpoints/analizarPlanNutricional";
export { analizarComposicionCorporal } from "./endpoints/analizarComposicionCorporal";
export { analizarPlanEntrenamiento } from "./endpoints/analizarPlanEntrenamiento";
