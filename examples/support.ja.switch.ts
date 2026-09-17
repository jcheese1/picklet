import { defineSwitch } from 'picklet';
import data from './support.ja.switch.json' with { type: 'json' };

const [refund, support, sales] = data.branches;
type Label = 'refund' | 'support' | 'sales' | 'otherwise';
export default defineSwitch({ refund, support, sales }, {
  name: data.name,
  language: 'ja',
  provenance: `${data.provenance} Second experiment: Japanese character 2–5-grams; same examples, parameter count, optimizer, epochs and seed. Feature change informed by initial exam failures; final audit was authored separately before this change.`,
  fallbackExamples: data.fallbackExamples,
  calibration: data.calibration.map(row => ({ text: row.text, label: (row.label === '__fallback' ? 'otherwise' : row.label) as Label })),
});
