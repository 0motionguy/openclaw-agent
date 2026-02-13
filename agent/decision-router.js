/**
 * DecisionRouter - Implements OpenClaw decision tree for task routing
 *
 * Routes tasks to the appropriate tool/layer based on task description:
 * 1. API tasks → http-request
 * 2. Browser tasks → agent-browser (fallback: playwright)
 * 3. macOS native → applescript (Darwin only)
 * 4. Android → droidrun
 * 5. Windows native → powershell (Windows only)
 * 6. File/system → bash or powershell
 * 7. Unknown → null
 */

export class DecisionRouter {
  /**
   * @param {Object} platform - Platform info
   * @param {string} platform.os - OS type ('darwin', 'win32', 'linux', 'android')
   * @param {Array<string>} platform.layers - Available layers/tools
   */
  constructor(platform) {
    this.platform = platform;

    // Keyword definitions for pattern matching
    this.patterns = {
      api: [
        'api', 'endpoint', 'rest', 'graphql', 'webhook', 'fetch',
        'request', 'http request', 'curl', 'post data', 'get data',
        'json api', 'rest api', 'api call', 'web service'
      ],
      browser: [
        'website', 'web', 'browse', 'url', 'http', 'login', 'form',
        'page', 'click', 'navigate', 'search online', 'web page',
        'browser', 'visit site', 'open website', 'google search',
        'web search', 'download from', 'upload to', 'fill form',
        'submit form', 'screenshot', 'scrape'
      ],
      macos: [
        'finder', 'notes', 'mail', 'messages', 'calendar', 'preview',
        'safari', 'keynote', 'numbers', 'pages', 'spotlight',
        'system preferences', 'app store', 'facetime', 'photos',
        'icloud', 'airdrop', 'mac app', 'macos app'
      ],
      android: [
        'android', 'phone', 'mobile', 'app on phone', 'device',
        'droidrun', 'tap', 'swipe', 'mobile app', 'smartphone',
        'android app', 'install app', 'open app on phone', 'sms',
        'text message', 'mobile browser', 'play store'
      ],
      windows: [
        'explorer', 'registry', 'powershell', 'windows app', 'notepad',
        'task manager', 'control panel', 'cmd', 'command prompt',
        'windows explorer', 'regedit', 'windows settings', 'start menu',
        'taskbar', 'windows service', 'exe file'
      ],
      file: [
        'file', 'folder', 'directory', 'copy', 'move', 'delete',
        'rename', 'download', 'create file', 'read file', 'write file',
        'list files', 'find file', 'search file', 'zip', 'unzip',
        'compress', 'extract', 'path', 'mkdir', 'rm', 'ls', 'cd'
      ]
    };
  }

  /**
   * Route task to appropriate tool/layer
   * @param {string} taskDescription - Description of the task
   * @returns {Object|null} Route decision with layer, tool, fallback, and reason
   */
  route(taskDescription) {
    const task = taskDescription.toLowerCase();

    // Step 1: Check for API tasks
    if (this._matchesPattern(task, this.patterns.api)) {
      return {
        layer: 'api',
        tool: 'http-request',
        fallback: null,
        reason: 'Detected API/HTTP request keywords'
      };
    }

    // Step 2: Check for browser tasks
    if (this._matchesPattern(task, this.patterns.browser)) {
      const hasBrowserLayer = this.platform.layers?.includes('agent-browser') ||
                              this.platform.layers?.includes('playwright');
      return {
        layer: 'browser',
        tool: 'agent-browser',
        fallback: 'playwright',
        reason: 'Detected web browsing keywords',
        available: hasBrowserLayer
      };
    }

    // Step 3: Check for macOS native tasks (only on Darwin)
    if (this.platform.os === 'darwin' && this._matchesPattern(task, this.patterns.macos)) {
      const hasAppleScript = this.platform.layers?.includes('applescript');
      return {
        layer: 'native',
        tool: 'applescript',
        fallback: 'bash',
        reason: 'Detected macOS native app keywords',
        available: hasAppleScript
      };
    }

    // Step 4: Check for Android tasks
    if (this._matchesPattern(task, this.patterns.android)) {
      const hasDroidRun = this.platform.layers?.includes('droidrun');
      return {
        layer: 'mobile',
        tool: 'droidrun',
        fallback: null,
        reason: 'Detected Android/mobile keywords',
        available: hasDroidRun
      };
    }

    // Step 5: Check for Windows native tasks (only on Windows)
    if (this.platform.os === 'win32' && this._matchesPattern(task, this.patterns.windows)) {
      const hasPowerShell = this.platform.layers?.includes('powershell');
      return {
        layer: 'native',
        tool: 'powershell',
        fallback: 'bash',
        reason: 'Detected Windows native keywords',
        available: hasPowerShell
      };
    }

    // Step 6: Check for file/system tasks
    if (this._matchesPattern(task, this.patterns.file)) {
      const tool = this.platform.os === 'win32' ? 'powershell' : 'bash';
      return {
        layer: 'system',
        tool: tool,
        fallback: null,
        reason: 'Detected file/system operation keywords'
      };
    }

    // Step 7: Unknown task type
    return null;
  }

  /**
   * Check if task matches any keyword in pattern list
   * @private
   * @param {string} task - Lowercase task description
   * @param {Array<string>} patterns - Array of keywords to match
   * @returns {boolean} True if any pattern matches
   */
  _matchesPattern(task, patterns) {
    return patterns.some(pattern => {
      // Check for whole word matches or phrases
      const regex = new RegExp(`\\b${this._escapeRegex(pattern)}\\b`, 'i');
      return regex.test(task);
    });
  }

  /**
   * Escape special regex characters
   * @private
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   */
  _escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Get all available patterns for debugging
   * @returns {Object} Pattern categories
   */
  getPatterns() {
    return { ...this.patterns };
  }

  /**
   * Add custom pattern keywords
   * @param {string} category - Pattern category (api, browser, etc.)
   * @param {Array<string>} keywords - Keywords to add
   */
  addPatterns(category, keywords) {
    if (!this.patterns[category]) {
      this.patterns[category] = [];
    }
    this.patterns[category].push(...keywords);
  }

  /**
   * Get routing suggestions for a task (shows why it matched)
   * @param {string} taskDescription - Task to analyze
   * @returns {Object} Detailed analysis
   */
  analyze(taskDescription) {
    const task = taskDescription.toLowerCase();
    const matches = {};

    for (const [category, patterns] of Object.entries(this.patterns)) {
      const matchedKeywords = patterns.filter(pattern => {
        const regex = new RegExp(`\\b${this._escapeRegex(pattern)}\\b`, 'i');
        return regex.test(task);
      });

      if (matchedKeywords.length > 0) {
        matches[category] = matchedKeywords;
      }
    }

    const route = this.route(taskDescription);

    return {
      task: taskDescription,
      route: route,
      matchedPatterns: matches,
      platform: this.platform
    };
  }

  /**
   * Check if a specific tool is available
   * @param {string} tool - Tool name to check
   * @returns {boolean} True if available
   */
  isToolAvailable(tool) {
    return this.platform.layers?.includes(tool) ?? false;
  }

  /**
   * Get human-readable routing explanation
   * @param {string} taskDescription - Task to explain
   * @returns {string} Explanation text
   */
  explain(taskDescription) {
    const analysis = this.analyze(taskDescription);

    if (!analysis.route) {
      return `No clear route found for: "${taskDescription}"`;
    }

    const { route, matchedPatterns } = analysis;
    const keywords = Object.values(matchedPatterns).flat().join(', ');

    let explanation = `Task: "${taskDescription}"\n`;
    explanation += `Route: ${route.tool} (${route.layer} layer)\n`;
    explanation += `Reason: ${route.reason}\n`;
    explanation += `Matched keywords: ${keywords}\n`;

    if (route.fallback) {
      explanation += `Fallback: ${route.fallback}\n`;
    }

    if (route.available !== undefined) {
      explanation += `Available: ${route.available ? 'Yes' : 'No'}\n`;
    }

    return explanation;
  }
}
