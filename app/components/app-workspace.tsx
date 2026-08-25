"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import dynamic from "next/dynamic";
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
const DocumentationPanel = dynamic(
  () => import("./documentation-panel").then((module) => module.DocumentationPanel),
  { loading: () => <div className="docs-loading" role="status">Loading documentation…</div> },
);
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
      <a className="skip-link" href="#main-content">Skip to content</a>
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
          <DocumentationPanel onOpenParcel={() => changeTab("parcel")} onCreateShare={() => changeTab("create")} />
        </div>

      </main>

      <footer className="site-footer"><span>SecureBin / private sharing</span><span>Keep the key close.</span></footer>
    </div>
  );
}
