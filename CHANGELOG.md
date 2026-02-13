# Changelog

## [1.1.0] - 2026-02-13

### Security
- Fix command injection in Ollama model pull (use execFileSync)
- Fix command injection in pip install (use execFileSync)
- Add atomic writes for MCP config files (TOCTOU fix)
- Add input validation on all exported functions
- Add fetch timeout for Ollama health checks

### Performance
- DecisionRouter: precompiled regex, LRU cache, confidence scoring
- ContextEngine: word-based token estimation, priority-based pruning
- WorkflowRunner: parallel step groups, retry with backoff, step timing
- Platform detection: parallel async (4x faster startup)
- Verification: parallel test execution (3x faster)
- Install tools: pre-flight checks skip already-installed packages

### Added
- GitHub Actions CI pipeline (Node 18/20/22 matrix)
- ESLint configuration
- Unit tests for agent modules (vitest)
- npm publish readiness (files field, repository, homepage)
- System prompt: cost-benefit table, state machine, budget escalation

## [1.0.0] - 2026-02-13

### Added
- Initial release
- Interactive CLI installer for MCP tools
- Platform detection (macOS, Windows, Linux)
- Ollama installation and model management
- Claude Desktop & Code MCP configuration
- Browser automation (agent-browser + Playwright)
- macOS automation (AppleScript MCP)
- Android automation (DroidRun)
- Windows automation (PowerShell)
- Agent reference implementation (ContextEngine, DecisionRouter, WorkflowRunner)
- Context engineering rules (C1-C7)
- Example workflows
