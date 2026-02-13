import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import ora from 'ora';

/**
 * Gets the Claude Desktop config path for the current platform
 * @param {object} platform - Platform detection object
 * @returns {string | null}
 */
function getClaudeDesktopConfigPath(platform) {
  if (platform.os === 'darwin') {
    return path.join(os.homedir(), 'Library/Application Support/Claude/claude_desktop_config.json');
  } else if (platform.os === 'win32') {
    const appData = process.env.APPDATA;
    if (!appData) return null;
    return path.join(appData, 'Claude/claude_desktop_config.json');
  }
  return null;
}

/**
 * Configures MCP servers for Claude Desktop and/or Claude Code
 * @param {object} platform - Platform detection object
 * @param {string} target - 'claude-desktop' | 'claude-code' | 'both'
 * @param {object} layers - Selected layers
 * @returns {Promise<object>} Configuration results
 */
export async function configureMcp(platform, target, layers) {
  const results = {
    desktop: { success: false, error: null, path: null },
    code: { success: false, error: null, commands: [] }
  };

  // Build MCP server entries based on selected layers
  const mcpServers = {};

  if (layers.browser) {
    mcpServers['agent-browser'] = {
      command: 'npx',
      args: ['-y', '@anthropic-ai/agent-browser']
    };
    mcpServers['playwright'] = {
      command: 'npx',
      args: ['-y', '@anthropic-ai/playwright-mcp']
    };
  }

  if (layers.macos && platform.os === 'darwin') {
    mcpServers['applescript'] = {
      command: 'npx',
      args: ['-y', '@peakmojo/applescript-mcp']
    };
  }

  // Configure Claude Desktop
  if (target === 'claude-desktop' || target === 'both') {
    await configureClaudeDesktop(platform, mcpServers, results);
  }

  // Configure Claude Code
  if (target === 'claude-code' || target === 'both') {
    configureClaudeCode(platform, mcpServers, results);
  }

  return results;
}

/**
 * Configures MCP servers for Claude Desktop
 * @param {object} platform - Platform detection object
 * @param {object} mcpServers - MCP server configurations
 * @param {object} results - Results object to update
 */
async function configureClaudeDesktop(platform, mcpServers, results) {
  const configPath = getClaudeDesktopConfigPath(platform);

  if (!configPath) {
    results.desktop.error = 'Could not determine Claude Desktop config path';
    console.log(chalk.red('✗ Could not determine Claude Desktop config path'));
    return;
  }

  results.desktop.path = configPath;
  const spinner = ora('Configuring Claude Desktop...').start();

  try {
    // Ensure directory exists
    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Read existing config or create new one
    let config = { mcpServers: {} };
    if (fs.existsSync(configPath)) {
      const existingConfig = fs.readFileSync(configPath, 'utf8');
      config = JSON.parse(existingConfig);
      if (!config.mcpServers) {
        config.mcpServers = {};
      }
    }

    // Merge new MCP servers (don't overwrite existing ones)
    let addedCount = 0;
    for (const [name, serverConfig] of Object.entries(mcpServers)) {
      if (!config.mcpServers[name]) {
        config.mcpServers[name] = serverConfig;
        addedCount++;
      } else {
        spinner.info(`MCP server '${name}' already configured - skipping`);
      }
    }

    // Write updated config
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');

    spinner.succeed(`Configured Claude Desktop (${addedCount} servers added)`);
    console.log(chalk.gray(`  Config: ${configPath}`));
    results.desktop.success = true;
  } catch (error) {
    spinner.fail('Failed to configure Claude Desktop');
    results.desktop.error = error.message;
    console.error(chalk.red(error.message));
  }
}

/**
 * Prints Claude Code MCP configuration commands
 * @param {object} platform - Platform detection object
 * @param {object} mcpServers - MCP server configurations
 * @param {object} results - Results object to update
 */
function configureClaudeCode(platform, mcpServers, results) {
  console.log(chalk.cyan('\n📋 Claude Code MCP Configuration Commands:'));
  console.log(chalk.gray('Run these commands to configure Claude Code:\n'));

  const commands = [];

  for (const [name, serverConfig] of Object.entries(mcpServers)) {
    // Skip macOS-only tools on other platforms
    if (name === 'applescript' && platform.os !== 'darwin') {
      continue;
    }

    const command = `claude mcp add ${name} -- ${serverConfig.command} ${serverConfig.args.join(' ')}`;
    commands.push(command);
    console.log(chalk.green(`  ${command}`));
  }

  results.code.commands = commands;
  results.code.success = true;
  console.log('');
}
