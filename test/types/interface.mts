import inbox, { type Case, type AbstainReason } from '../../dist/support-switch.mjs';
import { defineSwitch } from 'picklet';

const decision = inbox('example');
if (decision.kind === 'match') {
  const label: Case = decision.case;
  void label;
} else {
  const reason: AbstainReason = decision.reason;
  void reason;
  // @ts-expect-error Abstention has no selected case.
  decision.case;
}
// @ts-expect-error Prediction accepts text, not arbitrary objects.
inbox({ text: 'hello' });

const result = await inbox.match('example', {
  refund: ({ decision, input }) => {
    const label: 'refund' = decision.case;
    const text: string = input;
    void label; void text;
    return { route: 'refund', cents: 100 } as const;
  },
  support: async () => ({ route: 'support', ticket: 42 } as const),
  sales: () => ({ route: 'sales', url: '/pricing' } as const),
  otherwise: ({ decision }) => {
    const kind: 'abstain' = decision.kind;
    void kind;
    // @ts-expect-error Otherwise never receives a matched decision.
    decision.case;
    return { route: 'clarify' } as const;
  },
});
const route: 'refund' | 'support' | 'sales' | 'clarify' = result.route;
void route;
if (result.route === 'support') { const ticket: 42 = result.ticket; void ticket; }
// @ts-expect-error The inferred return value is not any.
const badResult: { route: 'impossible' } = result;
void badResult;

// @ts-expect-error Missing sales case.
inbox.match('hello', { refund: () => 1, support: () => 2, otherwise: () => 3 });
// @ts-expect-error Typo is not a valid compiled case.
inbox.match('hello', { refund: () => 1, suport: () => 2, sales: () => 3, otherwise: () => 4 });
// @ts-expect-error Otherwise is required.
inbox.match('hello', { refund: () => 1, support: () => 2, sales: () => 3 });
const extra = { refund: () => 1, support: () => 2, sales: () => 3, otherwise: () => 4, typo: () => 5 };
// @ts-expect-error Extra cases are rejected even through a variable.
inbox.match('hello', extra);

const cases = {
  light: { description: 'Turn the lights on', examples: ['light one', 'light two'] },
  dark: { description: 'Turn the lights off', examples: ['dark one', 'dark two'] },
};
defineSwitch(cases, { name: 'lights', fallbackExamples: ['a', 'b'], calibration: [{ text: 'c', label: 'otherwise' }, { text: 'd', label: 'light' }] });
defineSwitch(cases, { name: 'lights-ja', language: 'ja', fallbackExamples: ['a', 'b'], calibration: [{ text: 'c', label: 'otherwise' }] });
// @ts-expect-error Only implemented feature profiles can be selected.
defineSwitch(cases, { name: 'lights-fr', language: 'fr', fallbackExamples: ['a', 'b'], calibration: [] });
// @ts-expect-error Calibration labels must belong to this switch.
defineSwitch(cases, { name: 'lights', fallbackExamples: ['a', 'b'], calibration: [{ text: 'c', label: 'refund' }] });
// @ts-expect-error Otherwise is reserved for abstention.
defineSwitch({ ...cases, otherwise: cases.light }, { name: 'lights', fallbackExamples: ['a', 'b'], calibration: [] });
