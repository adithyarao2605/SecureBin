"use client";

import { useEffect, useState } from "react";
import { Composer } from "./composer";
import { ParcelImport } from "./parcel-import";
import { EvidenceRail } from "./evidence-rail";
import { ShareHistoryDesk } from "./share-history";
import { ThemeToggle } from "./theme-toggle";
import {
  defaultPolicyDraft,
  type ProoflinePhase,
  type ValidatedPolicy,
  validatePolicyDraft,
} from "../../lib/shares/policy-ui";
import { loadShareHistory } from "../../lib/shares/share-history";

type AppTab = "create" | "history" | "how-it-works";

function tabFromHash(hash: string): AppTab {
  if (hash === "#history") return "history";
  if (hash === "#how-it-works") return "how-it-works";
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

  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="brand-group">
          <button
            type="button"
            className="brand brand-btn"
            onClick={() => changeTab("create")}
            aria-label="SecureBin home - New share"
          >
            <span className="brand-name">SecureBin</span>
            <span className="brand-status">private by design</span>
          </button>
        </div>

        <nav className="header-tabs-nav" aria-label="Main application tabs">
          <div className="tab-pill-group" role="tablist" aria-label="Primary sections">
            <button
              type="button"
              role="tab"
              id="tab-create"
              aria-selected={activeTab === "create"}
              aria-controls="panel-create"
              className={`tab-pill-btn ${activeTab === "create" ? "active" : ""}`}
              onClick={() => changeTab("create")}
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
              id="tab-history"
              aria-selected={activeTab === "history"}
              aria-controls="panel-history"
              className={`tab-pill-btn ${activeTab === "history" ? "active" : ""}`}
              onClick={() => changeTab("history")}
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
              id="tab-how-it-works"
              aria-selected={activeTab === "how-it-works"}
              aria-controls="panel-how-it-works"
              className={`tab-pill-btn ${activeTab === "how-it-works" ? "active" : ""}`}
              onClick={() => changeTab("how-it-works")}
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
              <ParcelImport />
            </div>
            <div className="evidence-rail-container">
              <EvidenceRail phase={phase} policy={policy} />
            </div>
          </div>
        </div>

        <div id="panel-history" role="tabpanel" aria-labelledby="tab-history" hidden={activeTab !== "history"} className="tab-panel">
          <ShareHistoryDesk refreshSignal={historySignal} visible={activeTab === "history"} onSwitchToCreate={() => changeTab("create")} />
        </div>

        <div id="panel-how-it-works" role="tabpanel" aria-labelledby="tab-how-it-works" hidden={activeTab !== "how-it-works"} className="tab-panel">
          <section className="how-section" aria-labelledby="how-heading">
            <div className="how-header-block">
              <p className="eyebrow"><span className="eyebrow-dot" aria-hidden="true" />The boundary matters</p>
              <h2 id="how-heading" className="how-main-title">a share should reveal as little as possible.</h2>
              <p className="how-subtext">SecureBin separates client encryption from server authorization. Here is what infrastructure can see and what never leaves your device.</p>
            </div>
            <div className="principles-grid">
              <article className="principle-card"><div className="principle-card-top"><span className="principle-number" aria-hidden="true">01</span><span className="principle-tag">Client Boundary</span></div><h3>Local first</h3><p>Encryption, key derivation, and decryption execute inside your browser using Web Crypto. Keys remain in the URL fragment and are never sent to the server.</p></article>
              <article className="principle-card"><div className="principle-card-top"><span className="principle-number" aria-hidden="true">02</span><span className="principle-tag">Enforcement</span></div><h3>Explicit access policy</h3><p>Availability schedules, reveal limits, expiration, and revocation are enforced atomically at the database row level, not as client-side suggestions.</p></article>
              <article className="principle-card"><div className="principle-card-top"><span className="principle-number" aria-hidden="true">03</span><span className="principle-tag">Transparency</span></div><h3>Plain language</h3><p>The server stores only a sealed ciphertext parcel and bounded metadata. Expired, missing, or revoked shares fail with a uniform unavailable state.</p></article>
            </div>
          </section>
        </div>
      </main>

      <footer className="site-footer"><span>SecureBin / private sharing</span><span>Keep the key close.</span></footer>
    </div>
  );
}
