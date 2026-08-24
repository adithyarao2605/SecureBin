"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorState({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Keep diagnostics capability-safe: the framework digest is intentionally
    // not rendered and the error object is never logged from this boundary.
    void error;
  }, [error]);

  return (
    <main className="route-state" aria-labelledby="error-title">
      <p className="eyebrow">Local workspace error</p>
      <h1 id="error-title">This view could not be prepared</h1>
      <p>Your secret, factors, and decrypted content are not included in this message.</p>
      <div className="route-state-actions">
        <button className="action-button primary-button" type="button" onClick={reset}>Try again</button>
        <Link className="action-button secondary-button" href="/">Return home</Link>
      </div>
    </main>
  );
}
