import { defineSwitch } from 'picklet';
import data from './support.switch.json' with { type: 'json' };

// Reuse the frozen baseline examples; each meaning is defined only in this dataset.
const [refund, support, sales] = data.branches;
type Label = 'refund' | 'support' | 'sales' | 'otherwise';

export default defineSwitch({ refund, support, sales }, {
  name: data.name,
  provenance: data.provenance,
  fallbackExamples: data.fallbackExamples,
  calibration: data.calibration.map(row => ({
    text: row.text,
    label: (row.label === '__fallback' ? 'otherwise' : row.label) as Label,
  })),
});
