# Planes de trabajo

Cada plan vive en su propia carpeta, `docs/plans/<slug>/`, y todas siguen la misma estructura. Así cualquier chat sabe dónde buscar el estado, las decisiones y lo que toca hacer.

## Índice

| Plan | Carpeta | Estado | De qué trata |
|---|---|---|---|
| Pive Coach | [`pive-coach/`](pive-coach/README.md) | En curso (fase 0 pendiente) | Chat con Pive, comidas por tiempo con el plan nutricional como base, memoria, ubicación, límites listos para premium y rutinas híbridas |

Estados posibles: **Propuesto**, **En curso**, **Pausado** (con el motivo), **Terminado**.

Los planes terminados no se borran: quedan como historia de por qué el código es como es.

---

## Estructura de un plan

```
docs/plans/<slug>/
├── README.md            # Cómo usarlo, estado de fases, decisiones, glosario, reglas comunes, pasos del usuario, bitácora
├── diseno.md            # Qué se construye y por qué: diagnóstico, ejemplos, costos, riesgos
└── fase-N-<nombre>.md   # Una por fase, autosuficiente para un chat nuevo
```

**Convenciones:**

- **Slug:** corto, en kebab-case y que diga de qué trata (`pive-coach`, `pagos-premium`, `modo-offline`). Nada de `plan-2` ni `nuevo`.
- **Fases:** numeradas desde 0 (`fase-0-…`, `fase-1-…`). El nombre dice qué se entrega, no cómo.
- **Si `diseno.md` y un archivo de fase no coinciden, manda la fase:** ahí están los contratos exactos.
- **Un chat por fase.** El estado y la bitácora viven en el `README.md` del plan, y cada chat los actualiza al terminar.
- **Un plan chico** (una sola fase) puede ser solo un `README.md` con todo dentro, pero dentro de su carpeta.
- **Los planes no repiten lo que ya está en `CLAUDE.md`** (stack, comandos, convenciones generales). Solo agregan lo propio.
- **Si dos planes tocan el mismo código,** cada README lo dice en sus decisiones o riesgos, y se ordenan en el índice.

---

## Crear un plan nuevo

1. Copia [`_plantilla/`](_plantilla/) a `docs/plans/<slug>/`.
2. Escribe primero `diseno.md` y decide las fases con el usuario.
3. Escribe un archivo por fase. Cada uno debe tener lo que necesita un chat que no vio la conversación original:
   - punto de partida verificable;
   - contratos;
   - tareas;
   - tests;
   - verificación;
   - prompt de arranque.
4. Agrega la fila al índice de arriba.
5. Mergea a `main` antes de abrir el primer chat por fase: los chats nuevos parten de `main`.
