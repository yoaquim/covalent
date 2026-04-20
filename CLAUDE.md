# Covalent

Lightweight native Markdown viewer built with Tauri 2 (Rust + HTML/JS). Viewer only, not an editor.

## Tech Stack

- **Backend:** Rust / Tauri 2
- **Frontend:** Single `dist/index.html` — vanilla JS, no build step
- **Rendering:** marked.js (GFM), highlight.js (syntax), mermaid (diagrams), KaTeX (math)
- **All JS/CSS loaded from CDN** — no bundler

## Project Structure

```
dist/index.html          # Entire frontend (HTML + CSS + JS, ~520 lines)
src-tauri/src/main.rs    # Entire backend (~180 lines)
src-tauri/tauri.conf.json # Tauri config, file associations, window setup
src-tauri/Cargo.toml     # Rust dependencies
package.json             # Just Tauri CLI dev dependency
.github/workflows/       # release.yml (macOS build), audit.yml
```

## Commands

```bash
npm install              # Install Tauri CLI
npx tauri dev            # Run in dev mode with hot reload
npx tauri build          # Build production .app/.dmg
```

## Key Architecture Details

- **Tauri commands** (Rust → JS): `read_file`, `get_opened_files`, `open_new_window`, `set_default_md_viewer`, `watch_file`
- **File watching** uses `notify` crate; emits `file-changed` event for live reload
- **macOS-specific:** `core-foundation` FFI for `LSSetDefaultRoleHandlerForContentType` (set default viewer), title bar overlay style
- **Cross-platform prep:** `main.rs` already has `#[cfg(not(target_os = "macos"))]` for CLI arg handling
- **Multi-window:** Each window gets a unique label via `WINDOW_COUNTER`; initial file passed via `initialization_script`

## Platform

macOS and Windows. Release CI builds both (`macos-latest` → `.dmg`, `windows-latest` → `.exe` via NSIS).
macOS-specific code (core-foundation FFI, title bar overlay, `set_default_md_viewer`, `RunEvent::Opened`, `handle_opened_files`) is gated behind `#[cfg(target_os = "macos")]`.

## Conventions

- Keep it minimal — this is a ~700-line app total. Avoid unnecessary abstraction.
- Frontend is a single HTML file with inline `<style>` and `<script>` — no components, no framework.
- All rendering libraries loaded via CDN, not npm.
