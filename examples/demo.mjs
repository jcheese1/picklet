import swtich from '../dist/support-switch.mjs';
const input = process.argv.slice(2).join(' ') || 'I was charged twice. Please refund the extra payment.';
const output = await swtich.match(input, {
  refund: () => ({ route: 'refund', message: 'Send to billing' }),
  support: () => ({ route: 'support', message: 'Send to technical support' }),
  sales: () => ({ route: 'sales', message: 'Send to sales' }),
  otherwise: ({ decision }) => ({ route: 'clarify', message: 'Ask a human', reason: decision.reason }),
});
console.log({ input, output, decision: swtich(input) });
