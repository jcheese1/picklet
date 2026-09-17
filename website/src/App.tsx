import Code from './components/Code';
import Demo from './components/Demo';
import Results from './components/Results';
import { useLocale, type Locale } from './i18n';
import { kilobytes, models } from './models';

const en = models.en;

export default function App() {
  const { locale, t, setLocale } = useLocale();

  return (
    <>
      <header className="masthead">
        <a className="wordmark" href="#top" aria-label={t.nav.home}>
          picklet<span aria-hidden="true">( )</span>
        </a>
        <div className="masthead-right">
          <nav aria-label={t.nav.sections}>
            <a href="#demo">{t.nav.demo}</a>
            <a href="#how">{t.nav.how}</a>
            <a href="#results">{t.nav.results}</a>
            <a href="#install">{t.nav.install}</a>
            <a href="https://www.npmjs.com/package/picklet" rel="noopener">{t.nav.npm}</a>
          </nav>
          <div className="segmented locale-switcher" role="group" aria-label={t.localeSwitcher.label}>
            {(['en', 'ja'] as const).map((value: Locale) => (
              <button
                key={value}
                type="button"
                lang={value}
                className={value === locale ? 'is-active' : undefined}
                aria-pressed={value === locale}
                onClick={() => setLocale(value)}
              >
                {t.localeSwitcher[value]}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <h1>{t.hero.title}</h1>
          <p className="lede">{t.hero.lede}</p>
        </section>

        <Demo />

        <section className="how" id="how">
          <div className="section-head">
            <h2>{t.how.title}</h2>
            <p>{t.how.intro}</p>
          </div>

          <ol className="steps">
            <li>
              <h3>{t.how.step1.title}</h3>
              <Code title="inbox.switch.ts">{`import { defineSwitch } from 'picklet';

export default defineSwitch({
  refund:  { description: 'The customer wants their money back',   examples: refundExamples },
  support: { description: 'The customer needs help using the product', examples: supportExamples },
  sales:   { description: 'The customer wants to buy something',    examples: salesExamples },
}, {
  name: 'support-inbox',
  fallbackExamples,   // ${t.how.step1.comments.fallback}
  calibration,        // ${t.how.step1.comments.calibration}
});`}</Code>
              <p>{t.how.step1.body}</p>
            </li>
            <li>
              <h3>{t.how.step2.title}</h3>
              <Code title="terminal">{`$ picklet compile inbox.switch.ts --out src/generated/inbox.mjs

  inbox.mjs          ${t.how.step2.output.module(kilobytes(en.report.artifactBytes), kilobytes(en.report.brotliBytes))}
  inbox.d.mts        ${t.how.step2.output.types}
  inbox.report.json  ${t.how.step2.output.report}`}</Code>
              <p>{t.how.step2.body(en.report.parameters.toLocaleString(locale))}</p>
            </li>
            <li>
              <h3>{t.how.step3.title}</h3>
              <Code title="app.ts">{`import inbox from './generated/inbox.mjs';

const result = await inbox.match(message, {
  refund:    () => queue('billing'),
  support:   () => queue('helpdesk'),
  sales:     () => queue('sales'),
  otherwise: ({ decision }) => askHuman(decision.reason),
});

// ${t.how.step3.comment}
const decision = inbox(message);
if (decision.kind === 'abstain') console.log(decision.reason, decision.candidates);`}</Code>
              <p>{t.how.step3.body}</p>
            </li>
          </ol>
        </section>

        <section className="honest" aria-labelledby="honest-title">
          <h2 id="honest-title">{t.honest.title}</h2>
          <div className="honest-columns">
            <ul>
              {t.honest.is.map(item => <li key={item}>{item}</li>)}
            </ul>
            <ul>
              {t.honest.isNot.map(item => <li key={item}>{item}</li>)}
            </ul>
          </div>
        </section>

        <Results />

        <section className="install" id="install">
          <div className="section-head">
            <h2>{t.install.title}</h2>
            <p>{t.install.intro}</p>
          </div>
          <Code title="terminal">{`$ npm install --save-dev picklet      # ${t.install.comment}
$ npx picklet compile inbox.switch.ts --out src/generated/inbox.mjs`}</Code>
          <p className="install-note">
            {t.install.noteBefore}<code>bun --bun</code>{t.install.noteAfter}
          </p>
        </section>
      </main>

      <footer className="colophon">
        <p>
          {t.footer.before}<code> dist/</code>{t.footer.after}
        </p>
      </footer>
    </>
  );
}
