import { execSync } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';

/**
 * Installs required tools based on selected layers
 * @param {object} platform - Platform detection object
 * @param {object} layers - Selected layers (browser, macos, android, windows)
 * @returns {Promise<object>} Installation results
 */
export async function installTools(platform, layers) {
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
  let spinner = ora('Installing @anthropic-ai/agent-browser...').start();
  try {
    execSync('npm install -g @anthropic-ai/agent-browser', { stdio: 'pipe' });
    spinner.succeed('Installed @anthropic-ai/agent-browser');
  } catch (error) {
    spinner.fail('Failed to install @anthropic-ai/agent-browser');
    results.browser.error = error.message;
    console.error(chalk.red(error.message));
    return;
  }

  spinner = ora('Installing Playwright Chromium...').start();
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

/**
 * Installs macOS-specific tools
 * @param {object} results - Results object to update
 */
async function installMacOSTools(results) {
  const spinner = ora('Installing @peakmojo/applescript-mcp...').start();
  try {
    execSync('npm install -g @peakmojo/applescript-mcp', { stdio: 'pipe' });
    spinner.succeed('Installed @peakmojo/applescript-mcp');
    results.macos.success = true;
  } catch (error) {
    spinner.fail('Failed to install @peakmojo/applescript-mcp');
    results.macos.error = error.message;
    console.error(chalk.red(error.message));
  }
}

/**
 * Installs Android automation tools
 * @param {object} platform - Platform detection object
 * @param {object} results - Results object to update
 */
async function installAndroidTools(platform, results) {
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
    const pipCmd = platform.hasPip && execSync('which pip3', { encoding: 'utf8', stdio: 'pipe' }).trim() ? 'pip3' : 'pip';
    execSync(`${pipCmd} install droidrun`, { stdio: 'pipe' });
    spinner.succeed('Installed droidrun');
    results.android.success = true;
  } catch (error) {
    spinner.fail('Failed to install droidrun');
    results.android.error = error.message;
    console.error(chalk.red(error.message));
  }
}
