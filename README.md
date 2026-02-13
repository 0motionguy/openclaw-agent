# OpenClaw Agent

Universal AI agent automation installer. Sets up browser, desktop, and Android control using DOM & accessibility trees — not screenshots.

```
npx openclaw-agent
```

## What It Does

- **Installs MCP tool servers** that any AI agent (Claude, OpenClaw, ChatGPT, etc.) can use
- **Configures Ollama** for free, private, local AI models
- **Sets up Claude Desktop/Code** MCP configuration automatically

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Your AI Agent Brain                    │
│         Claude / OpenClaw / GPT / Ollama (local)         │
└────────┬────────────┬──────────────┬──────────┬─────────┘
         │            │              │          │
    MCP/stdio    MCP/stdio      MCP/stdio   Python API
         │            │              │          │
  ┌──────▼──────┐ ┌───▼────────┐ ┌──▼────────┐ ┌▼──────────┐
  │   agent-    │ │ Playwright │ │ AppleScript│ │  DroidRun │
  │   browser   │ │    MCP     │ │    MCP     │ │  + Portal │
  └──────┬──────┘ └───┬────────┘ └──┬────────┘ └┬──────────┘
         │            │              │           │
    Chromium      Chromium       macOS apps   Android
    via CDP       via Playw.     via AS       via ADB
```

## Platform Support

| Capability | macOS | Windows | Linux | Android |
|-----------|-------|---------|-------|---------|
| Browse websites | Yes | Yes | Yes | Yes |
| Fill web forms | Yes | Yes | Yes | Yes |
| Control native apps | Yes (AppleScript) | Partial (PowerShell) | No | Yes (DroidRun) |
| Local AI (Ollama) | Yes | Yes | Yes | Via network |

## Quick Start

```bash
# Interactive installer — detects your OS, asks what to install
npx openclaw-agent

# Just verify existing setup
npx openclaw-agent --verify

# Just configure MCP
npx openclaw-agent --configure
```

## What Gets Installed

| Tool | Purpose | Size |
|------|---------|------|
| agent-browser | Primary browser automation via DOM refs | ~50MB |
| Playwright + Chromium | Fallback browser automation | ~200MB |
| AppleScript MCP | macOS native app control | ~5MB |
| DroidRun | Android device automation | ~50MB |
| Ollama + qwen2.5:7b | Local AI model (free, private) | ~4.5GB |

## Cost

**$0** with Ollama local models. No API keys needed for basic automation.

Optional cloud fallback (Claude, GPT) for complex tasks — uses your own API keys.

## How It Works

Instead of taking screenshots and guessing pixel coordinates (slow, expensive, ~60% accuracy), OpenClaw reads the DOM/accessibility tree:

```
SCREENSHOT (Bad):  Image → Vision model → "Button at x:342 y:187" → Miss
DOM/A11Y (Good):   Snapshot → @e1 "Login" @e2 "Search" → click @e1 → 100% hit
```

This is the same approach used by Claude in Chrome, ChatGPT Atlas, and Perplexity Comet.

## Project Structure

```
openclaw-agent/
├── bin/cli.js              # Interactive installer
├── src/                    # Installer modules
├── agent/                  # Reference implementation (context engine, router, workflows)
├── config/                 # MCP config templates
├── prompts/                # Agent system prompts (paste into your agent)
├── workflows/              # Example workflow JSON files
└── docs/FULL-GUIDE.md      # Complete reference guide
```

## Documentation

- [Full Guide](docs/FULL-GUIDE.md) — Complete reference with all layers, rules, and configuration
- [System Prompt](prompts/system-prompt.md) — Agent behavior rules (paste into your agent)
- [Context Rules](prompts/context-rules.md) — Context engineering rules (prevents context explosion)

## License

MIT
