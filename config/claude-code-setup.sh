#!/bin/bash
# OpenClaw Agent — Claude Code MCP Setup
# Run this script to add MCP servers to Claude Code

echo "Adding OpenClaw MCP servers to Claude Code..."

# Browser automation (all platforms)
claude mcp add agent-browser -- npx -y @anthropic-ai/agent-browser mcp
claude mcp add playwright -- npx -y @anthropic-ai/playwright-mcp

# macOS desktop control (macOS only)
if [[ "$OSTYPE" == "darwin"* ]]; then
  claude mcp add applescript -- npx -y @peakmojo/applescript-mcp
  echo "Added: agent-browser, playwright, applescript"
else
  echo "Added: agent-browser, playwright"
  echo "Note: AppleScript MCP is macOS only — skipped on this platform"
fi

echo ""
echo "Verify with: claude mcp list"
