import { useState } from 'react';
import { useLocale } from '../i18n';
import { displayCase, models, type Exam, type Language } from '../models';

function rawTop1(exam: Exam): number {
  if (exam.rawTop1Correct !== undefined) return exam.rawTop1Correct;
  return exam.results.filter(row => {
    const decision = (row as { decision?: { candidates: { case: string; score: number }[]; fallbackScore: number } }).decision;
    if (!decision) return false;
    const top = decision.candidates[0];
    const winner = decision.fallbackScore > top.score ? '__fallback' : top.case;
    return winner === row.label;
  }).length;
}

export default function Results() {
  const { locale, t } = useLocale();
  const [language, setLanguage] = useState<Language>(locale);
  const model = models[language];
  const { exam, baseline, report } = model;
  const wrongRows = exam.results.filter(row => !row.correct);

  return (
    <section className="results" id="results">
      <div className="section-head">
        <h2>{t.results.title}</h2>
        <p>{t.results.intro}</p>
      </div>

      <div className="segmented" role="group" aria-label={t.results.examGroup}>
        {(['ja', 'en'] as const).map(value => (
          <button key={value} type="button" className={value === language ? 'is-active' : undefined} aria-pressed={value === language} onClick={() => setLanguage(value)}>
            {t.results.model[value]}
          </button>
        ))}
      </div>

      <dl className="tally">
        <div>
          <dt>{t.results.tally.final}</dt>
          <dd><b>{exam.correct}</b> / {exam.count}</dd>
        </div>
        <div>
          <dt>{t.results.tally.raw}</dt>
          <dd><b>{rawTop1(exam)}</b> / {exam.count}</dd>
        </div>
        <div>
          <dt>{t.results.tally.handled}</dt>
          <dd><b>{exam.correctlyAccepted}</b> / {exam.actionable}</dd>
        </div>
        <div>
          <dt>{t.results.tally.rejected}</dt>
          <dd><b>{exam.fallbackCorrect}</b> / {exam.expectedFallback}</dd>
        </div>
        <div className={exam.incorrectAccepted ? 'is-warning' : undefined}>
          <dt>{t.results.tally.wrong}</dt>
          <dd><b>{exam.incorrectAccepted}</b></dd>
        </div>
      </dl>

      <div className="results-notes">
        {language === 'ja' ? (
          <p>
            {t.results.noteJa(rawTop1(exam), exam.count, report.policy.minMargin)}<code>otherwise</code>
            {locale === 'ja' ? ' に保留されます。' : '.'}
            {baseline && t.results.noteJaBaseline(baseline.correct, baseline.count, baseline.correctlyAccepted, baseline.actionable)}
          </p>
        ) : (
          <p>{t.results.noteEn(exam.accepted, exam.incorrectAccepted)}</p>
        )}
        <p>{t.results.thresholds(report.calibration.count)}</p>
      </div>

      <details className="exam">
        <summary>{t.results.showAll(t.results.examName[language], wrongRows.length)}</summary>
        <div className="exam-table">
          <table>
            <thead>
              <tr>
                <th scope="col">{t.results.columns.message}</th>
                <th scope="col">{t.results.columns.expected}</th>
                <th scope="col">{t.results.columns.returned}</th>
              </tr>
            </thead>
            <tbody>
              {exam.results.map(row => (
                <tr key={row.text} className={row.correct ? undefined : 'is-wrong'}>
                  <td lang={language}>{row.text}</td>
                  <td>{displayCase(row.label)}</td>
                  <td>{displayCase(row.actual)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
