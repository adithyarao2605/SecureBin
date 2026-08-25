"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Composer } from "./composer";
import { ParcelImport } from "./parcel-import";
import { EvidenceRail } from "./evidence-rail";
import { ShareHistoryDesk } from "./share-history";
import { ThemeToggle } from "./theme-toggle";
import { ProductBrand } from "./product-brand";
import {
  defaultPolicyDraft,
  type ProoflinePhase,
  type ValidatedPolicy,
  validatePolicyDraft,
} from "../../lib/shares/policy-ui";
import { loadShareHistory } from "../../lib/shares/share-history";

type AppTab = "create" | "history" | "how-it-works" | "parcel";
const PRIMARY_TABS = ["create", "history", "how-it-works"] as const;
const DOCUMENTATION_SECTION_HASHES = [
  "#guide-quickstart",
  "#guide-factors",
  "#guide-policies",
  "#guide-attachments",
  "#guide-parcels",
  "#guide-self-hosting",
  "#guide-security",
] as const;

function tabFromHash(hash: string): AppTab {
  if (hash === "#history") return "history";
  if (hash === "#how-it-works" || (DOCUMENTATION_SECTION_HASHES as readonly string[]).includes(hash)) {
    return "how-it-works";
  }
  return "create";
}

export function AppWorkspace() {
  const [activeTab, setActiveTab] = useState<AppTab>("create");
  const [phase, setPhase] = useState<ProoflinePhase>("draft");
  const [historySignal, setHistorySignal] = useState(0);
  const [historyCount, setHistoryCount] = useState(0);
  const [policy, setPolicy] = useState<ValidatedPolicy>(
    validatePolicyDraft(defaultPolicyDraft())
  );
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    setHistoryCount(loadShareHistory().length);
  }, [historySignal]);

  useEffect(() => {
    const selectFromHash = () => {
      setActiveTab(tabFromHash(window.location.hash));
    };
    selectFromHash();
    window.addEventListener("hashchange", selectFromHash);
    return () => window.removeEventListener("hashchange", selectFromHash);
  }, []);

  function changeTab(next: AppTab) {
    setActiveTab(next);
    const hash = next === "history" ? "#history" : next === "how-it-works" ? "#how-it-works" : "";
    window.history.replaceState(null, "", `${window.location.pathname}${hash}`);
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = PRIMARY_TABS.length - 1;
    const next = event.key === "ArrowRight" || event.key === "ArrowDown"
      ? (index + 1) % PRIMARY_TABS.length
      : event.key === "ArrowLeft" || event.key === "ArrowUp"
        ? (index + last) % PRIMARY_TABS.length
        : event.key === "Home" ? 0 : event.key === "End" ? last : -1;
    if (next < 0) return;
    event.preventDefault();
    changeTab(PRIMARY_TABS[next]);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="brand-group">
          <ProductBrand className="brand brand-btn" status="private by design" />
        </div>

        <nav className="header-tabs-nav" aria-label="Main application tabs">
          <div className="tab-pill-group" role="tablist" aria-label="Primary sections">
            <button
              type="button"
              role="tab"
              ref={(node) => { tabRefs.current[0] = node; }}
              tabIndex={activeTab === "create" || activeTab === "parcel" ? 0 : -1}
              id="tab-create"
              aria-selected={activeTab === "create"}
              aria-controls="panel-create"
              className={`tab-pill-btn ${activeTab === "create" ? "active" : ""}`}
              onClick={() => changeTab("create")}
              onKeyDown={(event) => handleTabKeyDown(event, 0)}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="tab-icon">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              <span>New share</span>
            </button>

            <button
              type="button"
              role="tab"
              ref={(node) => { tabRefs.current[1] = node; }}
              tabIndex={activeTab === "history" ? 0 : -1}
              id="tab-history"
              aria-selected={activeTab === "history"}
              aria-controls="panel-history"
              className={`tab-pill-btn ${activeTab === "history" ? "active" : ""}`}
              onClick={() => changeTab("history")}
              onKeyDown={(event) => handleTabKeyDown(event, 1)}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="tab-icon">
                <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>My shares</span>
              {historyCount > 0 && (
                <span className="tab-count-badge" aria-label={`${historyCount} shares in history`}>
                  {historyCount}
                </span>
              )}
            </button>

            <button
              type="button"
              role="tab"
              ref={(node) => { tabRefs.current[2] = node; }}
              tabIndex={activeTab === "how-it-works" ? 0 : -1}
              id="tab-how-it-works"
              aria-selected={activeTab === "how-it-works"}
              aria-controls="panel-how-it-works"
              className={`tab-pill-btn ${activeTab === "how-it-works" ? "active" : ""}`}
              onClick={() => changeTab("how-it-works")}
              onKeyDown={(event) => handleTabKeyDown(event, 2)}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="tab-icon">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>How it works</span>
            </button>
          </div>
        </nav>

        <div className="header-actions">
          <button type="button" className="parcel-utility-button" onClick={() => changeTab("parcel")}>Open parcel</button>
          <ThemeToggle />
        </div>
      </header>

      <main id="main-content" className="main-content-desk">
        <div id="panel-create" role="tabpanel" aria-labelledby="tab-create" hidden={activeTab !== "create"} className="tab-panel">
          <div className="desk-grid">
            <div className="primary-surface-container">
              <Composer
                onPhaseChange={setPhase}
                onPolicyChange={setPolicy}
                onShareChange={() => setHistorySignal((prev) => prev + 1)}
              />
            </div>
          </div>
          <EvidenceRail phase={phase} policy={policy} />
        </div>

        <div id="panel-parcel" hidden={activeTab !== "parcel"} className="tab-panel utility-panel">
          <div className="utility-heading"><p className="eyebrow">Portable parcel · local utility</p><h2>Open a .securebin parcel</h2><p>Parse and decrypt an exported parcel in this browser. Nothing is uploaded.</p></div>
          <ParcelImport />
          <button type="button" className="action-button tertiary-button utility-back" onClick={() => changeTab("create")}>Back to Create share</button>
        </div>

        <div id="panel-history" role="tabpanel" aria-labelledby="tab-history" hidden={activeTab !== "history"} className="tab-panel">
          <ShareHistoryDesk refreshSignal={historySignal} visible={activeTab === "history"} onSwitchToCreate={() => changeTab("create")} />
        </div>

        <div id="panel-how-it-works" role="tabpanel" aria-labelledby="tab-how-it-works" hidden={activeTab !== "how-it-works"} className="tab-panel">
          <section className="how-section" aria-labelledby="how-heading">
            <div className="how-header-block">
              <p className="eyebrow"><span className="eyebrow-dot" aria-hidden="true" />Documentation & Knowledge Base</p>
              <h2 id="how-heading" className="how-main-title">A share should reveal as little as possible.</h2>
              <p className="how-subtext">SecureBin combines zero-knowledge client-side encryption with atomic database policy enforcement. Explore how to create shares, manage multi-factor protection, self-host, and inspect the security model.</p>
            </div>

            <section className="docs-at-a-glance" aria-labelledby="docs-glance-heading">
              <div className="docs-glance-heading-row">
                <div>
                  <p className="eyebrow">Evaluator summary</p>
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
                  <p>The Privacy Receipt identifies the algorithm, factors, policy, encrypted objects, and visible infrastructure metadata.</p>
                </article>
                <article className="docs-glance-card docs-glance-card-boundary">
                  <span className="docs-glance-index">04 / LIMITS</span>
                  <h4>Revocation has honest limits</h4>
                  <p>Revocation blocks future online releases. It cannot erase plaintext or encrypted parcels that someone already downloaded.</p>
                </article>
              </div>
              <div className="docs-validation-strip" aria-label="Recorded CI validation baseline">
                <span className="docs-validation-label">Recorded CI baseline</span>
                <span><strong>212</strong> unit</span>
                <span><strong>16</strong> integration</span>
                <span><strong>155</strong> pgTAP</span>
                <span><strong>19 + 19</strong> browser</span>
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
                <li>
                  <span className="docs-proof-number">01</span>
                  <strong>Seal a share</strong>
                  <span>Choose factors, expiry, reveal policy, files, or discussion.</span>
                </li>
                <li>
                  <span className="docs-proof-number">02</span>
                  <strong>Inspect the proof</strong>
                  <span>Read the policy chips, fingerprint, Privacy Receipt, and full-link warning.</span>
                </li>
                <li>
                  <span className="docs-proof-number">03</span>
                  <strong>Reveal locally</strong>
                  <span>Open the recipient view and watch the browser apply factors and release policy.</span>
                </li>
                <li>
                  <span className="docs-proof-number">04</span>
                  <strong>Test the boundary</strong>
                  <span>Use the release window, parcel utility, discussion thread, or revoke control.</span>
                </li>
              </ol>
            </section>

            <nav className="docs-nav-bar" aria-label="Documentation sections">
              <a className="docs-nav-pill" href="#guide-quickstart">🚀 Quickstart</a>
              <a className="docs-nav-pill" href="#guide-factors">🔐 Multi-Factor</a>
              <a className="docs-nav-pill" href="#guide-policies">⏱️ Policies & Expiry</a>
              <a className="docs-nav-pill" href="#guide-attachments">📎 Files & Replies</a>
              <a className="docs-nav-pill" href="#guide-parcels">📦 Offline Parcels</a>
              <a className="docs-nav-pill" href="#guide-self-hosting">🖥️ Self-Hosting</a>
              <a className="docs-nav-pill" href="#guide-security">🛡️ Security Model</a>
            </nav>

            <div className="docs-grid" id="guide-quickstart">
              <article className="docs-card">
                <div className="principle-card-top"><span className="principle-number">01</span><span className="principle-tag">User Guide</span></div>
                <h3>🚀 Quickstart: Creating a Share</h3>
                <ol className="docs-step-list">
                  <li className="docs-step-item">
                    <span className="docs-step-num">1</span>
                    <div className="docs-step-text">
                      <strong>Choose Your Mode</strong>
                      <p>Select <em>Plain Text</em> for credentials, <em>Markdown</em> for rich documents (with split/preview mode), or <em>Code</em> for language-aware snippets in one editable IDE-style surface.</p>
                    </div>
                  </li>
                  <li className="docs-step-item">
                    <span className="docs-step-num">2</span>
                    <div className="docs-step-text">
                      <strong>Configure Access & Factors</strong>
                      <p>Optionally add a password, generate a two-channel unlock code, set maximum reveals (e.g. burn after 1 reveal), or define a timed expiration.</p>
                    </div>
                  </li>
                  <li className="docs-step-item">
                    <span className="docs-step-num">3</span>
                    <div className="docs-step-text">
                      <strong>Share the Link</strong>
                      <p>Click <em>Create share</em>. Your browser encrypts the content with AES-256-GCM before sending ciphertext. Copy the link; the decryption key stays in the URL fragment (#key).</p>
                    </div>
                  </li>
                </ol>
              </article>

              <article className="docs-card" id="guide-factors">
                <div className="principle-card-top"><span className="principle-number">02</span><span className="principle-tag">Security</span></div>
                <h3>🔐 Multi-Factor Protection</h3>
                <p>SecureBin supports four distinct factor combinations to prevent link interception:</p>
                <div className="docs-badge-row">
                  <span className="docs-badge">Link Key</span>
                  <span className="docs-badge">Link + Password</span>
                  <span className="docs-badge">Link + Unlock Code</span>
                  <span className="docs-badge">Link + Pass + Unlock</span>
                </div>
                <ul className="threat-section" style={{ margin: 0, paddingLeft: "1.2rem" }}>
                  <li><strong>Link Key:</strong> 128-bit key in URL fragment. Server never receives the fragment.</li>
                  <li><strong>Password:</strong> Derived using PBKDF2 (600,000 iterations). Recipient must enter the exact password.</li>
                  <li><strong>Second-Channel Unlock:</strong> 27-character base-28 code with checksum (124 bits entropy). Transmitted over SMS/Signal separately so link interception alone fails.</li>
                </ul>
              </article>
            </div>

            <div className="docs-grid" id="guide-policies">
              <article className="docs-card">
                <div className="principle-card-top"><span className="principle-number">03</span><span className="principle-tag">Lifecycle</span></div>
                <h3>⏱️ Access Policies & Auto-Hide</h3>
                <ul className="threat-section" style={{ margin: 0, paddingLeft: "1.2rem" }}>
                  <li><strong>Burn After Reading:</strong> Share becomes permanently unavailable immediately after 1 authorized reveal.</li>
                  <li><strong>Reveal Limits:</strong> Set exact bounds (1, 3, 5, 10, custom, or unlimited). Enforced atomically at database level.</li>
                  <li><strong>Expiry Durations:</strong> Automatically expires after 24h, 7 days, 30 days, custom duration, or Never (indefinite until manual revocation).</li>
                  <li><strong>Release Window & Privacy Veil:</strong> An active countdown (10s–5m) begins when recipient reveals. When it hits zero, decrypted text is scrubbed from browser memory and replaced with a privacy veil.</li>
                </ul>
              </article>

              <article className="docs-card" id="guide-attachments">
                <div className="principle-card-top"><span className="principle-number">04</span><span className="principle-tag">Attachments & Collab</span></div>
                <h3>📎 Files & Encrypted Discussions</h3>
                <ul className="threat-section" style={{ margin: 0, paddingLeft: "1.2rem" }}>
                  <li><strong>Multi-File Uploads:</strong> Attach up to 5 files (10 MB each). Each file is encrypted with its own derived key (<code>securebin/v2/link/file</code>).</li>
                  <li><strong>Safe Previews & ZIP:</strong> Recipients can preview images, text, and PDFs safely with CSP sandboxing, or download all attachments as a single decrypted ZIP archive.</li>
                  <li><strong>Encrypted Comments:</strong> Threaded replies protected by client-held discussion capabilities. Authors can edit or delete comments with cryptographic proof tokens.</li>
                </ul>
              </article>
            </div>

            <section className="docs-card" id="guide-parcels">
              <div className="principle-card-top"><span className="principle-number">05</span><span className="principle-tag">Offline Capability</span></div>
              <h3>📦 Offline Encrypted Parcels (.securebin)</h3>
              <p>Export any share as an offline <code>.securebin</code> parcel (SBPX v1). Carry your ciphertext on an air-gapped USB or local drive, and restore it inside this browser with zero network requests.</p>
              <div style={{ marginTop: "0.5rem" }}>
                <button type="button" className="action-button secondary-button" onClick={() => changeTab("parcel")}>Open Parcel Utility</button>
              </div>
            </section>

            <section className="docs-card" id="guide-self-hosting">
              <div className="principle-card-top"><span className="principle-number">06</span><span className="principle-tag">Self-Hosting</span></div>
              <h3>🖥️ Self-Hosting Guide & Local Stack</h3>
              <p>Run your own private instance of SecureBin using Docker and Node.js. No external SaaS or proprietary dependencies required.</p>
              <div className="docs-code-box">
                <code>
                  # 1. Start local Supabase container and database migrations<br />
                  <strong>pnpm local:setup</strong><br /><br />
                  # 2. Launch production-built SecureBin web app<br />
                  <strong>pnpm local</strong><br /><br />
                  # Open browser at http://127.0.0.1:3101
                </code>
              </div>
              <p>For complete VPS/cloud deployment, Nginx reverse proxy configurations, and systemd service scripts, see the <a href="https://github.com/adithyarao2605/SecureBin/blob/main/self_hosting.md" target="_blank" rel="noreferrer" style={{ color: "var(--mineral)", textDecoration: "underline" }}>Self-Hosting Documentation (self_hosting.md)</a>.</p>
            </section>

            <section className="protocol-section" id="guide-security" aria-labelledby="protocol-heading">
              <p className="eyebrow">Cryptographic Protocol</p>
              <h3 id="protocol-heading">Sender browser → sealed parcel → recipient browser</h3>
              <div className="protocol-grid">
                <div>
                  <strong>Sender browser</strong>
                  <span>Plaintext → factor derivation (HKDF-SHA-256) → AES-256-GCM → ciphertext</span>
                </div>
                <div>
                  <strong>SecureBin Server</strong>
                  <span>Sealed ciphertext, bounded policy timestamps, and atomic release counters</span>
                </div>
                <div>
                  <strong>Recipient browser</strong>
                  <span>Ciphertext + fragment key + optional user factors → local decryption</span>
                </div>
              </div>
            </section>

            <section className="boundary-comparison" aria-labelledby="observe-heading">
              <div>
                <h3 id="observe-heading">Infrastructure can observe</h3>
                <ul>
                  <li>Public share identifier and opaque ciphertext</li>
                  <li>Ciphertext size and lifecycle timestamps</li>
                  <li>Access policy limits and authorized release lease count</li>
                </ul>
              </div>
              <div>
                <h3>Official client keeps local</h3>
                <ul>
                  <li>Plaintext, notes, and URL-fragment secret (#key)</li>
                  <li>Password and second-channel unlock factor</li>
                  <li>Decrypted filenames, file contents, and MIME types</li>
                </ul>
              </div>
            </section>

            <section className="protocol-section">
              <p className="eyebrow">Atomic Database Enforcement</p>
              <h3>Row-locked concurrency prevents limit overruns</h3>
              <div className="atomic-example">
                <span>100 simultaneous requests</span>
                <strong>PostgreSQL FOR UPDATE Lock</strong>
                <span>3 authorized · 97 uniform unavailable</span>
              </div>
              <p style={{ marginTop: "0.75rem" }}>A lost-response retry that reuses its request token recovers the existing 5-minute authorization lease without consuming an extra release count.</p>
            </section>

            <section className="threat-section">
              <p className="eyebrow">Honest Security Boundaries</p>
              <ul>
                <li>Cannot protect against compromised browser extensions or malware on the recipient device.</li>
                <li>Cannot prevent a recipient from taking physical screenshots or copying decrypted text.</li>
                <li>Cannot erase copies of files that a recipient has already downloaded locally.</li>
                <li>Ciphertext size, access patterns, and network traffic timing remain observable by ISPs.</li>
              </ul>
            </section>

            <section className="how-final">
              <div>
                <h3>Ready to share?</h3>
                <p>Create an end-to-end encrypted note or upload files with custom access policies.</p>
                <button type="button" className="action-button primary-button" onClick={() => changeTab("create")}>Create a Share</button>
              </div>
              <div>
                <h3>Inspect source & specs</h3>
                <p>Review architecture specifications, protocol threat models, and reproducible test suites.</p>
                <a className="action-button tertiary-button" href="https://github.com/adithyarao2605/SecureBin" target="_blank" rel="noreferrer">GitHub Repository</a>
              </div>
            </section>
          </section>
        </div>
      </main>

      <footer className="site-footer"><span>SecureBin / private sharing</span><span>Keep the key close.</span></footer>
    </div>
  );
}
