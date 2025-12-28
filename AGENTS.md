# Repository Guidelines

## Core Mandates

**CRITICAL: You must adhere to these rules in all interactions.**

1.  **Language**:
    *   **Think in English.**
    *   **Interact with the user in Japanese.**
    *   Plans and artifacts (commit messages, PR descriptions) must be written in **Japanese**.

## Project Structure & Assets
- Current files live at the repository root: `README.md` (requirements/design), `TODO.md` (implementation checklist), `LICENSE`, and `data/hyakunin_isshu_with_ruby.csv` (authoritative poem dataset).
- Planned app layout (per README/TODO) is a static site: `index.html`, `css/style.css`, `js/app.js`, and `data/` for CSV. Keep static assets self-contained; no server-side code is expected.
- Treat the CSV as read-only source data. If you regenerate it, document the script and keep headers identical.

## Local Development & Run
- No build step yet. Work directly with HTML/CSS/vanilla JS.
- Quick local preview: `python -m http.server 8000` from repo root and open `http://localhost:8000`. Any static server works; avoid file:// to keep relative paths consistent.
- Keep external dependencies CDN-based (Bootstrap 5.3, PapaParse). If you add tooling (npm), document commands in README and lock versions.

## Coding Style & Naming
- Use semantic HTML and Bootstrap utility classes where helpful; prefer BEM-like class names for custom styles.
- Indentation: 2 spaces for HTML/JS/CSS. Use ES6+ features, const/let, and early returns to keep handlers small.
- Keep functions pure where possible; isolate DOM manipulation from data logic. Name state keys in lowerCamelCase to match the structures outlined in README.
- For colors, reuse the five theme variables defined in README; centralize custom tokens in `:root` within `css/style.css`.

## Testing Guidelines
- Primary validation is manual. Cover the flows listed in `TODO.md` (CSV load, color selection, no duplicate questions, progress UI, result screen) on mobile, tablet, and desktop breakpoints.
- If you add JS, create lightweight console-friendly helpers (e.g., `window.debugState()`) and remove them before merging.
- Consider smoke tests via Playwright only if you introduce a toolchain; otherwise keep the stack dependency-free.

## Commit & Pull Request Practices
- Use concise, present-tense commit messages; prefer prefixes like `feat:`, `fix:`, `style:`, `docs:`, `chore:` to mirror the TODO sections.
- In PRs, include: purpose, key changes, how to verify (commands or manual steps), and screenshots/GIFs for UI updates. Link related TODO items and issues.
- Keep diffs focused: data changes separate from code; formatting-only commits should be isolated.

## Data & Accessibility Notes
- Preserve kana/kanji fidelity in the CSV. When displaying readings, respect line breaks and avoid truncation on small screens.
- Honor the accessibility targets from README: minimum 16px fonts, color contrast, and 44x44px tap targets. Test with keyboard navigation for answer selection.

## Versioning
- When user-facing behavior or UI changes, bump the visible version badge in both `index.html` and `js/app.js` (`APP_VERSION`). Document the new version in the change summary. ***
