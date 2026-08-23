"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Local privacy veil (Day 6 §3): blurs the decrypted surface for
 * shoulder-surfing privacy. Purely client-side — re-showing never contacts
 * the server. Esc or losing window focus re-hides instantly. This is a
 * courtesy shield, not screenshot prevention.
 */
export function PrivacyVeil({ children }: { children: ReactNode }) {
  const [veiled, setVeiled] = useState(true);
  const toggleRef = useRef<HTMLButtonElement | null>(null);

  const hide = useCallback(() => setVeiled(true), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide();
    };
    const onBlur = () => hide();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", onBlur);
    };
  }, [hide]);

  function toggle() {
    setVeiled((current) => !current);
  }

  return (
    <div className="privacy-veil" data-veiled={veiled ? "true" : "false"}>
      <button
        type="button"
        ref={toggleRef}
        className="action-button secondary-button veil-toggle"
        aria-pressed={!veiled}
        onClick={toggle}
      >
        {veiled ? "Show decrypted content" : "Hide decrypted content"}
      </button>
      <p className="policy-hint veil-copy" role="note">
        Veiling is local to this screen only; it is not screenshot prevention.
        Esc or leaving this tab hides it again.
      </p>
      <div className="veil-content" aria-hidden={veiled}>
        {children}
      </div>
    </div>
  );
}
