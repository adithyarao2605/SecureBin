"use client";

import { useState } from "react";
import { Composer } from "./components/composer";
import { EvidenceRail } from "./components/evidence-rail";
import { ShareHistoryDesk } from "./components/share-history";
import { ThemeToggle } from "./components/theme-toggle";
import {
  defaultPolicyDraft,
  type ProoflinePhase,
  type ValidatedPolicy,
  validatePolicyDraft,
} from "../lib/shares/policy-ui";

export default function HomePage() {
  const [phase, setPhase] = useState<ProoflinePhase>("draft");
  const [historySignal, setHistorySignal] = useState(0);
  const [policy, setPolicy] = useState<ValidatedPolicy>(
    validatePolicyDraft(defaultPolicyDraft())
  );

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href="#main-content" aria-label="SecureBin home">
          <span className="brand-name">SecureBin</span>
          <span className="brand-status">private by design</span>
        </a>
        <nav className="header-actions" aria-label="Site navigation">
          <a className="quiet-link" href="#how-it-works">
            How it works
          </a>
          <ThemeToggle />
        </nav>
      </header>

      <main id="main-content" className="main-content-desk">
        <div className="desk-grid">
          <div className="primary-surface-container">
            <Composer
              onPhaseChange={setPhase}
              onPolicyChange={setPolicy}
              onShareCreated={() => setHistorySignal((prev) => prev + 1)}
            />
          </div>
          <div className="evidence-rail-container">
            <EvidenceRail phase={phase} policy={policy} />
          </div>
        </div>

        <ShareHistoryDesk refreshSignal={historySignal} />

        <section className="how-section" id="how-it-works" aria-labelledby="how-heading">
          <div>
            <p className="eyebrow">
              <span className="eyebrow-dot" aria-hidden="true" />
              The boundary matters
            </p>
            <h2 id="how-heading">A share should reveal as little as possible.</h2>
          </div>
          <div className="principles-grid">
            <article className="principle-card">
              <span className="principle-number" aria-hidden="true">
                A
              </span>
              <h3>Local first</h3>
              <p>Encryption and keys stay in the browser you control.</p>
            </article>
            <article className="principle-card">
              <span className="principle-number" aria-hidden="true">
                B
              </span>
              <h3>Explicit access</h3>
              <p>Expiry, reveal limits, and revocation are visible choices—not hidden defaults.</p>
            </article>
            <article className="principle-card">
              <span className="principle-number" aria-hidden="true">
                C
              </span>
              <h3>Plain language</h3>
              <p>What infrastructure can see and what it never receives is transparent.</p>
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
