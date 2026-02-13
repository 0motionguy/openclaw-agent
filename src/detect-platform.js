import { execSync } from 'child_process';
import process from 'process';

/**
 * Checks if a command exists on the system
 * @param {string} command - Command to check
 * @returns {boolean}
 */
function commandExists(command) {
  try {
    const whichCmd = process.platform === 'win32' ? 'where' : 'which';
    execSync(`${whichCmd} ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets the version of a command by running it with --version
 * @param {string} command - Command to run
 * @param {string[]} args - Arguments to pass (defaults to ['--version'])
 * @returns {string | null}
 */
function getVersion(command, args = ['--version']) {
  try {
    const result = execSync(`${command} ${args.join(' ')}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    return result;
  } catch {
    return null;
  }
}

/**
 * Detects the current platform and available tools
 * @returns {Promise<object>} Platform detection results
 */
export async function detectPlatform() {
  const os = process.platform;
  const osNameMap = {
    darwin: 'macOS',
    win32: 'Windows',
    linux: 'Linux'
  };
  const osName = osNameMap[os] || 'Unknown';

  // Check Node.js version
  const nodeVersion = process.versions.node;
  const nodeMajor = parseInt(nodeVersion.split('.')[0], 10);
  const nodeOk = nodeMajor >= 18;

  // Check package managers (platform-specific)
  const hasHomebrew = os === 'darwin' ? commandExists('brew') : false;
  const hasWinget = os === 'win32' ? commandExists('winget') : false;
  const hasChoco = os === 'win32' ? commandExists('choco') : false;

  // Check Ollama
  const hasOllama = commandExists('ollama');

  // Check Python
  const hasPython = commandExists('python3') || commandExists('python');
  let pythonVersion = null;
  if (hasPython) {
    const pythonCmd = commandExists('python3') ? 'python3' : 'python';
    pythonVersion = getVersion(pythonCmd, ['--version']);
    if (pythonVersion) {
      // Extract version number from "Python 3.x.x"
      pythonVersion = pythonVersion.replace('Python ', '');
    }
  }

  // Check pip
  const hasPip = commandExists('pip3') || commandExists('pip');

  // Check ADB (Android Debug Bridge)
  const hasAdb = commandExists('adb');

  return {
    os,
    osName,
    arch: process.arch,
    nodeVersion,
    nodeOk,
    hasHomebrew,
    hasWinget,
    hasChoco,
    hasOllama,
    hasPython,
    pythonVersion,
    hasPip,
    hasAdb
  };
}
