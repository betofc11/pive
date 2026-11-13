// Runs the food estimate (the same logic as analizarImagenComida) on every case in food.json and reports
// which ones fall outside the expected range. Needs a Gemini key and the compiled Functions:
//   npm run --prefix functions eval:food
// It calls the real Gemini API: each run costs a little (the report shows the estimate).
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Same file the Functions emulator reads the key from
const readKey = () => {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const secretFile = join(here, '..', '.secret.local');
  if (!existsSync(secretFile)) return null;
  const line = readFileSync(secretFile, 'utf8')
    .split('\n')
    .find((l) => l.startsWith('GEMINI_API_KEY='));
  return line ? line.slice('GEMINI_API_KEY='.length).trim() : null;
};

const apiKey = readKey();
if (!apiKey) {
  console.error('Missing GEMINI_API_KEY: export it or put it in functions/.secret.local');
  process.exit(2);
}

let estimateFood;
let featureUsageDelta;
try {
  ({ estimateFood } = require('../lib/ai/estimateFood.js'));
  ({ featureUsageDelta } = require('../lib/usageCost.js'));
} catch {
  console.error('Compile the Functions first: npm run --prefix functions build');
  process.exit(2);
}
const { GoogleGenAI } = require('@google/genai');

const only = process.argv[2]; // optional: run a single case by id
const { cases } = JSON.parse(readFileSync(join(here, 'food.json'), 'utf8'));
const selected = only ? cases.filter((c) => c.id === only) : cases;
if (selected.length === 0) {
  console.error(`No case with id "${only}"`);
  process.exit(2);
}
const ai = new GoogleGenAI({ apiKey });

const inRange = (value, [min, max]) => value >= min && value <= max;
let failures = 0;
let costUsd = 0;

for (const testCase of selected) {
  try {
    const { analysis, usageMetadata, model } = await estimateFood(ai, { description: testCase.text });
    costUsd += featureUsageDelta(usageMetadata, model).estCostUsd;

    const problems = [];
    if (!inRange(analysis.macros.calories, testCase.kcal)) {
      problems.push(`kcal ${analysis.macros.calories} not in ${testCase.kcal.join('–')}`);
    }
    if (!inRange(analysis.macros.protein, testCase.protein)) {
      problems.push(`protein ${analysis.macros.protein} g not in ${testCase.protein.join('–')}`);
    }
    if ('expectSlot' in testCase && analysis.mentionedSlot !== testCase.expectSlot) {
      problems.push(`mentionedSlot ${analysis.mentionedSlot} instead of ${testCase.expectSlot}`);
    }

    const summary = `${analysis.macros.calories} kcal · P ${analysis.macros.protein} g · ${analysis.ingredients.length} ingredients`;
    if (problems.length === 0) {
      console.log(`✓ ${testCase.id}: ${summary}`);
      continue;
    }

    failures++;
    console.log(`✗ ${testCase.id}: ${summary}`);
    for (const problem of problems) console.log(`    ${problem}`);
    for (const ing of analysis.ingredients) {
      console.log(`      - ${ing.quantity} ${ing.unit} ${ing.name}: ${ing.macros?.calories ?? '?'} kcal, P ${ing.macros?.protein ?? '?'} g`);
    }
    if (analysis.assumptions.length) console.log(`      assumptions: ${analysis.assumptions.join(' | ')}`);
  } catch (error) {
    failures++;
    console.log(`✗ ${testCase.id}: error ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log(`\n${selected.length - failures}/${selected.length} in range · estimated cost $${costUsd.toFixed(4)}`);
process.exit(failures ? 1 : 0);
