export default function Loading() {
  return (
    <main className="route-state" aria-busy="true" aria-labelledby="loading-title">
      <p className="eyebrow">SecureBin</p>
      <h1 id="loading-title">Preparing the local workspace</h1>
      <p>The browser tools are loading. No plaintext has left this page.</p>
      <div className="route-state-skeleton" aria-hidden="true"><span /><span /><span /></div>
    </main>
  );
}
