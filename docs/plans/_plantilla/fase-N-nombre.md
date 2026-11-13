# Fase N: <Qué se entrega>

**Objetivo:** <qué cambia cuando esta fase termina, en dos o tres frases>.

| | |
|---|---|
| **Depende de** | <fases y qué usa de cada una> |
| **Desbloquea** | <fases> |
| **Leer antes** | `diseno.md` §… |
| **PRs sugeridos** | **A:** … **B:** … |

---

## Punto de partida (verifícalo contra el código)

<Lo que existe hoy y esta fase usa o cambia: archivos, funciones, tipos y comportamientos, con rutas. Es lo que el chat compara antes de empezar.>

---

## Contratos

<Tipos, firmas, requests y responses, rutas de Firestore y reglas. Exactos: esto es lo que manda.>

```ts
```

---

## Tareas

### PR A: …

1.

### PR B: …

1.

---

## Tests a escribir

| Archivo | Casos (entrada → resultado esperado) |
|---|---|
| | |

---

## Verificación

```bash
npm run lint && npx tsc --noEmit && npx tsc --noEmit -p functions && npm test && npm run build
npm run test:emulator    # si se tocan reglas o servicios de Firestore
```

**Manual:**

1.

---

## Pasos del usuario

-

## Fuera de alcance

-

---

## Al terminar

- [ ] `README.md` de la raíz actualizado si cambian endpoints, secretos o comandos.
- [ ] `docs/plans/<slug>/README.md`: estado, PRs y bitácora.
- [ ] Notas para la siguiente fase.

---

## Prompt de arranque

```
Vamos a implementar la Fase N del plan <Nombre>.

1. Lee CLAUDE.md, docs/plans/<slug>/README.md (incluida la bitácora) y docs/plans/<slug>/fase-N-<nombre>.md completo, y las secciones de docs/plans/<slug>/diseno.md que indica.
2. Confirma en la tabla de estado que las fases de las que depende estén hechas. Si no, avísame antes de empezar.
3. Revisa el "Punto de partida" contra el código actual. Si algo no coincide, dímelo y propón el ajuste antes de cambiar nada.
4. Marca la fase como "En curso" e implementa las tareas en orden, con commits pequeños. Corre las verificaciones de la fase.
5. Al terminar: actualiza el estado y la bitácora en docs/plans/<slug>/README.md, deja notas para la siguiente fase y abre el PR.
```
