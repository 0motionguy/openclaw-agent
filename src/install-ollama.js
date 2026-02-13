import { execSync, execFileSync, spawn } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';
import { validatePlatform, validateModelName } from './validate.js';

/**
 * Installs Ollama on the current platform
 * @param {object} platform - Platform detection object
 * @returns {Promise<boolean>} Success status
 */
export async function installOllama(platform) {
  validatePlatform(platform);
  const spinner = ora('Installing Ollama...').start();

  try {
    if (platform.os === 'darwin') {
      // macOS
      if (platform.hasHomebrew) {
        spinner.text = 'Installing Ollama via Homebrew...';
        execSync('brew install --cask ollama', { stdio: 'inherit' });
        spinner.succeed('Ollama installed via Homebrew');

        // Start Ollama service
        try {
          spinner.start('Starting Ollama service...');
          execSync('brew services start ollama', { stdio: 'ignore' });
          spinner.succeed('Ollama service started');
        } catch {
          spinner.warn('Could not start Ollama service automatically');
          console.log(chalk.yellow('You may need to start Ollama manually'));
        }
      } else {
        spinner.warn('Homebrew not found');
        console.log(chalk.yellow('\nPlease install Ollama manually:'));
        console.log(chalk.cyan('  Download: https://ollama.com/download'));
        console.log(chalk.yellow('\nPress Enter after installation to continue...'));
        await waitForEnter();
      }
    } else if (platform.os === 'win32') {
      // Windows
      spinner.warn('Manual installation required on Windows');
      console.log(chalk.yellow('\nPlease install Ollama manually:'));
      console.log(chalk.cyan('  Download: https://ollama.com/download'));
      console.log(chalk.yellow('\nPress Enter after installation to continue...'));
      await waitForEnter();
    } else if (platform.os === 'linux') {
      // Linux
      spinner.text = 'Installing Ollama via install script...';
      execSync('curl -fsSL https://ollama.com/install.sh | sh', { stdio: 'inherit' });
      spinner.succeed('Ollama installed');

      // Try to start Ollama service in background
      try {
        spinner.start('Starting Ollama service...');
        const ollamaProcess = spawn('ollama', ['serve'], {
          detached: true,
          stdio: 'ignore'
        });
        ollamaProcess.unref();
        spinner.succeed('Ollama service started in background');
      } catch {
        spinner.warn('Could not start Ollama service automatically');
        console.log(chalk.yellow('You may need to run: ollama serve'));
      }

      // Hint for persistent service on Linux VPS
      console.log(chalk.dim('\n  For persistent service on a VPS:'));
      console.log(chalk.dim('  sudo systemctl enable ollama && sudo systemctl start ollama\n'));
    } else {
      spinner.fail(`Unsupported platform: ${platform.osName}`);
      return false;
    }

    // Wait a moment for Ollama to start
    await new Promise(resolve => setTimeout(resolve, 2000));
    return true;
  } catch (error) {
    spinner.fail('Failed to install Ollama');
    console.error(chalk.red(error.message));
    return false;
  }
}

/**
 * Pulls multiple Ollama models
 * @param {string[]} models - Array of model names to pull
 * @returns {Promise<string[]>} Array of successfully pulled models
 */
export async function pullModels(models) {
  const pulledModels = [];

  for (const model of models) {
    const spinner = ora(`Pulling model: ${model}`).start();
    try {
      validateModelName(model);
      execFileSync('ollama', ['pull', model], { stdio: 'inherit' });
      spinner.succeed(`Pulled model: ${model}`);
      pulledModels.push(model);
    } catch (error) {
      spinner.fail(`Failed to pull model: ${model}`);
      console.error(chalk.red(error.message));
    }
  }

  return pulledModels;
}

/**
 * Waits for user to press Enter
 * @returns {Promise<void>}
 */
function waitForEnter() {
  return new Promise((resolve) => {
    process.stdin.once('data', () => {
      resolve();
    });
  });
}
