// Generated with the model. Do not edit independently.
export type Case = "refund" | "support" | "sales";
export type AbstainReason = 'empty-input' | 'learned-fallback' | 'uncertain';
export interface Candidate { readonly case: Case; readonly score: number; }
export interface Details {
  readonly candidates: readonly Candidate[];
  readonly fallbackScore: number;
  readonly margin: number;
}
export type MatchedDecision<K extends Case = Case> = Details & { readonly kind: 'match'; readonly case: K };
export type AbstainedDecision = Details & { readonly kind: 'abstain'; readonly reason: AbstainReason };
export type Decision = MatchedDecision | AbstainedDecision;
export type Handlers = {
  [K in Case]: (context: { readonly input: string; readonly decision: MatchedDecision<K> }) => unknown;
} & { otherwise: (context: { readonly input: string; readonly decision: AbstainedDecision }) => unknown };
export interface Metadata {
  readonly name: string;
  readonly branches: readonly { readonly id: Case; readonly description: string }[];
  readonly policy: { readonly minScore: number; readonly minMargin: number };
  readonly parameters: number;
  readonly weightBytes: number;
  readonly training: Readonly<Record<string, unknown>>;
}
export interface CompiledSwitch {
  (input: string): Decision;
  match<const H extends Handlers>(input: string, handlers: H & Record<Exclude<keyof H, keyof Handlers>, never>): Promise<Awaited<ReturnType<H[keyof Handlers]>>>;
  readonly metadata: Metadata;
}
declare const predictor: CompiledSwitch;
export default predictor;
