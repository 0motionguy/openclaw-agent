#!/usr/bin/env node

import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { detectPlatform } from '../src/detect-platform.js';
import { installOllama, pullModels } from '../src/install-ollama.js';

// Parse CLI flags
const args = process.argv.slice(2);
const verifyMode = args.includes('--verify');
const configureMode = args.includes('--configure');

/**
 * Print the OpenClaw ASCII banner
 */
function printBanner() {
  console.log(chalk.cyan(`
  ██████╗ ██████╗ ███████╗███╗   ██╗ ██████╗██╗      █████╗ ██╗    ██╗
 ██╔═══██╗██╔══██╗██╔════╝████╗  ██║██╔════╝██║     ██╔══██╗██║    ██║
 ██║   ██║██████╔╝█████╗  ██╔██╗ ██║██║     ██║     ███████║██║ █╗ ██║
 ██║   ██║██╔═══╝ ██╔══╝  ██║╚██╗██║██║     ██║     ██╔══██║██║███╗██║
 ╚██████╔╝██║     ███████╗██║ ╚████║╚██████╗███████╗██║  ██║╚███╔███╔╝
  ╚═════╝ ╚═╝     ╚══════╝╚═╝  ╚═══╝ ╚═════╝╚══════╝╚═╝  ╚═╝ ╚═══╝

 ${chalk.bold('Universal Agent Automation Installer v1.0.0')}
 ${chalk.dim('DOM & accessibility trees — not screenshots')}
`));
}

/**
 * Print detected platform information
 */
function printPlatformInfo(platform) {
  console.log(chalk.bold('\nDetected Platform:'));
  console.log(`  OS:           ${chalk.green(platform.os)} (${platform.arch})`);
  console.log(`  Node:         ${chalk.green(platform.nodeVersion)}`);
  console.log(`  Ollama:       ${platform.hasOllama ? chalk.green('Installed ✓') : chalk.yellow('Not installed')}`);
  if (platform.hasOllama) {
    console.log(`  Python:       ${platform.hasPython ? chalk.green(platform.pythonVersion || 'Yes') : chalk.dim('Not found')}`);
  }
  console.log('');
}

/**
 * Build layer choices based on platform
 */
function buildLayerChoices(platform) {
  const choices = [
    {
      name: 'Browser automation (agent-browser + Playwright)',
      value: 'browser',
      checked: true
    }
  ];

  if (platform.os === 'darwin') {
    choices.push({
      name: 'macOS desktop control (AppleScript MCP)',
      value: 'macos',
      checked: true
    });
  }

  choices.push({
    name: 'Android device control (DroidRun) — requires USB-connected device with USB debugging',
    value: 'android',
    checked: false
  });

  if (platform.os === 'win32') {
    choices.push({
      name: 'Windows desktop control (PowerShell helpers)',
      value: 'windows',
      checked: false
    });
  }

  return choices;
}

/**
 * Build Ollama model choices
 */
function buildModelChoices() {
  return [
    {
      name: 'qwen2.5:7b — Primary text model, 4.5GB (Recommended)',
      value: 'qwen2.5:7b',
      checked: true
    },
    {
      name: 'qwen2.5:3b — Lightweight text model, 2GB',
      value: 'qwen2.5:3b',
      checked: false
    },
    {
      name: 'llava:7b — Vision fallback model, 4.5GB',
      value: 'llava:7b',
      checked: false
    },
    {
      name: 'qwen2.5vl — Android vision model, 4.5GB',
      value: 'qwen2.5vl',
      checked: false
    }
  ];
}

/**
 * Convert layers array to object format expected by src/ modules
 * e.g. ['browser', 'android'] → { browser: true, macos: false, android: true, windows: false }
 */
function layersToObject(layersArray) {
  return {
    browser: layersArray.includes('browser'),
    macos: layersArray.includes('macos'),
    android: layersArray.includes('android'),
    windows: layersArray.includes('windows'),
  };
}

/**
 * Run interactive installer flow
 */
async function runFullInstall(platform) {
  const answers = {};

  // Step 1: Select automation layers
  const layerChoices = buildLayerChoices(platform);
  const { layers } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'layers',
      message: 'Which automation layers do you want to install?',
      choices: layerChoices,
      validate: (input) => {
        if (input.length === 0) {
          return 'Please select at least one automation layer';
        }
        return true;
      }
    }
  ]);
  answers.layers = layers;

  // Step 2: Ollama installation
  if (platform.hasOllama) {
    console.log(chalk.green('\n✓ Ollama already installed, skipping installation'));
    answers.installOllama = false;
    answers.models = [];
  } else {
    const { installOllama } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'installOllama',
        message: 'Install Ollama for local AI models?',
        default: true
      }
    ]);
    answers.installOllama = installOllama;

    // Step 3: Select Ollama models (if installing)
    if (installOllama) {
      const { models } = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'models',
          message: 'Which Ollama models to pull?',
          choices: buildModelChoices(),
          validate: (input) => {
            if (input.length === 0) {
              return 'Please select at least one model';
            }
            return true;
          }
        }
      ]);
      answers.models = models;
    } else {
      answers.models = [];
    }
  }

  // Step 4: MCP configuration target
  const { mcpTarget } = await inquirer.prompt([
    {
      type: 'list',
      name: 'mcpTarget',
      message: 'Configure MCP for:',
      choices: [
        { name: 'Claude Desktop (recommended)', value: 'desktop' },
        { name: 'Claude Code', value: 'code' },
        { name: 'Both', value: 'both' },
        { name: 'Skip configuration', value: 'skip' }
      ],
      default: 'desktop'
    }
  ]);
  answers.mcpTarget = mcpTarget;

  // Step 5: Print summary and confirm
  console.log(chalk.bold('\n\nInstallation Summary:'));
  console.log(chalk.dim('─'.repeat(50)));
  console.log(`  Automation layers: ${chalk.cyan(answers.layers.join(', '))}`);
  console.log(`  Ollama:            ${answers.installOllama ? chalk.green('Install') : chalk.dim('Skip')}`);
  if (answers.models.length > 0) {
    console.log(`  Models:            ${chalk.cyan(answers.models.join(', '))}`);
  }
  console.log(`  MCP Target:        ${answers.mcpTarget === 'skip' ? chalk.dim('Skip') : chalk.cyan(answers.mcpTarget)}`);
  console.log(chalk.dim('─'.repeat(50)));

  const { proceed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'proceed',
      message: 'Proceed with installation?',
      default: true
    }
  ]);

  if (!proceed) {
    console.log(chalk.yellow('\nInstallation cancelled'));
    process.exit(0);
  }

  return answers;
}

/**
 * Execute installation steps
 */
async function executeInstall(platform, config) {
  const failures = [];
  const successes = [];
  const layersObj = layersToObject(config.layers);

  console.log(chalk.bold('\n\nStarting installation...\n'));

  // Step 1: Install Ollama
  if (config.installOllama) {
    const spinner = ora('Installing Ollama...').start();
    try {
      await installOllama(platform);
      spinner.succeed('Ollama installed');
      successes.push('Ollama');
    } catch (error) {
      spinner.fail(`Ollama installation failed: ${error.message}`);
      failures.push({ step: 'Ollama', error: error.message });
    }
  }

  // Step 2: Pull Ollama models
  if (config.models.length > 0) {
    for (const model of config.models) {
      const spinner = ora(`Pulling ${model}...`).start();
      try {
        await pullModels([model]);
        spinner.succeed(`${model} pulled`);
        successes.push(model);
      } catch (error) {
        spinner.fail(`Failed to pull ${model}: ${error.message}`);
        failures.push({ step: model, error: error.message });
      }
    }
  }

  // Step 3: Install automation tools
  const spinner = ora('Installing automation tools...').start();
  try {
    // Import and call installTools dynamically
    const { installTools } = await import('../src/install-tools.js');
    await installTools(platform, layersObj);
    spinner.succeed('Automation tools installed');
    successes.push('Automation tools');
  } catch (error) {
    spinner.fail(`Tool installation failed: ${error.message}`);
    failures.push({ step: 'Automation tools', error: error.message });
  }

  // Step 4: Configure MCP
  if (config.mcpTarget !== 'skip') {
    const spinner = ora('Configuring MCP...').start();
    try {
      const { configureMcp } = await import('../src/configure-mcp.js');
      await configureMcp(platform, config.mcpTarget, layersObj);
      spinner.succeed('MCP configured');
      successes.push('MCP configuration');
    } catch (error) {
      spinner.fail(`MCP configuration failed: ${error.message}`);
      failures.push({ step: 'MCP', error: error.message });
    }
  }

  // Step 5: Configure OpenClaw
  const configSpinner = ora('Creating OpenClaw configuration...').start();
  try {
    const { configureOpenclaw } = await import('../src/configure-openclaw.js');
    await configureOpenclaw(platform, layersObj, config.models);
    configSpinner.succeed('OpenClaw configured');
    successes.push('OpenClaw config');
  } catch (error) {
    configSpinner.fail(`Configuration failed: ${error.message}`);
    failures.push({ step: 'OpenClaw config', error: error.message });
  }

  // Step 6: Run verification
  const verifySpinner = ora('Verifying installation...').start();
  try {
    const { runVerification } = await import('../src/verify.js');
    await runVerification(platform, layersObj);
    verifySpinner.succeed('Verification complete');
    successes.push('Verification');
  } catch (error) {
    verifySpinner.fail(`Verification failed: ${error.message}`);
    failures.push({ step: 'Verification', error: error.message });
  }

  return { successes, failures };
}

/**
 * Print final summary
 */
function printSummary(config, results) {
  console.log(chalk.bold.green('\n\n  Setup Complete!\n'));
  console.log(chalk.dim('  ' + '─'.repeat(48)));

  console.log(chalk.bold('\n  Installed:'));
  if (config.layers.includes('browser')) {
    console.log(chalk.green('  ✓ Browser automation (agent-browser + Playwright)'));
  }
  if (config.layers.includes('macos')) {
    console.log(chalk.green('  ✓ macOS desktop control (AppleScript MCP)'));
  }
  if (config.layers.includes('android')) {
    console.log(chalk.green('  ✓ Android device control (DroidRun)'));
  }
  if (config.layers.includes('windows')) {
    console.log(chalk.green('  ✓ Windows desktop control (PowerShell helpers)'));
  }
  if (config.installOllama || config.models.length > 0) {
    const modelList = config.models.length > 0 ? ` with ${config.models[0]}` : '';
    console.log(chalk.green(`  ✓ Ollama${modelList}`));
  }
  if (config.mcpTarget !== 'skip') {
    const target = config.mcpTarget === 'both' ? 'Claude Desktop & Code' :
                   config.mcpTarget === 'desktop' ? 'Claude Desktop' : 'Claude Code';
    console.log(chalk.green(`  ✓ MCP configured for ${target}`));
  }

  if (results.failures.length > 0) {
    console.log(chalk.bold('\n  Failed Steps:'));
    for (const failure of results.failures) {
      console.log(chalk.red(`  ✗ ${failure.step}: ${failure.error}`));
    }
  }

  console.log(chalk.bold('\n  Next steps:'));
  if (config.mcpTarget === 'desktop' || config.mcpTarget === 'both') {
    console.log('  1. Restart Claude Desktop to load MCP servers');
  }
  if (config.mcpTarget === 'code' || config.mcpTarget === 'both') {
    console.log('  1. Restart Claude Code to load MCP servers');
  }
  console.log('  2. Ask Claude: "Open example.com and read the page"');
  console.log('  3. Read docs/FULL-GUIDE.md for the complete reference');

  console.log(chalk.dim('\n  Run \'openclaw-setup --verify\' anytime to check status'));
  console.log(chalk.dim('  ' + '─'.repeat(48) + '\n'));
}

/**
 * Main CLI entry point
 */
async function main() {
  try {
    // Check Node version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0], 10);

    if (majorVersion < 18) {
      console.error(chalk.red.bold('\n  Error: Node.js 18 or higher is required'));
      console.error(chalk.dim(`  Current version: ${nodeVersion}`));
      console.error(chalk.dim('  Please upgrade Node.js and try again\n'));
      process.exit(1);
    }

    // Print banner (always)
    printBanner();

    // Detect platform
    const platform = await detectPlatform();
    printPlatformInfo(platform);

    // Handle --verify flag
    if (verifyMode) {
      const { runVerification } = await import('../src/verify.js');
      await runVerification(platform, { browser: true, macos: true, android: true, windows: true });
      process.exit(0);
    }

    // Handle --configure flag
    if (configureMode) {
      const { configureMcp } = await import('../src/configure-mcp.js');
      const { mcpTarget } = await inquirer.prompt([
        {
          type: 'list',
          name: 'mcpTarget',
          message: 'Configure MCP for:',
          choices: [
            { name: 'Claude Desktop', value: 'desktop' },
            { name: 'Claude Code', value: 'code' },
            { name: 'Both', value: 'both' }
          ]
        }
      ]);
      await configureMcp(platform, mcpTarget, { browser: true, macos: false, android: false, windows: false });
      console.log(chalk.green('\n✓ MCP configuration updated'));
      process.exit(0);
    }

    // Run full interactive install
    const config = await runFullInstall(platform);
    const results = await executeInstall(platform, config);
    printSummary(config, results);

    // Exit with error code if any failures
    process.exit(results.failures.length > 0 ? 1 : 0);

  } catch (error) {
    console.error(chalk.red.bold('\n\nFatal Error:'));
    console.error(chalk.red(error.message));
    if (error.stack) {
      console.error(chalk.dim(error.stack));
    }
    process.exit(1);
  }
}

// Run CLI
main();
