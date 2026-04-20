# Covalent

Lightweight native Markdown viewer built with Tauri 2 (Rust + HTML/JS). Viewer only, not an editor.

## Tech Stack

- **Backend:** Rust / Tauri 2
- **Frontend:** Single `dist/index.html` — vanilla JS, no build step
- **Rendering:** marked.js (GFM), highlight.js (syntax), mermaid (diagrams), KaTeX (math)
- **All JS/CSS loaded from CDN** — no bundler

## Project Structure

```
dist/index.html            # Entire frontend (HTML + CSS + JS)
src-tauri/src/main.rs       # Entire backend
src-tauri/tauri.conf.json   # Tauri config, file associations, window setup
src-tauri/Cargo.toml        # Rust dependencies
package.json                # Tauri CLI + test script
tests/math-regex.test.mjs   # JS tests for math regex and path handling
.github/workflows/          # release.yml (macOS + Windows build), audit.yml
```

## Commands

```bash
npm install              # Install Tauri CLI
npx tauri dev            # Run in dev mode with hot reload
npx tauri build          # Build production .app/.dmg/.exe
npm test                 # Run all tests (JS + Rust)
```

## Testing

Red-green-refactor. Tests must pass before committing.

- **JS tests** (`tests/math-regex.test.mjs`): inline/block math regex matching, currency dollar sign rejection, Windows/Unix path splitting. Run with `node tests/math-regex.test.mjs`.
- **Rust tests** (`src-tauri/src/main.rs`): file reading, path escaping, window label incrementing. Run with `cd src-tauri && cargo test`.
- **Combined**: `npm test` runs both.

When adding features, write tests first when feasible. When fixing bugs, add a regression test.

## Key Architecture Details

- **Tauri commands** (Rust → JS): `read_file`, `get_opened_files`, `open_new_window`, `set_default_md_viewer`, `watch_file`
- **File watching** uses `notify` crate; emits `file-changed` event for live reload
- **macOS-specific:** `core-foundation` FFI for `LSSetDefaultRoleHandlerForContentType` (set default viewer), title bar overlay style
- **Multi-window:** Each window gets a unique label via `WINDOW_COUNTER`; initial file passed via `initialization_script`
- **Theme:** Persisted to `localStorage`, restored on launch; falls back to system preference

## Platform

macOS and Windows. Release CI builds both (`macos-latest` → `.dmg`, `windows-latest` → `.exe` via NSIS).
macOS-specific code (core-foundation FFI, title bar overlay, `set_default_md_viewer`, `RunEvent::Opened`, `handle_opened_files`) is gated behind `#[cfg(target_os = "macos")]`.

## Release

Push a `v*` tag to trigger release CI. The workflow:
1. Builds macOS (.dmg) and Windows (.exe) in parallel
2. Uploads artifacts to GitHub Release
3. Auto-updates the Homebrew tap (`yoaquim/homebrew-tap`) with new version + sha256

## Conventions

- Keep it minimal — avoid unnecessary abstraction.
- Frontend is a single HTML file with inline `<style>` and `<script>` — no components, no framework.
- All rendering libraries loaded via CDN, not npm.
