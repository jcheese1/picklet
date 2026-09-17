import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Locale = 'en' | 'ja';

const STORAGE_KEY = 'picklet-locale';

const en = {
  htmlTitle: 'picklet — a switch statement that learned its cases',
  metaDescription:
    'picklet trains a tiny text classifier from your examples and compiles the weights into one JavaScript module. No model download, no API key, no GPU.',
  nav: { demo: 'Demo', how: 'How it works', results: 'Results', install: 'Install', npm: 'npm', sections: 'Sections', home: 'picklet, home' },
  localeSwitcher: { label: 'Page language', en: 'English', ja: '日本語' },
  hero: {
    title: 'A switch statement that learned its cases.',
    lede:
      'picklet trains a small text classifier from your examples and compiles the weights into one JavaScript module. No model download, no API key, no GPU, no network. The generated file runs in Node and in the browser, and you are looking at one right now.',
  },
  demo: {
    aria: 'Live demo',
    label: 'Type a customer message',
    modelGroup: 'Model language',
    model: { en: 'English model', ja: 'Japanese model' },
    hint: 'Runs on every keystroke, in this tab. Nothing is sent anywhere.',
    presetsAria: 'Example messages',
    trapTitle: 'A known weak spot for this model',
    presetNote: 'Outlined examples are known weak spots. This model learned from examples; the case descriptions alone did not train it.',
    codeAria: 'The handler object passed to match',
    resultKey: 'result',
    matched: (margin: string) => `matched with a margin of ${margin}`,
    abstained: (reason: string) => `abstained: ${reason}`,
    reasons: { 'empty-input': 'empty input', 'learned-fallback': 'learned fallback', uncertain: 'uncertain' } as Record<string, string>,
    scoresAria: 'Relative class scores',
    scoresNote: (minScore: number, minMargin: number) =>
      `Bars are relative class scores, not probabilities of being right. A branch is taken only when the top score reaches ${minScore} and leads the runner-up by ${minMargin}; otherwise the switch abstains.`,
    running: (size: string) => `, ${size} Brotli including the runtime. `,
    runningPrefix: 'Running ',
    download: 'Download the module',
    presets: {
      en: ['Money back', 'Login trouble', 'Ask for a quote', 'Unrelated', 'Negation', 'Weather'],
      ja: ['Refund', 'How-to question', 'Purchase inquiry', 'Weather', 'Negation', 'Vague request'],
    },
  },
  how: {
    title: 'Define, compile, import',
    intro:
      'You write the cases and the examples. The compiler learns the weights and writes a module with the tokenizer, the inference loop, the int8 weights and a matching type declaration. Your app imports the module and never needs picklet again.',
    step1: {
      title: 'Describe each case with examples',
      comments: { fallback: 'things the switch should refuse to route', calibration: 'separate cases used only to pick the acceptance thresholds' },
      body: 'Descriptions label the cases. The examples are what the model learns from. Calibration cases are held apart and used only to decide how confident the switch must be before it takes a branch.',
    },
    step2: {
      title: 'Compile it',
      output: { module: (raw: string, brotli: string) => `${raw} raw, ${brotli} Brotli`, types: 'types for every case and handler', report: 'sizes, thresholds, calibration and quantization checks' },
      body: (parameters: string) =>
        `Training runs in JavaScript with stochastic gradient descent over hashed n-gram features. The bundled English model is ${parameters} parameters and compiled in about half a second. Weights are quantized to int8 and checked so that no training or calibration example changes its winner.`,
    },
    step3: {
      title: 'Route with a typed handler object',
      comment: 'Or just look before you leap:',
      body: "TypeScript checks that every case has a handler, that no handler is misspelled, and infers the union of the handlers' return values. A missing case is a compile error, not a silent fallback. Exactly one handler runs; if it throws, the error propagates.",
    },
  },
  honest: {
    title: 'What it is, and what it is not',
    is: [
      'A hashed n-gram tokenizer feeding a learned linear softmax classifier. Four classes, one of them the fallback.',
      'An explicit abstention policy: a branch is taken only when the top score clears a minimum and leads the runner-up by a minimum margin.',
      'Scores you can inspect. Every decision returns ranked candidates, the fallback score and the margin.',
      'Pure JavaScript with no runtime dependencies. Warm inference measured in tens of microseconds in Node.',
    ],
    isNot: [
      'Not a language model. Nothing is pretrained; the case descriptions do not teach it anything.',
      'Not good at negation, mixed intents or reasoning across a sentence. Local n-grams cannot see that far, and the exam shows it.',
      'Not calibrated. Scores are relative class scores, not probabilities of being correct.',
      'Not production routing. It is an experiment in how much a tiny learned function can do from inside a single file.',
    ],
  },
  results: {
    title: 'The report card',
    intro:
      'Each model sat a separate exam the compiler never saw. The exam was written before training and no threshold was tuned against it. It is authored data, not customer traffic, so read these as evidence of what a linear model over n-grams can and cannot do, not as a production accuracy claim.',
    examGroup: 'Which exam to show',
    model: { en: 'English', ja: 'Japanese' },
    examName: { en: 'held-out English exam', ja: 'fresh Japanese audit' },
    tally: {
      final: 'Final decisions right',
      raw: 'Right before abstaining',
      handled: 'Requests handled',
      rejected: 'Off-topic rejected',
      wrong: 'Wrong branches taken',
    },
    noteJa: (raw: number, count: number, margin: number) =>
      `The Japanese model ranks ${raw} of ${count} cases correctly but its acceptance margin of ${margin} is deliberately strict, so many right answers still fall back to `,
    noteJaBaseline: (correct: number, count: number, handled: number, actionable: number) =>
      ` On the same audit, the English-trained model gets ${correct} of ${count} final decisions and handles ${handled} of ${actionable} requests.`,
    noteEn: (accepted: number, wrong: number) =>
      `The English model accepted ${accepted} branches and got ${wrong} of them wrong. A negated refund still routes to refund, a weather question routes to support, and a message with two intents picks one. None of these were repaired after the exam.`,
    thresholds: (calibration: number) =>
      `Thresholds were chosen on ${calibration} calibration cases, keeping every accepted calibration example correct. Int8 quantization changed zero winning classes across the training and calibration data.`,
    showAll: (examName: string, wrong: number) => `Show every case in the ${examName} (${wrong} wrong)`,
    columns: { message: 'Message', expected: 'Expected', returned: 'Returned' },
  },
  install: {
    title: 'Install',
    intro:
      'picklet is on npm under the MIT license. Install it as a development dependency; the module it compiles has no dependency on picklet at runtime, so your app never ships the compiler.',
    comment: 'or: bun add -D picklet / pnpm add -D picklet',
    noteBefore: 'Version 0.1.0 is the current release; pin it for reproducible builds. The CLI needs Node 24 or newer, or Bun 1.3 and newer with ',
    noteAfter: '. Commit the generated files or produce them in CI, and recompile whenever a case’s meaning or examples change.',
  },
  footer: {
    before:
      'picklet 0.1.0, MIT licensed. English and Japanese models are compiled from assistant-authored examples; neither exam is independent user data. Both models and every exam result on this page are loaded from the repository’s',
    after: ' folder.',
  },
};

export type Strings = typeof en;

const ja: Strings = {
  htmlTitle: 'picklet — 分岐を学習した switch 文',
  metaDescription:
    'picklet は、あなたが書いた例文から小さなテキスト分類器を学習し、その重みを 1 つの JavaScript モジュールにコンパイルします。モデルのダウンロードも API キーも GPU も不要です。',
  nav: { demo: 'デモ', how: '仕組み', results: '評価結果', install: 'インストール', npm: 'npm', sections: 'セクション', home: 'picklet ホーム' },
  localeSwitcher: { label: 'ページの言語', en: 'English', ja: '日本語' },
  hero: {
    title: '分岐を学習した switch 文。',
    lede:
      'picklet は、あなたが書いた例文から小さなテキスト分類器を学習し、その重みを 1 つの JavaScript モジュールにコンパイルします。モデルのダウンロードも API キーも GPU も通信も不要。生成されたファイルは Node でもブラウザでも動き、いまこのページで動いているのがまさにそれです。',
  },
  demo: {
    aria: 'ライブデモ',
    label: 'お客様からのメッセージを入力',
    modelGroup: 'モデルの言語',
    model: { en: '英語モデル', ja: '日本語モデル' },
    hint: '入力のたびにこのタブ内で実行します。どこにも送信されません。',
    presetsAria: 'メッセージの例',
    trapTitle: 'このモデルの既知の弱点',
    presetNote: '枠線付きの例は既知の弱点です。このモデルは例文から学習したもので、分岐の説明文だけでは学習していません。',
    codeAria: 'match に渡すハンドラーオブジェクト',
    resultKey: 'result',
    matched: (margin: string) => `マージン ${margin} で一致`,
    abstained: (reason: string) => `保留: ${reason}`,
    reasons: { 'empty-input': '入力が空', 'learned-fallback': '学習したフォールバック', uncertain: '確信度が不足' },
    scoresAria: '各分岐の相対スコア',
    scoresNote: (minScore: number, minMargin: number) =>
      `バーは分岐ごとの相対スコアであり、正解である確率ではありません。最上位のスコアが ${minScore} 以上で、かつ 2 位との差が ${minMargin} 以上のときだけ分岐を実行し、それ以外は保留します。`,
    running: (size: string) => `（ランタイム込みで Brotli ${size}）を実行中。`,
    runningPrefix: '',
    download: 'モジュールをダウンロード',
    presets: {
      en: ['返金希望', 'ログイン不能', '見積もり依頼', '無関係', '否定', '天気'],
      ja: ['返金', '操作相談', '購入相談', '天気の質問', '否定', '曖昧な依頼'],
    },
  },
  how: {
    title: '定義して、コンパイルして、インポート',
    intro:
      'あなたが書くのは分岐と例文だけ。コンパイラが重みを学習し、トークナイザー・推論ループ・int8 の重み・対応する型定義を含むモジュールを書き出します。アプリはそのモジュールをインポートするだけで、以後 picklet は不要です。',
    step1: {
      title: '各分岐を例文で説明する',
      comments: { fallback: 'ルーティングを拒否すべき入力', calibration: '採用しきい値の決定にだけ使う別の事例' },
      body: '説明文は分岐のラベルです。モデルが学習するのは例文のほう。キャリブレーション用の事例は分けて保持し、どれだけ確信があれば分岐を実行するかを決めるためだけに使います。',
    },
    step2: {
      title: 'コンパイルする',
      output: { module: (raw: string, brotli: string) => `生 ${raw}、Brotli ${brotli}`, types: '全分岐とハンドラーの型', report: 'サイズ・しきい値・キャリブレーション・量子化チェック' },
      body: (parameters: string) =>
        `学習はハッシュ化した n-gram 特徴量に対する確率的勾配降下法で、JavaScript の中で実行されます。同梱の英語モデルはパラメーター数 ${parameters} で、コンパイルは約 0.5 秒。重みは int8 に量子化し、学習・キャリブレーションのどの例文でも勝者が変わらないことを検証しています。`,
    },
    step3: {
      title: '型付きのハンドラーオブジェクトで振り分ける',
      comment: '実行せずに判定だけ見ることもできます:',
      body: 'TypeScript がすべての分岐にハンドラーがあること、綴りの誤りがないことを検査し、ハンドラーの戻り値の合併型を推論します。分岐の欠落はコンパイルエラーになり、黙ってフォールバックしません。実行されるハンドラーはちょうど 1 つで、例外はそのまま伝播します。',
    },
  },
  honest: {
    title: 'これは何で、何ではないか',
    is: [
      'ハッシュ化 n-gram トークナイザーと、学習した線形ソフトマックス分類器。クラスは 4 つで、うち 1 つがフォールバックです。',
      '明示的な保留ポリシー。最上位のスコアが下限を超え、かつ 2 位との差が下限を超えたときだけ分岐を実行します。',
      '中身を見られるスコア。すべての判定が順位付きの候補、フォールバックのスコア、マージンを返します。',
      'ランタイム依存ゼロの純粋な JavaScript。ウォーム状態の推論は Node で数十マイクロ秒です。',
    ],
    isNot: [
      '言語モデルではありません。事前学習はなく、分岐の説明文からは何も学びません。',
      '否定、複数の意図、文をまたぐ推論は苦手です。局所的な n-gram ではそこまで見えず、評価結果にもそれが表れています。',
      'キャリブレーションされていません。スコアは相対値で、正解である確率ではありません。',
      '本番用のルーティングではありません。1 つのファイルの中で小さな学習済み関数がどこまでできるかの実験です。',
    ],
  },
  results: {
    title: '成績表',
    intro:
      '各モデルは、コンパイラが一度も見ていない別の試験を受けています。試験は学習前に作成し、しきい値の調整には使っていません。人手で作成したデータであり実際の顧客トラフィックではないため、n-gram 上の線形モデルに何ができて何ができないかの証拠として読んでください。本番精度の主張ではありません。',
    examGroup: '表示する試験',
    model: { en: '英語', ja: '日本語' },
    examName: { en: '英語のホールドアウト試験', ja: '新規の日本語監査' },
    tally: {
      final: '最終判定の正解',
      raw: '保留前の正解',
      handled: '正しく処理した依頼',
      rejected: '正しく拒否した対象外',
      wrong: '誤って実行した分岐',
    },
    noteJa: (raw: number, count: number, margin: number) =>
      `日本語モデルは ${count} 件中 ${raw} 件を正しく順位付けしますが、採用マージン ${margin} を意図的に厳しくしているため、正解でも多くが `,
    noteJaBaseline: (correct: number, count: number, handled: number, actionable: number) =>
      ` 同じ監査で英語学習モデルは最終判定 ${count} 件中 ${correct} 件、依頼 ${actionable} 件中 ${handled} 件を処理しました。`,
    noteEn: (accepted: number, wrong: number) =>
      `英語モデルは ${accepted} 件で分岐を実行し、そのうち ${wrong} 件が誤りでした。否定を含む返金依頼は返金へ、天気の質問はサポートへ振り分けられ、2 つの意図を含むメッセージはどちらか一方を選びます。試験後にこれらを修正してはいません。`,
    thresholds: (calibration: number) =>
      `しきい値は ${calibration} 件のキャリブレーション事例で、採用した事例がすべて正解になるように選びました。int8 量子化によって勝者が変わった例は、学習・キャリブレーションデータ全体でゼロです。`,
    showAll: (examName: string, wrong: number) => `${examName}の全事例を表示（誤り ${wrong} 件）`,
    columns: { message: 'メッセージ', expected: '期待', returned: '結果' },
  },
  install: {
    title: 'インストール',
    intro:
      'picklet は MIT ライセンスで npm に公開されています。開発依存としてインストールしてください。コンパイルされたモジュールは実行時に picklet に依存しないため、アプリにコンパイラが同梱されることはありません。',
    comment: 'または: bun add -D picklet / pnpm add -D picklet',
    noteBefore: '現在のリリースは 0.1.0 です。再現可能なビルドのためにバージョンを固定してください。CLI には Node 24 以降、または Bun 1.3 以降で ',
    noteAfter: ' が必要です。生成ファイルはコミットするか CI で生成し、分岐の意味や例文が変わったら再コンパイルしてください。',
  },
  footer: {
    before:
      'picklet 0.1.0、MIT ライセンス。英語・日本語モデルはアシスタントが作成した例文から学習しており、どちらの試験も独立したユーザーデータではありません。このページのモデルと評価結果はすべてリポジトリの',
    after: ' フォルダーから読み込んでいます。',
  },
};

export const strings: Record<Locale, Strings> = { en, ja };

export function detectLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'ja') return stored;
  } catch {
    // Storage may be unavailable; fall through to the browser language.
  }
  return typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('ja') ? 'ja' : 'en';
}

interface LocaleContextValue {
  readonly locale: Locale;
  readonly t: Strings;
  readonly setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue>({ locale: 'en', t: en, setLocale: () => {} });

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore storage failures; the choice still applies for this visit.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = strings[locale].htmlTitle;
    document.querySelector('meta[name="description"]')?.setAttribute('content', strings[locale].metaDescription);
  }, [locale]);

  const value = useMemo(() => ({ locale, t: strings[locale], setLocale }), [locale, setLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}
