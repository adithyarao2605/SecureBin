import Link from "next/link";

export default function NotFound() {
  return (
    <main className="route-state" aria-labelledby="not-found-title">
      <p className="eyebrow">Unavailable</p>
      <h1 id="not-found-title">That page is unavailable</h1>
      <p>The address may be incomplete or the page may no longer exist.</p>
      <Link className="action-button primary-button" href="/">Return home</Link>
    </main>
  );
}
