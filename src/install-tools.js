import { execSync, execFileSync } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';
import { validatePlatform, validateLayers } from './validate.js';

/**
 * Installs required tools based on selected layers
 * @param {object} platform - Platform detection object
 * @param {object} layers - Selected layers (browser, macos, android, windows)
 * @returns {Promise<object>} Installation results
 */
export async function installTools(platform, layers) {
  validatePlatform(platform);
  validateLayers(layers);
  const results = {
    browser: { success: false, error: null },
    macos: { success: false, error: null },
    android: { success: false, error: null },
    windows: { success: false, error: null }
  };

  // Install browser layer tools
  if (layers.browser) {
    await installBrowserTools(results);
  }

  // Install macOS layer tools
  if (layers.macos && platform.os === 'darwin') {
    await installMacOSTools(results);
  } else if (layers.macos && platform.os !== 'darwin') {
    console.log(chalk.yellow('⚠ macOS layer selected but not running on macOS - skipping'));
  }

  // Install Android layer tools
  if (layers.android) {
    await installAndroidTools(platform, results);
  }

  // Windows layer (built-in PowerShell)
  if (layers.windows && platform.os === 'win32') {
    results.windows.success = true;
    console.log(chalk.green('✓ Windows PowerShell layer (built-in)'));
  } else if (layers.windows && platform.os !== 'win32') {
    console.log(chalk.yellow('⚠ Windows layer selected but not running on Windows - skipping'));
  }

  return results;
}

/**
 * Installs browser automation tools
 * @param {object} results - Results object to update
 */
async function installBrowserTools(results) {
  // Check if agent-browser is already installed
  let spinner = ora('Checking @anthropic-ai/agent-browser...').start();
  try {
    execSync('npm list -g @anthropic-ai/agent-browser', { stdio: 'pipe' });
    spinner.succeed('@anthropic-ai/agent-browser already installed');
  } catch {
    // Not installed, proceed with installation
    spinner.text = 'Installing @anthropic-ai/agent-browser...';
    try {
      execSync('npm install -g @anthropic-ai/agent-browser', { stdio: 'pipe' });
      spinner.succeed('Installed @anthropic-ai/agent-browser');
    } catch (error) {
      spinner.fail('Failed to install @anthropic-ai/agent-browser');
      results.browser.error = error.message;
      console.error(chalk.red(error.message));
      return;
    }
  }

  // Check if Playwright is already installed
  spinner = ora('Checking Playwright...').start();
  try {
    execSync('npx playwright --version', { stdio: 'pipe' });
    spinner.succeed('Playwright already installed');
    results.browser.success = true;
  } catch {
    // Not installed, proceed with installation
    spinner.text = 'Installing Playwright Chromium...';
    try {
      execSync('npx playwright install chromium', { stdio: 'pipe' });
      spinner.succeed('Installed Playwright Chromium');
      results.browser.success = true;
    } catch (error) {
      spinner.fail('Failed to install Playwright Chromium');
      results.browser.error = error.message;
      console.error(chalk.red(error.message));
    }
  }
}

/**
 * Installs macOS-specific tools
 * @param {object} results - Results object to update
 */
async function installMacOSTools(results) {
  const spinner = ora('Checking @peakmojo/applescript-mcp...').start();
  try {
    execSync('npm list -g @peakmojo/applescript-mcp', { stdio: 'pipe' });
    spinner.succeed('@peakmojo/applescript-mcp already installed');
    results.macos.success = true;
    console.log(chalk.yellow('\n  Note: AppleScript MCP needs Automation permission'));
    console.log(chalk.dim('  System Settings → Privacy & Security → Automation'));
    console.log(chalk.dim('  Enable for Claude Desktop and/or Terminal\n'));
  } catch {
    // Not installed, proceed with installation
    spinner.text = 'Installing @peakmojo/applescript-mcp...';
    try {
      execSync('npm install -g @peakmojo/applescript-mcp', { stdio: 'pipe' });
      spinner.succeed('Installed @peakmojo/applescript-mcp');
      results.macos.success = true;
      console.log(chalk.yellow('\n  Note: AppleScript MCP needs Automation permission'));
      console.log(chalk.dim('  System Settings → Privacy & Security → Automation'));
      console.log(chalk.dim('  Enable for Claude Desktop and/or Terminal\n'));
    } catch (error) {
      spinner.fail('Failed to install @peakmojo/applescript-mcp');
      results.macos.error = error.message;
      console.error(chalk.red(error.message));
    }
  }
}

/**
 * Installs Android automation tools
 * @param {object} platform - Platform detection object
 * @param {object} results - Results object to update
 */
async function installAndroidTools(platform, results) {
  // Check for ADB first
  if (!platform.hasAdb) {
    console.log(chalk.yellow('  Note: ADB not found — needed to connect to Android devices'));
    if (platform.os === 'darwin') {
      console.log(chalk.dim('  Install: brew install android-platform-tools'));
    } else if (platform.os === 'linux') {
      console.log(chalk.dim('  Install: sudo apt install adb'));
    } else {
      console.log(chalk.dim('  Install: choco install adb  (or download from developer.android.com)'));
    }
    console.log('');
  }

  if (!platform.hasPython) {
    console.log(chalk.red('✗ Python not found - required for DroidRun'));
    results.android.error = 'Python not installed';
    return;
  }

  if (!platform.hasPip) {
    console.log(chalk.red('✗ pip not found - required for DroidRun'));
    results.android.error = 'pip not installed';
    return;
  }

  const spinner = ora('Installing droidrun via pip...').start();
  try {
    const pipCmd = platform.os !== 'win32' ? 'pip3' : 'pip';
    execFileSync(pipCmd, ['install', 'droidrun'], { stdio: 'pipe' });
    spinner.succeed('Installed droidrun');
    results.android.success = true;
  } catch (error) {
    spinner.fail('Failed to install droidrun');
    results.android.error = error.message;
    console.error(chalk.red(error.message));
  }
}
