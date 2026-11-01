# OpenClaw Agent

An interactive installer and reference toolkit for AI agents that drive browsers, desktops and Android devices through DOM and accessibility trees instead of screenshots.

It sets up the tool servers an agent needs (browser automation, macOS AppleScript, Android through DroidRun, Windows PowerShell helpers), an optional local model runtime (Ollama) and the MCP configuration for Claude Desktop and Claude Code. Next to the installer sit small reference modules for context budgeting, task routing and JSON workflows, plus the system prompt and context rules that go with them. It is for developers wiring up their own agent who want a working starting point and a documented set of rules for keeping agent context small.

## What it does

- **Platform detection** (`src/detect-platform.js`): OS, architecture, Node, Python and pip, ADB and Ollama are probed in parallel.
- **Layered install** (`src/install-tools.js`): browser (an agent-browser CLI plus Playwright Chromium), macOS (AppleScript MCP), Android (DroidRun through pip) and Windows (built-in PowerShell). Tools that are already present are skipped, and pip and model pulls use argument arrays rather than shell strings.
- **Local models** (`src/install-ollama.js`): installs Ollama (Homebrew, the install script, or a download link) and pulls the models you pick. The shipped config names a 7B and a 3B Qwen model and a LLaVA vision model.
- **MCP configuration** (`src/configure-mcp.js`): merges server entries into the Claude Desktop config on macOS and Windows without overwriting existing ones, using an atomic write, and prints the `claude mcp add` commands for Claude Code.
- **Verify and reconfigure:** `--verify` runs the checks in parallel, `--configure` repeats the MCP step, and a run writes `openclaw.config.json` to the current directory.
- **ContextEngine** (`agent/context-engine.js`): token budgets per task complexity (2,000, 5,000 and 15,000 by default) with priority-based pruning of stored facts.
- **DecisionRouter** (`agent/decision-router.js`): maps a task description to an API, browser, macOS, Android, Windows or file layer by keyword patterns, with confidence scores, ranked alternatives and an LRU cache.
- **WorkflowRunner** (`agent/workflow-runner.js`): runs JSON workflows (`workflows/example-hacker-news.json`) with `{{variable}}` templates, parallel step groups, retry with backoff and per-step timing.
- **Prompts and guide:** `prompts/system-prompt.md`, context rules C1 to C7 in `prompts/context-rules.md`, and a 2,000-line reference guide in `docs/FULL-GUIDE.md`.

## How it's built

```
bin/cli.js (inquirer prompts)
   |-- src/detect-platform  -> OS, Node, Python, ADB, Ollama
   |-- src/install-tools    -> agent-browser, Playwright, AppleScript MCP, DroidRun
   |-- src/install-ollama   -> Ollama + models
   |-- src/configure-mcp    -> Claude Desktop config / Claude Code commands
   `-- src/configure-openclaw, src/verify

agent/ (reference code, independent of the installer)
   context-engine  <-  workflow-runner      decision-router
```

Node 18+, ES modules, `chalk`, `inquirer` and `ora` for the CLI. Tests run on vitest, lint on ESLint 9. The browser, AppleScript and DroidRun tools are third-party and are installed, not bundled.

## Repository layout

- `bin/`: the interactive CLI.
- `src/`: installer modules, each with input validation (`validate.js`).
- `agent/`: ContextEngine, DecisionRouter and WorkflowRunner.
- `config/`: MCP config templates for Claude Desktop (macOS, Windows), a Claude Code setup script and a sample `openclaw.config.json`.
- `prompts/`: system prompt and context rules to paste into an agent.
- `workflows/`: an example workflow.
- `docs/`: the full guide.
- `test/`: 48 test cases in four files.

## Run it locally

```bash
git clone https://github.com/0motionguy/openclaw-agent.git
cd openclaw-agent
npm install
npm run setup        # interactive installer
npm run verify       # check what is installed
npm run configure    # redo the MCP step
npm test             # vitest
npm run lint
```

Needs Node 18+. Linux without a display needs Xvfb for the browser layer.

## Status

Prototype. Last push 2026-02-13, three commits. Known issues:

- The browser layer and the config templates name `@anthropic-ai/agent-browser` and `@anthropic-ai/playwright-mcp`. Neither is published on npm; the registry has `agent-browser` and `@playwright/mcp`. Fix the names in `src/install-tools.js`, `src/configure-mcp.js` and `config/` before relying on that layer.
- The CLI passes `desktop` and `code` as the MCP target, while `src/configure-mcp.js` tests for `claude-desktop` and `claude-code`, so only the `both` choice currently writes anything.
- The `openclaw-agent` name on npm belongs to another project. Run from a clone, not with `npx`.

Licence: MIT, see `LICENSE`.
