# Active Bugs & Known Issues

This document tracks all currently open bugs and visual/interaction issues that are not yet fixed.

---

### 1. Code Editor Text Typing Visibility
- **Issue:** While typing inside the Code Mode editor, newly typed text is invisible until clicking outside or waiting for the highlight layer to re-render.
- **Cause:** `.code-editor-input` has `color: transparent` (layered over `.code-editor-highlight`), causing characters to become invisible during active keyboard input if the highlight layer lags or has mismatched contrast tokens.
- **Files Affected:** [`app/styles/composer.css`](app/styles/composer.css), [`app/components/composer/editor-pane.tsx`](app/components/composer/editor-pane.tsx).

---

### 2. Self-Host Link Destination on Landing Page
- **Issue:** The "Self-Host" navigation links in the landing page header and footer point to an in-page anchor (`#self-hosting`) rather than navigating to the full self-hosting documentation.
- **Fix:** Update href to open [`docs/deployment.md#self-hosting`](docs/deployment.md).
- **Files Affected:** [`app/page.tsx`](app/page.tsx).

---

### 3. Code Editor vs. Plaintext Visual Distinction
- **Issue:** Code editor and Plaintext editor share nearly identical typography and container styling without clear syntax token coloring in dark/light mode.
- **Fix:** Refine code editor syntax token themes (keywords, strings, comments, numbers) with distinct high-contrast colors matching the Linen/Mineral palette.
- **Files Affected:** [`app/styles/composer.css`](app/styles/composer.css).
