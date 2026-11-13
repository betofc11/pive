# Plan <Nombre>

> Parte de [`docs/plans/`](../README.md). Carpeta: `docs/plans/<slug>/`.

<Una o dos frases: qué cambia para el usuario cuando el plan termine.>

| Archivo | Para qué |
|---|---|
| `README.md` (este) | Cómo usar el plan, estado, decisiones, glosario, reglas comunes y bitácora |
| `diseno.md` | Qué construimos y por qué |
| `fase-N-*.md` | Todo lo que necesita un chat para implementar esa fase |

**Si un archivo de fase y `diseno.md` no coinciden, manda el archivo de fase.**

---

## Cómo usar el plan: un chat por fase

1. **El plan tiene que estar en `main`** antes del primer chat.
2. **Abre un chat nuevo por fase** y pega el *prompt de arranque* del final del archivo de la fase.
3. **Si el punto de partida no coincide con el código**, el chat lo dice y propone el ajuste antes de tocar nada.
4. **Al terminar**, el chat actualiza el estado y la bitácora, deja notas para la siguiente fase y abre el PR.
5. **Mergea y despliega antes de la siguiente fase.**

---

## Estado

| Fase | Archivo | Estado | PRs | Depende de |
|---|---|---|---|---|
| 0 · <nombre> | `fase-0-<nombre>.md` | Pendiente | — | — |

Estados posibles: **Pendiente**, **En curso**, **Hecha**, **Bloqueada** (con el motivo).

---

## Decisiones tomadas

| # | Tema | Decisión | Dónde |
|---|---|---|---|
| 1 | | | Fase N |

---

## Glosario: nombres en el código

| Concepto | Nombre | Dónde vive | Fase |
|---|---|---|---|
| | | | |

---

## Reglas para todas las fases

Además de lo que dice `CLAUDE.md`:

- [ ] <Verificaciones propias de este plan>
- [ ] Este README actualizado: estado, PRs y bitácora.

### Qué decide el chat solo y qué pregunta

- **Decide solo:**
- **Pregunta antes:**

---

## Pasos que solo puede hacer el usuario

| Cuándo | Qué |
|---|---|
| Antes de la fase 0 | Mergear el PR que trae este plan |

---

## Bitácora

<!-- Plantilla:
### AAAA-MM-DD · Fase N · PR <enlace>
- Qué se hizo:
- Desviaciones del plan (y por qué):
- Notas para la siguiente fase:
-->
