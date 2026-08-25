"use client";

import { useEffect, useState } from "react";

type DocumentationPanelProps = {
  readonly onOpenParcel: () => void;
  readonly onCreateShare: () => void;
};

const GUIDE_SECTIONS = [
  "guide-quickstart",
  "guide-factors",
  "guide-policies",
  "guide-attachments",
  "guide-parcels",
  "guide-self-hosting",
  "guide-security",
] as const;

type GuideSection = (typeof GUIDE_SECTIONS)[number];

function isGuideSection(value: string): value is GuideSection {
  return GUIDE_SECTIONS.includes(value as GuideSection);
}

function guideFromHash(hash: string): GuideSection {
  const candidate = hash.slice(1);
  return isGuideSection(candidate) ? candidate : GUIDE_SECTIONS[0];
}

export function DocumentationPanel({ onOpenParcel, onCreateShare }: DocumentationPanelProps) {
  const [activeGuide, setActiveGuide] = useState<GuideSection>(GUIDE_SECTIONS[0]);

  useEffect(() => {
    const updateFromHash = () => setActiveGuide(guideFromHash(window.location.hash));
    updateFromHash();
    window.addEventListener("hashchange", updateFromHash);

    const sections = GUIDE_SECTIONS.map((id) => document.getElementById(id)).filter(
      (section): section is HTMLElement => section !== null,
    );
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top);
        const firstVisible = visible[0]?.target.id;
        if (firstVisible && isGuideSection(firstVisible)) {
          setActiveGuide(firstVisible);
        }
      },
      { rootMargin: "-18% 0px -68% 0px", threshold: [0, 0.2, 0.8] },
    );
    sections.forEach((section) => observer.observe(section));

    return () => {
      window.removeEventListener("hashchange", updateFromHash);
      observer.disconnect();
    };
  }, []);

  return (
    <section className="how-section" aria-labelledby="how-heading">
      <div className="how-header-block">
        <p className="eyebrow"><span className="eyebrow-dot" aria-hidden="true" />Documentation & Knowledge Base</p>
        <h2 id="how-heading" className="how-main-title">A share should reveal as little as possible.</h2>
        <p className="how-subtext">SecureBin combines zero-knowledge client-side encryption with atomic database policy enforcement. Explore how to create shares, manage multi-factor protection, self-host, and inspect the security model.</p>
      </div>

      <section className="docs-at-a-glance" aria-labelledby="docs-glance-heading">
        <div className="docs-glance-heading-row">
          <div>
            <p className="eyebrow">Security at a glance</p>
            <h3 id="docs-glance-heading">The four facts that matter first</h3>
          </div>
          <p className="docs-glance-note">A concise product explanation, visible before the detailed guides.</p>
        </div>
        <div className="docs-glance-grid">
          <article className="docs-glance-card">
            <span className="docs-glance-index">01 / BROWSER</span>
            <h4>Encryption happens locally</h4>
            <p>Plaintext, keys, passwords, unlock codes, and decrypted files stay in the browser. The URL fragment is never sent in an HTTP request.</p>
          </article>
          <article className="docs-glance-card">
            <span className="docs-glance-index">02 / SERVER</span>
            <h4>Policy is enforced atomically</h4>
            <p>Expiry, revocation, scheduled availability, and reveal limits are enforced by locked database transitions, not by UI state.</p>
          </article>
          <article className="docs-glance-card">
            <span className="docs-glance-index">03 / EVIDENCE</span>
            <h4>Receipts explain the protection</h4>
            <p>The Privacy Receipt identifies the algorithm, factors, policy, encrypted objects, and what infrastructure can still observe.</p>
          </article>
          <article className="docs-glance-card docs-glance-card-boundary">
            <span className="docs-glance-index">04 / LIMITS</span>
            <h4>Revocation has honest limits</h4>
            <p>Revocation blocks future online releases. It cannot erase plaintext or encrypted parcels that someone already downloaded.</p>
          </article>
        </div>
        <div className="docs-validation-strip" aria-label="Recorded CI validation baseline">
          <span className="docs-validation-label">Recorded CI baseline</span>
          <span><strong>217</strong> unit</span>
          <span><strong>16</strong> integration</span>
          <span><strong>155</strong> pgTAP</span>
          <span><strong>20 + 20</strong> browser</span>
          <span><strong>7</strong> Axe</span>
        </div>
      </section>

      <section className="docs-proof-path" aria-labelledby="docs-proof-heading">
        <div className="docs-proof-header">
          <div>
            <p className="eyebrow">Complete experience</p>
            <h3 id="docs-proof-heading">See the protection in one pass</h3>
          </div>
          <p>Each step uses an existing SecureBin surface and leaves a concrete boundary to inspect.</p>
        </div>
        <ol className="docs-proof-steps">
          <li><span className="docs-proof-number">01</span><strong>Seal a share</strong><span>Choose factors, expiry, release policy, files, or discussion.</span></li>
          <li><span className="docs-proof-number">02</span><strong>Inspect the proof</strong><span>Read the policy chips, fingerprint, Privacy Receipt, and full-link warning.</span></li>
          <li><span className="docs-proof-number">03</span><strong>Reveal locally</strong><span>Open the recipient view and watch the browser apply factors and release policy.</span></li>
          <li><span className="docs-proof-number">04</span><strong>Test the boundary</strong><span>Use the release window, parcel utility, discussion thread, or revoke control.</span></li>
        </ol>
      </section>

      <nav className="docs-nav-bar" aria-label="Documentation sections">
        <a className={`docs-nav-pill${activeGuide === "guide-quickstart" ? " active" : ""}`} aria-current={activeGuide === "guide-quickstart" ? "location" : undefined} href="#guide-quickstart">🚀 Quickstart</a>
        <a className={`docs-nav-pill${activeGuide === "guide-factors" ? " active" : ""}`} aria-current={activeGuide === "guide-factors" ? "location" : undefined} href="#guide-factors">🔐 Multi-Factor</a>
        <a className={`docs-nav-pill${activeGuide === "guide-policies" ? " active" : ""}`} aria-current={activeGuide === "guide-policies" ? "location" : undefined} href="#guide-policies">⏱️ Policies & Expiry</a>
        <a className={`docs-nav-pill${activeGuide === "guide-attachments" ? " active" : ""}`} aria-current={activeGuide === "guide-attachments" ? "location" : undefined} href="#guide-attachments">📎 Files & Replies</a>
        <a className={`docs-nav-pill${activeGuide === "guide-parcels" ? " active" : ""}`} aria-current={activeGuide === "guide-parcels" ? "location" : undefined} href="#guide-parcels">📦 Offline Parcels</a>
        <a className={`docs-nav-pill${activeGuide === "guide-self-hosting" ? " active" : ""}`} aria-current={activeGuide === "guide-self-hosting" ? "location" : undefined} href="#guide-self-hosting">🖥️ Self-Hosting</a>
        <a className={`docs-nav-pill${activeGuide === "guide-security" ? " active" : ""}`} aria-current={activeGuide === "guide-security" ? "location" : undefined} href="#guide-security">🛡️ Security Model</a>
      </nav>

      <div className="docs-grid" id="guide-quickstart">
        <article className="docs-card">
          <div className="principle-card-top"><span className="principle-number">01</span><span className="principle-tag">User Guide</span></div>
          <h3>🚀 Quickstart: Creating a Share</h3>
          <ol className="docs-step-list">
            <li className="docs-step-item"><span className="docs-step-num">1</span><div className="docs-step-text"><strong>Choose Your Mode</strong><p>Select <em>Plain Text</em> for credentials, <em>Markdown</em> for rich documents (with split/preview mode), or <em>Code</em> for language-aware snippets in one editable IDE-style surface.</p></div></li>
            <li className="docs-step-item"><span className="docs-step-num">2</span><div className="docs-step-text"><strong>Configure Access & Factors</strong><p>Optionally add a password, generate a two-channel unlock code, set a one-time or custom reveal limit, or define a timed expiration.</p></div></li>
            <li className="docs-step-item"><span className="docs-step-num">3</span><div className="docs-step-text"><strong>Share the Link</strong><p>Click <em>Create share</em>. Your browser encrypts the content with AES-256-GCM before sending ciphertext. Copy the link; the decryption key stays in the URL fragment (#key).</p></div></li>
          </ol>
        </article>

        <article className="docs-card" id="guide-factors">
          <div className="principle-card-top"><span className="principle-number">02</span><span className="principle-tag">Security</span></div>
          <h3>🔐 Multi-Factor Protection</h3>
          <p>SecureBin supports four distinct factor combinations to prevent link interception:</p>
          <div className="docs-badge-row"><span className="docs-badge">Link Key</span><span className="docs-badge">Link + Password</span><span className="docs-badge">Link + Unlock Code</span><span className="docs-badge">Link + Pass + Unlock</span></div>
          <ul className="threat-section" style={{ margin: 0, paddingLeft: "1.2rem" }}>
            <li><strong>Link Key:</strong> 256-bit key in the URL fragment. The server never receives the fragment.</li>
            <li><strong>Password:</strong> Derived using PBKDF2 (600,000 iterations). Recipient must enter the exact password.</li>
            <li><strong>Second-Channel Unlock:</strong> 27-character base-28 code with checksum (124 bits entropy). Send it separately through a channel you trust so link interception alone is insufficient.</li>
          </ul>
        </article>
      </div>

      <div className="docs-grid" id="guide-policies">
        <article className="docs-card">
          <div className="principle-card-top"><span className="principle-number">03</span><span className="principle-tag">Lifecycle</span></div>
          <h3>⏱️ Access Policies & Auto-Hide</h3>
          <ul className="threat-section" style={{ margin: 0, paddingLeft: "1.2rem" }}>
            <li><strong>One-Time Release:</strong> The share becomes permanently unavailable after 1 authorized ciphertext release.</li>
            <li><strong>Reveal Limits:</strong> The safe default is one release; set exact bounds (3, 5, 10, custom, or unlimited) when needed. Every limit is enforced atomically at database level.</li>
            <li><strong>Expiry Durations:</strong> Automatically expires after 24h, 7 days, 30 days, custom duration, or Never (indefinite until manual revocation).</li>
            <li><strong>Release Window & Privacy Veil:</strong> A countdown begins at the first authorized ciphertext release. Presets range from 10 seconds to 5 minutes, with custom windows up to 24 hours. When it closes, SecureBin drops its application-held decrypted references and replaces the content with a privacy veil; JavaScript cannot guarantee physical memory erasure.</li>
          </ul>
        </article>

        <article className="docs-card" id="guide-attachments">
          <div className="principle-card-top"><span className="principle-number">04</span><span className="principle-tag">Attachments & Collab</span></div>
          <h3>📎 Files & Encrypted Discussions</h3>
          <ul className="threat-section" style={{ margin: 0, paddingLeft: "1.2rem" }}>
            <li><strong>Multi-File Uploads:</strong> Attach up to 5 files (10 MB each). Each file is encrypted with its own derived key (<code>securebin/v2/link/file</code>).</li>
            <li><strong>Safe Previews & ZIP:</strong> Recipients can preview supported images and plain text safely. PDFs, executables, markup, and other unsupported formats remain download-only; multiple attachments can be downloaded as one decrypted ZIP archive.</li>
            <li><strong>Encrypted Comments:</strong> Threaded replies protected by client-held discussion capabilities. Authors can edit or delete comments with cryptographic proof tokens.</li>
          </ul>
        </article>
      </div>

      <section className="docs-card" id="guide-parcels">
        <div className="principle-card-top"><span className="principle-number">05</span><span className="principle-tag">Offline Capability</span></div>
        <h3>📦 Offline Encrypted Parcels (.securebin)</h3>
        <p>Export a newly created share as an encrypted <code>.securebin</code> parcel (SBPX v1). Once the SecureBin parcel utility is loaded, restore the ciphertext from an air-gapped USB or local drive without API or Storage requests.</p>
        <div style={{ marginTop: "0.5rem" }}><button type="button" className="action-button secondary-button" onClick={onOpenParcel}>Open Parcel Utility</button></div>
      </section>

      <section className="docs-card" id="guide-self-hosting">
        <div className="principle-card-top"><span className="principle-number">06</span><span className="principle-tag">Self-Hosting</span></div>
        <h3>🖥️ Self-Hosting Guide & Local Stack</h3>
        <p>Run your own private instance of SecureBin using Docker and Node.js. No external SaaS or proprietary dependencies required.</p>
        <div className="docs-code-box"><code># 1. Start local Supabase container and database migrations<br /><strong>pnpm local:setup</strong><br /><br /># 2. Launch production-built SecureBin web app<br /><strong>pnpm local</strong><br /><br /># Open browser at http://127.0.0.1:3101</code></div>
        <p>For complete VPS/cloud deployment, Nginx reverse proxy configurations, and systemd service scripts, see the <a href="https://github.com/adithyarao2605/SecureBin/blob/main/docs/self-hosting.md" target="_blank" rel="noreferrer" style={{ color: "var(--mineral)", textDecoration: "underline" }}>Self-Hosting Documentation (docs/self-hosting.md)</a>.</p>
      </section>

      <section className="protocol-section" id="guide-security" aria-labelledby="protocol-heading">
        <p className="eyebrow">Cryptographic Protocol</p>
        <h3 id="protocol-heading">Sender browser → sealed parcel → recipient browser</h3>
        <div className="protocol-grid"><div><strong>Sender browser</strong><span>Plaintext → optional PBKDF2 password processing → HKDF-SHA-256 object-key derivation → AES-256-GCM → ciphertext</span></div><div><strong>SecureBin Server</strong><span>Sealed ciphertext, bounded policy timestamps, and atomic release counters</span></div><div><strong>Recipient browser</strong><span>Ciphertext + fragment key + optional user factors → local decryption</span></div></div>
      </section>

      <section className="boundary-comparison" aria-labelledby="observe-heading">
        <div><h3 id="observe-heading">Infrastructure can observe</h3><ul><li>Public share identifier and opaque ciphertext</li><li>Ciphertext size and lifecycle timestamps</li><li>Access policy limits and authorized release lease count</li></ul></div>
        <div><h3>Official client keeps local</h3><ul><li>Plaintext, notes, and URL-fragment secret (#key)</li><li>Password and second-channel unlock factor</li><li>Decrypted filenames, file contents, and MIME types</li></ul></div>
      </section>

      <section className="protocol-section">
        <p className="eyebrow">Atomic Database Enforcement</p>
        <h3>Row-locked concurrency prevents limit overruns</h3>
        <div className="atomic-example"><span>20 concurrent test requests</span><strong>PostgreSQL FOR UPDATE lock</strong><span>3 authorized · 17 uniform unavailable</span></div>
        <p style={{ marginTop: "0.75rem" }}>A lost-response retry that reuses its request token recovers the existing 5-minute authorization lease without consuming an extra release count.</p>
      </section>

      <section className="threat-section">
        <p className="eyebrow">Honest Security Boundaries</p>
        <ul><li>Cannot protect against compromised browser extensions or malware on the recipient device.</li><li>Cannot prevent a recipient from taking physical screenshots or copying decrypted text.</li><li>Cannot erase copies of files that a recipient has already downloaded locally.</li><li>The service can observe application ciphertext sizes and access events; network providers can observe TLS traffic sizes, endpoints, and timing.</li></ul>
      </section>

      <section className="how-final">
        <div><h3>Ready to share?</h3><p>Create an end-to-end encrypted note or upload files with custom access policies.</p><button type="button" className="action-button primary-button" onClick={onCreateShare}>Create a Share</button></div>
        <div><h3>Inspect source & specs</h3><p>Review architecture specifications, protocol threat models, and reproducible test suites.</p><a className="action-button tertiary-button" href="https://github.com/adithyarao2605/SecureBin" target="_blank" rel="noreferrer">GitHub Repository</a></div>
      </section>
    </section>
  );
}
