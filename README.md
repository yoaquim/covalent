<p align="center">
  <img src="app-icon.png" width="128" height="128" alt="Covalent icon">
</p>

<h1 align="center">Covalent</h1>

<p align="center">A lightweight Markdown viewer for macOS.<br>Not an editor — just renders <code>.md</code> files exactly how they should look.</p>

## Features

- GitHub-flavored Markdown rendering
- Mermaid diagram support (flowcharts, sequence diagrams, etc.)
- Syntax-highlighted code blocks
- Live reload — auto-refreshes when the file changes on disk
- Light / dark mode
- Multi-window support (`Cmd+N`)
- Drag-and-drop file opening
- File association — set as default viewer for `.md` files on first launch
- Native macOS `.app` (~5MB, built with Tauri)

## Install

### Homebrew

```
brew install --cask yoaquim/tap/covalent
```

### Manual

Download the `.dmg` from [Releases](https://github.com/yoaquim/covalent/releases), open it, and drag to Applications.

After installing (either method), remove the quarantine flag:

```
xattr -cr /Applications/Covalent.app
```

> The app isn't code-signed with an Apple Developer certificate, so macOS flags it. This is a one-time step.

## Build from source

```
npm install
npx tauri build
```

Requires [Rust](https://rustup.rs) and Node.js.
