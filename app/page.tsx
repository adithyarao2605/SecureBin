import { Composer } from "./components/composer";
import { ThemeToggle } from "./components/theme-toggle";

export const dynamic = "force-dynamic";

function SealMark() {
  return (
    <span className="seal-mark" aria-hidden="true">
      <svg viewBox="0 0 32 32" role="presentation">
        <path d="M16 3.5 27.2 9v8.4c0 6.1-4.7 10-11.2 11.1C9.5 27.4 4.8 23.5 4.8 17.4V9L16 3.5Z" />
        <path d="m10.8 16 3.4 3.4 7.2-7.2" />
      </svg>
    </span>
  );
}

export default function HomePage() {
  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href="#main-content" aria-label="SecureBin home">
          <SealMark />
          <span className="brand-name">SecureBin</span>
          <span className="brand-status">private by design</span>
        </a>
        <nav className="header-actions" aria-label="Site navigation">
          <a className="quiet-link" href="#how-it-works">How it works</a>
          <ThemeToggle />
        </nav>
      </header>

      <main id="main-content">
        <section className="hero-grid" aria-labelledby="hero-heading">
          <div className="hero-copy">
            <p className="eyebrow"><span className="eyebrow-dot" aria-hidden="true" />A quieter way to share</p>
            <h1 id="hero-heading">Keep the key.<br /><em>Share the secret.</em></h1>
            <p className="hero-summary">
              SecureBin is building a browser-first place for notes and files that should not become somebody else&apos;s data.
            </p>
            <div className="hero-notes" aria-label="SecureBin principles">
              <span><span className="note-glyph" aria-hidden="true">01</span>Sealed in your browser</span>
              <span><span className="note-glyph" aria-hidden="true">02</span>Server sees ciphertext</span>
            </div>
          </div>
          <div className="hero-aside" aria-label="Product status">
            <div className="aside-rule" />
            <p className="aside-label">Private by default</p>
            <p className="aside-copy">Write here, then seal the note in your browser before it leaves the page.</p>
            <p className="aside-footnote">No account required · Nothing is sent until you seal it</p>
          </div>
        </section>

        <Composer />

        <section className="how-section" id="how-it-works" aria-labelledby="how-heading">
          <div>
            <p className="eyebrow"><span className="eyebrow-dot" aria-hidden="true" />The boundary matters</p>
            <h2 id="how-heading">A share should reveal<br />as little as possible.</h2>
          </div>
          <div className="principles-grid">
            <article>
              <span className="principle-number" aria-hidden="true">A</span>
              <h3>Local first</h3>
              <p>Encryption and keys stay in the browser you control.</p>
            </article>
            <article>
              <span className="principle-number" aria-hidden="true">B</span>
              <h3>Explicit access</h3>
              <p>Expiry, reveal limits, and revocation will be visible choices—not hidden defaults.</p>
            </article>
            <article>
              <span className="principle-number" aria-hidden="true">C</span>
              <h3>Plain language</h3>
              <p>A privacy receipt will show what infrastructure can see and what it never receives.</p>
            </article>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <span>SecureBin / private sharing</span>
        <span>Keep the key close.</span>
      </footer>
    </div>
  );
}
