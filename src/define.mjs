import { validateSpec } from './train.mjs';

/** Build-time definition only. The compiled predictor has no dependency on this module. */
export function defineSwitch(cases, options) {
  if (!cases || typeof cases !== 'object' || Array.isArray(cases)) throw new TypeError('Provide an object of named cases');
  if (!options || typeof options.name !== 'string' || !options.name.trim()) throw new TypeError('Provide a switch name and training options');
  const spec = {
    name: options.name,
    ...(options.language ? { language: options.language } : {}),
    provenance: options.provenance,
    branches: Object.entries(cases).map(([id, definition]) => ({ ...definition, id })),
    fallbackExamples: options.fallbackExamples,
    calibration: options.calibration?.map(row => ({ ...row, label: row.label === 'otherwise' ? '__fallback' : row.label })),
  };
  validateSpec(spec);
  return spec;
}
