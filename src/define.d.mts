export interface CaseDefinition {
  readonly description: string;
  readonly examples: readonly string[];
}
export interface SwitchDefinition<K extends string = string> {
  readonly name: string;
  readonly language?: 'en' | 'ja';
  readonly provenance?: string;
  readonly branches: readonly (CaseDefinition & { readonly id: K })[];
  readonly fallbackExamples: readonly string[];
  readonly calibration: readonly { readonly text: string; readonly label: K | '__fallback' }[];
}
export declare function defineSwitch<const C extends Record<string, CaseDefinition>>(
  cases: C & Record<Extract<keyof C, 'otherwise' | '__fallback' | '__proto__' | 'constructor' | 'prototype'>, never>,
  options: {
    readonly name: string;
    readonly language?: 'en' | 'ja';
    readonly provenance?: string;
    readonly fallbackExamples: readonly string[];
    readonly calibration: readonly { readonly text: string; readonly label: (keyof C & string) | 'otherwise' }[];
  },
): SwitchDefinition<keyof C & string>;
