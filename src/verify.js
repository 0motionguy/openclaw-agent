import { execSync } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';
import { validatePlatform, validateLayers } from './validate.js';

/**
 * Runs verification tests for installed components (parallel execution)
 * @param {object} platform - Platform detection object
 * @param {object} layers - Selected layers
 * @returns {Promise<object>} Verification results
 */
export async function runVerification(platform, layers) {
  validatePlatform(platform);
  validateLayers(layers);
  console.log(chalk.cyan('\n🔍 Running verification tests...\n'));

  // Headless display check for Linux VPS
  if (layers.browser && process.platform === 'linux' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
    console.log(chalk.yellow('  ⚠ No display server detected (headless VPS)'));
    console.log(chalk.dim('  Playwright needs Xvfb for browser automation:'));
    console.log(chalk.dim('  sudo apt install xvfb && xvfb-run npx playwright test\n'));
  }

  // Build list of tests to run in parallel
  const tests = [];

  // Always test Ollama
  tests.push(testOllama());

  // Browser tests
  if (layers.browser) {
    tests.push(testAgentBrowser());
    tests.push(testPlaywright());
  }

  // macOS test
  if (layers.macos && platform.os === 'darwin') {
    tests.push(testAppleScript());
  }

  // Android test
  if (layers.android) {
    tests.push(testDroidRun());
  }

  // Run all tests in parallel
  const settledResults = await Promise.allSettled(tests);

  // Collect results
  const results = settledResults
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value);

  // Print summary table
  printSummary(results);

  return {
    results,
    allPassed: results.every(r => r.passed)
  };
}

/**
 * Tests if Ollama is running and accessible
 * @returns {Promise<Object>} Test result
 */
async function testOllama() {
  const spinner = ora('Testing Ollama...').start();
  try {
    const response = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(5000) });
    if (response.ok) {
      spinner.succeed('Ollama: Running');
      return { name: 'Ollama', passed: true, details: 'API responding' };
    } else {
      spinner.fail('Ollama: Not responding');
      return { name: 'Ollama', passed: false, details: `HTTP ${response.status}` };
    }
  } catch (error) {
    spinner.fail('Ollama: Not accessible');
    return { name: 'Ollama', passed: false, details: error.message };
  }
}

/**
 * Tests if agent-browser is installed
 * @returns {Promise<Object>} Test result
 */
async function testAgentBrowser() {
  const spinner = ora('Testing agent-browser...').start();
  try {
    // Try to run the package - it should be globally installed
    execSync('npx @anthropic-ai/agent-browser --version', {
      stdio: 'pipe',
      encoding: 'utf8'
    });
    spinner.succeed('agent-browser: Installed');
    return { name: 'agent-browser', passed: true, details: 'Package available' };
  } catch {
    // Check if globally installed
    try {
      execSync('npm list -g @anthropic-ai/agent-browser', {
        stdio: 'pipe',
        encoding: 'utf8'
      });
      spinner.succeed('agent-browser: Installed (global)');
      return { name: 'agent-browser', passed: true, details: 'Globally installed' };
    } catch {
      spinner.fail('agent-browser: Not found');
      return { name: 'agent-browser', passed: false, details: 'Not installed' };
    }
  }
}

/**
 * Tests if Playwright is installed
 * @returns {Promise<Object>} Test result
 */
async function testPlaywright() {
  const spinner = ora('Testing Playwright...').start();
  try {
    const output = execSync('npx playwright --version', {
      stdio: 'pipe',
      encoding: 'utf8'
    });
    const version = output.trim();
    spinner.succeed('Playwright: Installed');
    return { name: 'Playwright', passed: true, details: version };
  } catch {
    spinner.fail('Playwright: Not found');
    return { name: 'Playwright', passed: false, details: 'Not installed' };
  }
}

/**
 * Tests if AppleScript MCP is installed (macOS only)
 * @returns {Promise<Object>} Test result
 */
async function testAppleScript() {
  const spinner = ora('Testing AppleScript MCP...').start();
  try {
    execSync('npm list -g @peakmojo/applescript-mcp', {
      stdio: 'pipe',
      encoding: 'utf8'
    });
    spinner.succeed('AppleScript MCP: Installed');
    return { name: 'AppleScript MCP', passed: true, details: 'Globally installed' };
  } catch {
    spinner.fail('AppleScript MCP: Not found');
    return { name: 'AppleScript MCP', passed: false, details: 'Not installed' };
  }
}

/**
 * Tests if DroidRun/ADB is working
 * @returns {Promise<Object>} Test result
 */
async function testDroidRun() {
  const spinner = ora('Testing DroidRun/ADB...').start();
  try {
    const output = execSync('adb devices', {
      stdio: 'pipe',
      encoding: 'utf8'
    });

    // Check if any devices are listed (lines after "List of devices attached")
    const lines = output.split('\n').filter(line => line.trim() && !line.includes('List of devices'));

    if (lines.length > 0) {
      spinner.succeed('DroidRun/ADB: Working');
      return { name: 'DroidRun/ADB', passed: true, details: `${lines.length} device(s) connected` };
    } else {
      spinner.warn('DroidRun/ADB: No devices connected');
      return { name: 'DroidRun/ADB', passed: false, details: 'No devices found' };
    }
  } catch {
    spinner.fail('DroidRun/ADB: Not accessible');
    return { name: 'DroidRun/ADB', passed: false, details: 'ADB not found' };
  }
}

/**
 * Prints a formatted summary table of test results
 * @param {Array} results - Test results
 */
function printSummary(results) {
  console.log(chalk.cyan('\n📊 Verification Summary:\n'));

  // Calculate column widths
  const nameWidth = Math.max(...results.map(r => r.name.length), 10);
  const statusWidth = 8;
  // Print header
  const header = `${'Component'.padEnd(nameWidth)} | ${'Status'.padEnd(statusWidth)} | Details`;
  console.log(chalk.bold(header));
  console.log('-'.repeat(header.length));

  // Print results
  results.forEach(result => {
    const status = result.passed ? chalk.green('✓ PASS') : chalk.red('✗ FAIL');
    const name = result.name.padEnd(nameWidth);
    const statusPadded = status.padEnd(statusWidth + 10); // +10 for color codes
    const details = chalk.gray(result.details);
    console.log(`${name} | ${statusPadded} | ${details}`);
  });

  // Print overall status
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  console.log('');

  if (passedCount === totalCount) {
    console.log(chalk.green(`✓ All tests passed (${passedCount}/${totalCount})`));
  } else {
    console.log(chalk.yellow(`⚠ ${passedCount}/${totalCount} tests passed`));
  }
  console.log('');
}
