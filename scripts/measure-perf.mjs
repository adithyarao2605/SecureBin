// One-shot performance probe used to record docs/evidence/perf-baseline.md.
// Usage: node scripts/measure-perf.mjs [baseUrl]   (default http://127.0.0.1:3100)
import { chromium } from "@playwright/test";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3100";

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  for (const path of ["/", "/new"]) {
    await page.goto(baseUrl + path, { waitUntil: "load" });
    await page.waitForTimeout(1500);
    const lcp = await page.evaluate(() => new Promise((resolve) => {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        resolve(last ? Math.round(last.startTime) : null);
      }).observe({ type: "largest-contentful-paint", buffered: true });
      setTimeout(() => resolve(null), 3000);
    }));
    console.log(JSON.stringify({ route: path, viewport: "390x844", lcpMs: lcp }));
  }

  // AES-GCM throughput in this browser (same primitive the crypto wrappers use).
  const throughput = await page.evaluate(async () => {
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
    const chunk = new Uint8Array(1 << 20);
    for (let offset = 0; offset < chunk.length; offset += 65536) {
      chunk.set(crypto.getRandomValues(new Uint8Array(65536)), offset);
    }
    let total = 0;
    const started = performance.now();
    while (performance.now() - started < 1000) {
      await crypto.subtle.encrypt({ name: "AES-GCM", iv: crypto.getRandomValues(new Uint8Array(12)) }, key, chunk);
      total += chunk.byteLength;
    }
    return Math.round(total / (1 << 20) / ((performance.now() - started) / 1000));
  });
  console.log(JSON.stringify({ probe: "aes-gcm-encrypt", throughputMiBs: throughput }));
} finally {
  await browser.close();
}
