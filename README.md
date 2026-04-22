<p align="center">
  <img src="app-icon.png?v=2" width="128" height="128" alt="Covalent icon">
</p>

<h1 align="center">Covalent</h1>

<p align="center">A native Markdown viewer for macOS and Windows. Renders <code>.md</code> files with full support for GitHub-flavored Markdown, math equations, diagrams, and syntax highlighting. No editing, no workspace — just open a file and read.</p>

## Features

- GitHub-flavored Markdown rendering
- Math equation support (KaTeX) — inline `$...$` and block `$$...$$`
- Mermaid diagram support (flowcharts, sequence diagrams, etc.)
- Syntax-highlighted code blocks
- Live reload — auto-refreshes when the file changes on disk
- Light / dark mode
- Multi-window support (`Cmd+N` / `Ctrl+N`)
- Drag-and-drop file opening
- Print / export to PDF (`Cmd+P` / `Ctrl+P`)
- Find in document (`Cmd+F` / `Ctrl+F` or `/`) with live highlighting
- Zoom in/out (`Cmd/Ctrl +`/`-`/`0`)
- Vim-style navigation (`j`/`k`, `d`/`e`, `g`/`G`, `h`/`l`)
- Keyboard shortcuts help (`?`)
- File association — set as default viewer for `.md` files
- Native app built with Tauri (~5MB)

## Install

### macOS

**Homebrew:**

```
brew install --cask yoaquim/tap/covalent
```

**Manual:** Download the `.dmg` from [Releases](https://github.com/yoaquim/covalent/releases), open it, and drag to Applications.

After installing (either method), remove the quarantine flag:

```
xattr -cr /Applications/Covalent.app
```

> The app isn't code-signed with an Apple Developer certificate, so macOS flags it. This is a one-time step.

### Windows

Download the `.exe` installer from [Releases](https://github.com/yoaquim/covalent/releases) and run it.

## Build from source

```
npm install
npx tauri build
```

Requires [Rust](https://rustup.rs) and Node.js.
