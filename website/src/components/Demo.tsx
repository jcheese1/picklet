import { useEffect, useId, useRef, useState } from 'react';
import { useLocale } from '../i18n';
import { cases, displayCase, kilobytes, models, type Decision, type Language, type Outcome } from '../models';

interface Run {
  readonly decision: Decision;
  readonly returned: string;
  readonly elapsedMs: number;
}

const handlerLines: readonly { readonly branch: Outcome; readonly code: string }[] = [
  { branch: 'refund', code: "  refund:    () => 'refund'," },
  { branch: 'support', code: "  support:   () => 'support'," },
  { branch: 'sales', code: "  sales:     () => 'sales'," },
  { branch: 'otherwise', code: "  otherwise: () => 'clarify'," },
];

function evaluate(language: Language, message: string): Run {
  const { predictor } = models[language];
  const start = performance.now();
  const decision = predictor(message);
  const elapsedMs = performance.now() - start;
  const returned = decision.kind === 'match' ? decision.case : 'clarify';
  return { decision, returned, elapsedMs };
}

export default function Demo() {
  const { locale, t } = useLocale();
  // The demo starts on the model matching the page language, then the two are independent.
  const [language, setLanguage] = useState<Language>(locale);
  const [drafts, setDrafts] = useState<Record<Language, string>>({ en: models.en.draft, ja: models.ja.draft });
  const [run, setRun] = useState<Run | { error: string }>(() => evaluate(locale, models[locale].draft));
  const [matched, setMatched] = useState<string>('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const textareaId = useId();

  const model = models[language];
  const message = drafts[language];

  useEffect(() => {
    try {
      setRun(evaluate(language, message));
    } catch (error) {
      setRun({ error: error instanceof Error ? error.message : String(error) });
    }
  }, [language, message]);

  // Exercise the real .match() path so the code on the right is what runs.
  useEffect(() => {
    let cancelled = false;
    model.predictor
      .match(message, {
        refund: () => 'refund',
        support: () => 'support',
        sales: () => 'sales',
        otherwise: () => 'clarify',
      })
      .then(value => { if (!cancelled) setMatched(value); })
      .catch(() => { if (!cancelled) setMatched(''); });
    return () => { cancelled = true; };
  }, [model, message]);

  const setMessage = (text: string) => setDrafts(current => ({ ...current, [language]: text }));

  const decision = 'error' in run ? null : run.decision;
  const taken: Outcome | null = decision ? (decision.kind === 'match' ? decision.case : 'otherwise') : null;
  const scores: Record<Outcome, number> = { refund: 0, support: 0, sales: 0, otherwise: 0 };
  if (decision) {
    for (const candidate of decision.candidates) scores[candidate.case] = candidate.score;
    scores.otherwise = decision.fallbackScore;
  }

  return (
    <section className="demo" id="demo" aria-label={t.demo.aria}>
      <div className="demo-input">
        <div className="demo-toolbar">
          <label className="demo-label" htmlFor={textareaId}>{t.demo.label}</label>
          <div className="segmented" role="group" aria-label={t.demo.modelGroup}>
            {(['ja', 'en'] as const).map(value => (
              <button
                key={value}
                type="button"
                className={value === language ? 'is-active' : undefined}
                aria-pressed={value === language}
                onClick={() => setLanguage(value)}
              >
                {t.demo.model[value]}
              </button>
            ))}
          </div>
        </div>
        <textarea
          id={textareaId}
          ref={textareaRef}
          lang={language}
          value={message}
          maxLength={4000}
          spellCheck={false}
          rows={4}
          onChange={event => setMessage(event.target.value)}
        />
        <p className="demo-hint">{t.demo.hint}</p>
        <div className="presets" aria-label={t.demo.presetsAria}>
          {model.presets.map((preset, index) => (
            <button
              key={preset.text}
              type="button"
              lang={language === locale ? undefined : language}
              className={preset.trap ? 'preset is-trap' : 'preset'}
              title={preset.trap ? t.demo.trapTitle : undefined}
              onClick={() => { setMessage(preset.text); textareaRef.current?.focus(); }}
            >
              {t.demo.presets[language][index]}
            </button>
          ))}
        </div>
        <p className="demo-footnote">{t.demo.presetNote}</p>
      </div>

      <div className="demo-output">
        <pre className="switch-code" aria-label={t.demo.codeAria}>
          <code>
            <span className="code-line">{`const result = await inbox.match(message, {`}</span>
            {handlerLines.map(line => (
              <span
                key={line.branch}
                className={line.branch === taken ? 'code-line is-taken' : 'code-line'}
                aria-current={line.branch === taken ? 'true' : undefined}
              >
                {line.code}
              </span>
            ))}
            <span className="code-line">{`});`}</span>
          </code>
        </pre>

        <div className="outcome" aria-live="polite">
          {'error' in run ? (
            <p className="outcome-error">{run.error}</p>
          ) : (
            <>
              <div className="outcome-main">
                <span className="outcome-value">
                  <span className="outcome-key">{t.demo.resultKey}</span> = '{matched || run.returned}'
                </span>
                <span className="outcome-reason">
                  {run.decision.kind === 'match'
                    ? t.demo.matched(run.decision.margin.toFixed(2))
                    : t.demo.abstained(t.demo.reasons[run.decision.reason] ?? run.decision.reason)}
                </span>
              </div>
              <span className="outcome-timing">{run.elapsedMs.toFixed(2)} ms</span>
            </>
          )}
        </div>

        <ol className="scores" aria-label={t.demo.scoresAria}>
          {([...cases, 'otherwise'] as const).map(outcome => (
            <li key={outcome} className={outcome === taken ? 'score is-taken' : 'score'}>
              <span className="score-name">{displayCase(outcome)}</span>
              <span className="score-track"><span className="score-fill" style={{ width: `${scores[outcome] * 100}%` }} /></span>
              <span className="score-value">{(scores[outcome] * 100).toFixed(1)}%</span>
            </li>
          ))}
        </ol>
        <p className="demo-footnote">{t.demo.scoresNote(model.report.policy.minScore, model.report.policy.minMargin)}</p>
        <p className="demo-module">
          {t.demo.runningPrefix}<code>{model.fileName}</code>{t.demo.running(kilobytes(model.report.brotliBytes))}
          <a href={model.moduleUrl} download={model.fileName}>{t.demo.download}</a>
        </p>
      </div>
    </section>
  );
}
