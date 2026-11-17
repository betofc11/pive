import { buildConsolidationContents, MEMORY_INSTRUCTION, parseMemoryOpsResponse } from './memory';
import { emptyMemory, type MemoryFact } from '../../shared/memory/memory';
import { validateMemoryOps } from '../../shared/memory/ops';

const panCuadrado: MemoryFact = {
  key: 'food.pan_cuadrado',
  category: 'food',
  text: 'No le gusta el pan cuadrado',
  source: 'chat',
  createdAt: 1,
  updatedAt: 1,
  lastConfirmedAt: 1,
};

it('the instruction has the consolidation rules and no personality (a data task)', () => {
  expect(MEMORY_INSTRUCTION).toContain('Si no hay nada duradero, devuelve operations vacío');
  expect(MEMORY_INSTRUCTION).toContain('Las alergias nunca se deducen');
  expect(MEMORY_INSTRUCTION).not.toContain('# Quién eres');
});

describe('buildConsolidationContents', () => {
  it('today, the current memory with its keys and the numbered messages', () => {
    const memory = { ...emptyMemory(), facts: { [panCuadrado.key]: panCuadrado } };
    expect(buildConsolidationContents({ memory, userMessages: ['Hola', '  ya me gusta\nel pan cuadrado '], localDate: '2026-11-17' })).toBe(
      [
        'HOY: 2026-11-17 (martes)',
        '',
        'MEMORIA ACTUAL:',
        '- food.pan_cuadrado [Alimento]: No le gusta el pan cuadrado',
        '',
        'MENSAJES DEL USUARIO (en orden):',
        '1. Hola',
        '2. ya me gusta el pan cuadrado',
      ].join('\n'),
    );
  });

  it('says when the memory is empty', () => {
    expect(buildConsolidationContents({ memory: emptyMemory(), userMessages: ['x'], localDate: '2026-11-17' })).toContain('MEMORIA ACTUAL:\n(vacía)');
  });
});

describe('parseMemoryOpsResponse', () => {
  it('turns the flat schema into operations, without nulls', () => {
    const raw = JSON.stringify({
      operations: [
        { op: 'create', key: 'allergy.mani', category: 'allergy', text: 'Alérgico al maní', foods: ['mani'], stance: null, expiresAt: null, evidence: 'soy alérgico al maní' },
        { op: 'delete', key: 'food.atun', category: null, text: null, foods: [], stance: null, expiresAt: null, evidence: 'olvida lo del atún' },
        { op: 'update', key: 'context.viaje', category: 'context', text: 'De viaje', foods: [], stance: null, expiresAt: '2026-11-22', evidence: 'me voy de viaje' },
      ],
    });
    expect(parseMemoryOpsResponse(raw)).toEqual([
      { op: 'create', key: 'allergy.mani', category: 'allergy', text: 'Alérgico al maní', foods: ['mani'], evidence: 'soy alérgico al maní' },
      { op: 'delete', key: 'food.atun', evidence: 'olvida lo del atún' },
      { op: 'update', key: 'context.viaje', category: 'context', text: 'De viaje', foods: [], expiresAt: '2026-11-22', evidence: 'me voy de viaje' },
    ]);
  });

  it('drops operations without key, evidence, a known op or a category; anything not JSON is no operations', () => {
    const raw = JSON.stringify({
      operations: [
        { op: 'create', key: 'food.x', category: 'comida', text: 'x', evidence: 'x x x x' },
        { op: 'merge', key: 'food.x', evidence: 'x x x x' },
        { op: 'delete', key: '', evidence: 'x x x x' },
        { op: 'confirm', key: 'food.x', evidence: null },
        'nope',
      ],
    });
    expect(parseMemoryOpsResponse(raw)).toEqual([]);
    expect(parseMemoryOpsResponse('not json')).toEqual([]);
    expect(parseMemoryOpsResponse(undefined)).toEqual([]);
    expect(parseMemoryOpsResponse('{"operations": "x"}')).toEqual([]);
  });

  it('what it returns goes straight into validateMemoryOps', () => {
    const ops = parseMemoryOpsResponse(
      JSON.stringify({
        operations: [{ op: 'create', key: 'allergy.mani', category: 'allergy', text: 'Alérgico al maní', foods: ['maní'], stance: null, expiresAt: null, evidence: 'soy alérgico al maní' }],
      }),
    );
    const { accepted } = validateMemoryOps(ops, emptyMemory(), ['Por cierto, soy alérgico al maní'], Date.UTC(2026, 10, 17));
    expect(accepted).toEqual([{ op: 'create', key: 'allergy.mani', category: 'allergy', text: 'Alérgico al maní', foods: ['mani'], evidence: 'soy alérgico al maní' }]);
  });
});
