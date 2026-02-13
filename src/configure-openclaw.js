import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';

/**
 * Generates and writes openclaw.config.json
 * @param {object} platform - Platform detection object
 * @param {object} layers - Selected layers
 * @param {string[]} models - Array of pulled Ollama models
 * @returns {Promise<object>} Configuration results
 */
export async function configureOpenclaw(platform, layers, models) {
  const spinner = ora('Generating openclaw.config.json...').start();

  try {
    // Determine desktop tool based on platform
    let desktopTool = null;
    if (platform.os === 'darwin') {
      desktopTool = 'applescript';
    } else if (platform.os === 'win32') {
      desktopTool = 'powershell';
    }

    // Build configuration object
    const config = {
      version: '1.0.0',
      platform: platform.osName,
      layers: {
        browser: {
          enabled: layers.browser || false,
          primary: 'agent-browser',
          fallback: 'playwright'
        },
        desktop: {
          enabled: layers.macos || layers.windows || false,
          tool: desktopTool
        },
        android: {
          enabled: layers.android || false,
          tool: 'droidrun'
        }
      },
      ollama: {
        endpoint: 'http://localhost:11434',
        primaryModel: 'qwen2.5:7b',
        visionModel: 'llava:7b',
        models: models
      },
      contextRules: {
        maxTokensSimple: 2000,
        maxTokensMedium: 5000,
        maxTokensComplex: 15000,
        discardOldSnapshots: true,
        interactiveOnly: true
      }
    };

    // Write to current working directory
    const configPath = path.join(process.cwd(), 'openclaw.config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');

    spinner.succeed('Generated openclaw.config.json');
    console.log(chalk.gray(`  Location: ${configPath}`));

    // Print summary
    console.log(chalk.cyan('\n📋 Configuration Summary:'));
    console.log(chalk.gray(`  Platform: ${config.platform}`));
    console.log(chalk.gray(`  Browser Layer: ${config.layers.browser.enabled ? '✓' : '✗'}`));
    console.log(chalk.gray(`  Desktop Layer: ${config.layers.desktop.enabled ? '✓ (' + config.layers.desktop.tool + ')' : '✗'}`));
    console.log(chalk.gray(`  Android Layer: ${config.layers.android.enabled ? '✓' : '✗'}`));
    console.log(chalk.gray(`  Ollama Models: ${config.ollama.models.length} models`));
    config.ollama.models.forEach(model => {
      console.log(chalk.gray(`    - ${model}`));
    });

    return {
      success: true,
      path: configPath,
      config
    };
  } catch (error) {
    spinner.fail('Failed to generate openclaw.config.json');
    console.error(chalk.red(error.message));
    return {
      success: false,
      error: error.message
    };
  }
}
