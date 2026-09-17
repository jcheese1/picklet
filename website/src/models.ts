import english from '../../dist/support-switch.mjs';
import japanese from '../../dist/support-switch-ja.mjs';
import englishUrl from '../../dist/support-switch.mjs?url';
import japaneseUrl from '../../dist/support-switch-ja.mjs?url';
import englishReport from '../../dist/support-switch.report.json';
import japaneseReport from '../../dist/support-switch-ja.report.json';
import englishExam from '../../dist/evaluation.json';
import japaneseExam from '../../dist/evaluation-ja-audit.json';
import japaneseBaseline from '../../dist/evaluation-ja-audit-baseline.json';
import type { CompiledSwitch, Decision } from '../../dist/support-switch.mjs';

export type { CompiledSwitch, Decision };
export type Language = 'en' | 'ja';
export type Case = 'refund' | 'support' | 'sales';
export type Outcome = Case | 'otherwise';

export const cases: readonly Case[] = ['refund', 'support', 'sales'];

export interface Preset {
  readonly text: string;
  /** A case the model is known to get wrong or handle only partially. */
  readonly trap?: boolean;
}

export interface ExamRow {
  readonly text: string;
  readonly label: string;
  readonly actual: string;
  readonly correct: boolean;
  readonly tag?: string;
}

export interface Exam {
  readonly count: number;
  readonly correct: number;
  readonly accepted: number;
  readonly incorrectAccepted: number;
  readonly actionable: number;
  readonly correctlyAccepted: number;
  readonly fallbackCorrect: number;
  readonly expectedFallback: number;
  readonly rawTop1Correct?: number;
  readonly results: readonly ExamRow[];
}

export interface Report {
  readonly parameters: number;
  readonly weightBytes: number;
  readonly artifactBytes: number;
  readonly gzipBytes: number;
  readonly brotliBytes: number;
  readonly compileMs: number;
  readonly policy: { readonly minScore: number; readonly minMargin: number };
  readonly training: { readonly examples: number; readonly architecture: string };
  readonly calibration: { readonly count: number; readonly accepted: number; readonly acceptedErrors: number };
}

export interface ModelConfig {
  readonly language: Language;
  readonly switchName: string;
  readonly predictor: CompiledSwitch;
  readonly moduleUrl: string;
  readonly fileName: string;
  readonly report: Report;
  readonly exam: Exam;
  readonly baseline?: Exam;
  readonly features: string;
  readonly draft: string;
  readonly presets: readonly Preset[];
}

export const models: Record<Language, ModelConfig> = {
  en: {
    language: 'en',
    switchName: 'support-inbox',
    predictor: english,
    moduleUrl: englishUrl,
    fileName: 'support-switch.mjs',
    report: englishReport,
    exam: englishExam,
    features: 'word and character n-grams',
    draft: 'I was charged twice. Please refund the extra payment.',
    presets: [
      { text: 'The parcel never arrived. I would like my money back.' },
      { text: 'My login no longer works. Can you help?' },
      { text: 'Can I get a quote for twenty licenses?' },
      { text: 'Tell me a joke about a tiny robot.' },
      { text: 'I am not requesting a refund. Please explain how to install it.', trap: true },
      { text: 'How is the weather in Osaka?', trap: true },
    ],
  },
  ja: {
    language: 'ja',
    switchName: 'support-inbox-japanese',
    predictor: japanese,
    moduleUrl: japaneseUrl,
    fileName: 'support-switch-ja.mjs',
    report: japaneseReport,
    exam: japaneseExam,
    baseline: japaneseBaseline,
    features: 'character 2–5-grams',
    draft: '返金してください',
    presets: [
      { text: '返金してください' },
      { text: 'ログインできません' },
      { text: '有料プランを契約したいです' },
      { text: '大阪の天気はどうですか' },
      { text: '返金の手続きは求めていません。アプリが落ちる原因を知りたいです', trap: true },
      { text: '困っているので担当の方と話したいです', trap: true },
    ],
  },
};

export const displayCase = (value: string): string => (value === '__fallback' ? 'otherwise' : value);

export const kilobytes = (bytes: number): string => `${(bytes / 1024).toFixed(1)} KB`;
