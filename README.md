# Covalent

A lightweight Markdown viewer for macOS. Not an editor — just renders `.md` files exactly how they should look.

## Features

- GitHub-flavored Markdown rendering
- Mermaid diagram support (flowcharts, sequence diagrams, etc.)
- Syntax-highlighted code blocks
- Light / dark mode
- Drag-and-drop file opening
- Native macOS `.app` (~5MB)
- File association — set as default viewer for `.md` files

## Install

### Homebrew

```
brew install --cask yoaquim/tap/covalent
```

### Manual

Download the `.dmg` from [Releases](https://github.com/yoaquim/covalent/releases), open it, and drag to Applications.

> First launch: macOS may warn about an unidentified developer. Right-click the app > Open to bypass.

## Build from source

```
npm install
npx tauri build
```

Requires [Rust](https://rustup.rs) and Node.js.
