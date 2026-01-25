# AI Floating Assistant 🚀

**Current Version:** 1.0.4

[![Download Now](https://img.shields.io/badge/Download-v1.0.4-blue?style=for-the-badge&logo=windows)](https://github.com/ankit3890/AI-Floating-Assistant/releases/download/v1.0.4/AI-Floating-Assistant-Setup-1.0.4.exe)

**AI Floating Assistant** is a powerful, glassmorphic desktop workspace that stays pinned above all your applications. It brings multiple AI models and productivity tools directly to your fingertips, eliminating tab-switching and fragmented workflows.

## What's New in v1.0.4

- **UI & Navigation Fixes**: Resolved the black screen issue when switching from Compare Mode.
- **Improved Reliability**: Fixed "Context Send" state cleanup for more consistent behavior.
- **Performance**: Optimized webview persistence for snappier AI switching.

## 📥 [Download Latest Version](https://github.com/ankit3890/AI-Floating-Assistant/releases/latest)

> [!TIP] > **Windows Users**: Since the app is in early development and not yet digitally signed, you may see a "Windows protected your PC" alert. Click **More info** -> **Run anyway** to install.

---

- ## Key Features

### Multi-Model Sidebar

Access the world's best AIs in one side-pane:

- **ChatGPT**, **Gemini**, **Claude**, **Gamma**, and more.
- Add your own custom AI URLs easily.
- Switch models instantly with `Ctrl + 1-9`.

### Context Send (Auto-Copy)

The fastest way to prompt. Highlight any text in any app (Word, Browser, PDF) and press `Ctrl + Shift + C`. The app will automatically copy the text and paste it into your active AI assistant.

### Compare Mode

Need a second opinion? Side-by-side comparison allows you to prompt multiple AIs simultaneously and compare their results in a split-grid view.

## Screen Drawing Tool

A full-screen overlay that lets you draw, highlight, and annotate directly on your screen.

- **Toggle Overlay**: `Ctrl + Shift + H` (or click "Monitor" icon in Planning Board)
- **Tools**:
  - **Pen (P)**: Freehand drawing. Click arrow for Color/Size.
  - **Highlighter (H)**: Transparent marker. Click arrow for Color/Size.
  - **Eraser (E)**: Erase strokes.
  - **Lasso Select (L)**: Select and move strokes.
- **Actions**: `Ctrl+Z` (Undo), `Ctrl+Y` (Redo), `Esc` (Exit)

### Incognito

- **Incognito**: Clear sessions and maintain privacy with one click.

---

## Push Updates

Features a built-in **automated update system**.

- **Notification**: You'll receive a non-blocking banner whenever a new version is released.
- **One-Click Install**: Download and apply updates directly within the app.
- **Transparency**: Every update includes a security warning for unsigned builds, ensuring you always know what's happening.

stable version : 1.0.4

## Global Shortcuts

| Shortcut           | Action                            |
| :----------------- | :-------------------------------- |
| `Ctrl + Shift + A` | Toggle Window Visibility          |
| `Ctrl + Shift + C` | Context Send (Copy + Paste to AI) |
| `Ctrl + 1-9`       | Switch between AI Models          |
| `Ctrl + Shift + H` | Toggle Screen Drawing Overlay     |

---

## Tech Stack

- **Engine**: Electron
- **Frontend**: Vanilla JS, CSS3 (Glassmorphism)
- **Updates**: electron-updater + GitHub Releases
- **Backend Helpers**: PowerShell (for window pinning and hotkeys)

---

## 🤝 Support

For support or feedback, please visit the [GitHub Issues](https://github.com/ankit3890/AI-Floating-Assistant/issues) page.

---

_Made with ❤️ by Ankit_
