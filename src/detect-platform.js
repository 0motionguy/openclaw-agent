import { exec } from 'child_process';
import { promisify } from 'util';
import process from 'process';

const execAsync = promisify(exec);

/**
 * Checks if a command exists on the system (async)
 * @param {string} command - Command to check
 * @returns {Promise<boolean>}
 */
async function commandExists(command) {
  try {
    const whichCmd = process.platform === 'win32' ? 'where' : 'which';
    await execAsync(`${whichCmd} ${command}`, { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets the version of a command by running it with --version (async)
 * @param {string} command - Command to run
 * @param {string[]} args - Arguments to pass (defaults to ['--version'])
 * @returns {Promise<string | null>}
 */
async function getVersion(command, args = ['--version']) {
  try {
    const { stdout } = await execAsync(`${command} ${args.join(' ')}`, {
      timeout: 3000
    });
    return stdout.trim();
  } catch {
    return null;
  }
}

/**
 * Detects the current platform and available tools (parallel async checks)
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

  // Check Node.js version (sync, no await needed)
  const nodeVersion = process.versions.node;
  const nodeMajor = parseInt(nodeVersion.split('.')[0], 10);
  const nodeOk = nodeMajor >= 18;

  // Run ALL checks in parallel for 4x faster detection
  const [
    hasHomebrew,
    hasWinget,
    hasChoco,
    hasOllama,
    hasPython3,
    hasPython,
    hasPip3,
    hasPip,
    hasAdb
  ] = await Promise.all([
    os === 'darwin' ? commandExists('brew') : Promise.resolve(false),
    os === 'win32' ? commandExists('winget') : Promise.resolve(false),
    os === 'win32' ? commandExists('choco') : Promise.resolve(false),
    commandExists('ollama'),
    commandExists('python3'),
    commandExists('python'),
    commandExists('pip3'),
    commandExists('pip'),
    commandExists('adb')
  ]);

  // Determine Python and pip availability
  const hasPythonAny = hasPython3 || hasPython;
  const hasPipResult = hasPip3 || hasPip;

  // Get Python version if available
  let pythonVersion = null;
  if (hasPythonAny) {
    const pythonCmd = hasPython3 ? 'python3' : 'python';
    pythonVersion = await getVersion(pythonCmd, ['--version']);
    if (pythonVersion) {
      // Extract version number from "Python 3.x.x"
      pythonVersion = pythonVersion.replace('Python ', '');
    }
  }

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
    hasPython: hasPythonAny,
    pythonVersion,
    hasPip: hasPipResult,
    hasAdb
  };
}
