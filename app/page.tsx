import Link from "next/link";
import { AuroraCanvas } from "./components/aurora-canvas";

export const metadata = {
  title: "SecureBin — private sharing, by design",
  description: "Browser-encrypted sharing for sensitive notes and files.",
};

function ArrowIcon() {
  return <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 10h11m-5-5 5 5-5 5" /></svg>;
}

function Icon({ type }: { type: "browser" | "key" | "flame" }) {
  if (type === "browser") return <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M7 6.5h.01M10 6.5h.01" /></svg>;
  if (type === "key") return <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="8.5" cy="15.5" r="3.5" /><path d="m11 13 8-8m-2 2 2 2m-5-1 2 2" /></svg>;
  return <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M12 21c4.5-2.2 6.4-5.2 5.6-9.2-.4-2-1.7-3.7-3.8-5.3.2 2-1 3.1-2.3 3.9.1-2.8-1.2-4.6-3.1-5.5.4 3.1-2.1 5.1-2.1 8.1C6.3 16.8 8.8 19.6 12 21Z" /></svg>;
}

export default function LandingPage() {
  return (
    <div className="landing-shell">
      <AuroraCanvas />
      <header className="landing-header">
        <Link className="landing-brand" href="/" aria-label="SecureBin home">
          <span className="landing-brand-name">SecureBin</span>
        </Link>
        <nav className="landing-nav" aria-label="Primary navigation">
          <div className="landing-nav-pills">
            <Link className="landing-nav-pill landing-nav-pill-active" href="/new">New share</Link>
            <Link className="landing-nav-pill" href="/new#history">My shares</Link>
            <Link className="landing-nav-pill" href="/new#how-it-works">How it works</Link>
          </div>
        </nav>
        <Link className="landing-header-cta" href="/new">Create share</Link>
      </header>

      <main>
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero-copy">
            <h1 id="landing-title">Share sensitive information.<br /><em>Stay in control.</em></h1>
            <p className="landing-lede">Zero-knowledge, client-side encryption. Secure your text, code, and files with a browser-boundary protocol where the key never leaves your device.</p>
            <div className="landing-actions">
              <Link className="landing-primary-action" href="/new">Create a Secure Share <ArrowIcon /></Link>
              <a className="landing-secondary-action" href="#self-hosting">Self-Hosting <ArrowIcon /></a>
            </div>
            <div className="landing-proof-pills" id="features" aria-label="SecureBin properties">
              <span><Icon type="browser" />Client-side encryption</span>
              <span><Icon type="key" />Zero-knowledge</span>
              <span><Icon type="flame" />Burn after reading</span>
            </div>
          </div>

          <div className="landing-mock-wrap" aria-label="Preview of the SecureBin share composer">
            <div className="landing-orbit landing-orbit-one" aria-hidden="true" />
            <div className="landing-orbit landing-orbit-two" aria-hidden="true" />
            <div className="landing-mock-card">
              <div className="landing-mock-top"><span className="landing-mock-eyebrow"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v5h5M9 13h6M9 17h6" /></svg>New Secure Share</span><span className="landing-mock-dots" aria-hidden="true"><i /><i /><i /></span></div>
              <div className="landing-mock-field"><span>Paste your text, secrets, or drop files here...</span><span className="landing-caret" aria-hidden="true" /></div>
              <div className="landing-mock-options"><span><small>EXPIRES IN</small>1 hour</span><span><small>VIEW LIMIT</small>1 view <b>(burn)</b></span></div>
              <Link className="landing-mock-submit" href="/new">Encrypt &amp; Generate Link</Link>
            </div>
          </div>
        </section>

        <section className="landing-how" id="how-it-works" aria-labelledby="landing-how-title">
          <div><p className="landing-section-label">The boundary matters</p><h2 id="landing-how-title">Private by default,<br /><span>honest by design.</span></h2></div>
          <div className="landing-how-copy"><p>SecureBin keeps encryption and decryption in your browser. Access policy is enforced atomically on the server, so you can see exactly what each side knows.</p><Link href="/new#how-it-works">Read how it works <ArrowIcon /></Link></div>
        </section>

        <section className="landing-self-host" id="self-hosting" aria-labelledby="self-hosting-title">
          <div><p className="landing-section-label">Own the boundary</p><h2 id="self-hosting-title">Run SecureBin<br /><span>on your terms.</span></h2></div>
          <p>Self-hosting keeps the storage, policy, and deployment boundary in your hands. The same browser-first protocol, without a hosted dependency.</p>
        </section>
      </main>

      <footer className="landing-footer"><div><strong>SecureBin</strong><span>Zero-knowledge by design.</span></div><nav aria-label="Footer navigation"><a href="#features">Features</a><Link href="/new#how-it-works">Docs</Link><a href="#self-hosting">Self-Hosting</a><a href="https://github.com/adithyarao2605/SecureBin" rel="noreferrer">GitHub</a></nav></footer>
    </div>
  );
}
