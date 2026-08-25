import Link from "next/link";
import { ProductBrand } from "./components/product-brand";
import { ThemeToggle } from "./components/theme-toggle";

export const metadata = { title: "SecureBin — private sharing, by design", description: "Browser-encrypted sharing for sensitive notes and files." };

function ArrowIcon() { return <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 10h11m-5-5 5 5-5 5" /></svg>; }
function FeatureIcon({ type }: { type: "key" | "policy" | "code" }) {
  if (type === "key") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="8" cy="15" r="3.5" /><path d="m10.6 12.4 8-8m-2.1 2.1 2 2m-5-1 2 2" /></svg>;
  if (type === "policy") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M5 7h9M5 12h6M5 17h9M17 14l2 2 3-4" /></svg>;
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m8 8-4 4 4 4m8-8 4 4-4 4m-3-9-2 10" /></svg>;
}
function Check() { return <span className="landing-check" aria-hidden="true">✓</span>; }

export default function LandingPage() {
  return <div className="landing-shell">
    <header className="landing-header">
      <div className="landing-identity"><ProductBrand className="landing-brand" nameClassName="landing-brand-name" /><span className="landing-tagline">PRIVATE BY DESIGN</span></div>
      <nav className="landing-nav" aria-label="Primary navigation"><Link className="landing-nav-link landing-nav-link-active" href="#features">Features</Link><Link className="landing-nav-link" href="#security">Security</Link><a className="landing-nav-link" href="https://github.com/adithyarao2605/SecureBin/blob/main/self_hosting.md" target="_blank" rel="noreferrer">Self-Host</a><Link className="landing-nav-link" href="/new#how-it-works">Docs</Link></nav>
      <ThemeToggle />
    </header>
    <main>
      <section className="landing-hero" aria-labelledby="landing-title"><div className="landing-hero-copy"><h1 id="landing-title">Share sensitive<br />information.<br /><em>Stay in control.</em></h1><p className="landing-lede">Your browser encrypts notes and files before they leave the page. The server receives ciphertext, not plaintext.</p><div className="landing-actions"><Link className="landing-primary-action" href="/new">Create secure share <ArrowIcon /></Link><a className="landing-secondary-action" href="#security">How it works</a></div><div className="landing-proof-pills" aria-label="SecureBin properties"><span>♙ Client-side encryption</span><span>⌁ Zero-knowledge</span><span>◷ Timed expiry</span></div></div><div className="landing-composer-preview" aria-label="Preview of the SecureBin share composer"><div className="landing-preview-tabs"><span className="active">Plain</span><span>MD</span><span>Code</span><span className="landing-preview-settings" aria-hidden="true">⚙</span></div><p className="landing-preview-placeholder">Paste sensitive credentials, API keys, or notes here...</p><div className="landing-preview-footer"><span>♧ &nbsp;Burns in 1hr</span><Link href="/new">♙&nbsp; Encrypt</Link></div></div></section>
      <section className="landing-section landing-why" id="features" aria-labelledby="why-title"><div className="landing-section-intro"><h2 id="why-title">Why SecureBin</h2><p>Built on robust cryptographic primitives to ensure your data stays yours. Zero trust architecture by default.</p></div><div className="landing-feature-grid" id="security"><article><FeatureIcon type="key" /><h3>Encryption stays local</h3><p>Data is encrypted in your browser before it ever leaves your device. The server only receives cipher-text.</p></article><article><FeatureIcon type="policy" /><h3>Explicit access policy</h3><p>Set strict burn-after-reading rules, time-based expiry, or password protection for every share.</p></article><article className="landing-feature-wide"><FeatureIcon type="code" /><h3>Transparent by design</h3><p>Inspect the independently implemented client and server, or deploy SecureBin on your own infrastructure.</p></article></div></section>
      <section className="landing-section landing-capabilities" id="self-hosting" aria-labelledby="capabilities-title"><div><h2 id="capabilities-title">Technical Capabilities</h2><div className="landing-capability-list"><span><Check />AES-256-GCM</span><span><Check />Burn after read</span><span><Check />Password auth</span><span><Check />Syntax highlight</span><span><Check />Markdown render</span><span><Check />No plaintext logs</span></div></div><div><h2>Run it your way</h2><div className="landing-terminal" aria-label="Self-hosting command preview"><div className="landing-terminal-dots"><i /><i /><i /></div><code><span># Start the verified local stack</span><br /><b>pnpm local:setup</b><br /><b>pnpm local</b></code></div></div></section>
    </main>
    <footer className="landing-footer"><div><strong>SecureBin</strong><span>Zero-knowledge by design.</span></div><nav aria-label="Footer navigation"><a href="#features">Features</a><Link href="/new#how-it-works">Docs</Link><a href="https://github.com/adithyarao2605/SecureBin/blob/main/self_hosting.md" target="_blank" rel="noreferrer">Self-Hosting</a><a href="https://github.com/adithyarao2605/SecureBin" rel="noreferrer">GitHub</a></nav></footer>
  </div>;
}
