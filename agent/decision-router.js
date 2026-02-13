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

    // Precompile regex patterns for performance
    this.compiledPatterns = new Map();
    for (const [category, keywords] of Object.entries(this.patterns)) {
      const regexes = keywords.map(pattern =>
        new RegExp(`\\b${this._escapeRegex(pattern)}\\b`, 'i')
      );
      this.compiledPatterns.set(category, {
        keywords: keywords,
        regexes: regexes
      });
    }

    // LRU cache for routing decisions (max 100 entries)
    this.cache = new Map();
    this.cacheMaxSize = 100;

    // Category priority for conflict resolution
    this.categoryPriority = ['api', 'browser', 'macos', 'android', 'windows', 'file'];
  }

  /**
   * Route task to appropriate tool/layer with confidence scoring and caching
   * @param {string} taskDescription - Description of the task
   * @returns {Object|null} Route decision with layer, tool, fallback, reason, confidence, and alternatives
   */
  route(taskDescription) {
    const task = taskDescription.toLowerCase();

    // Check cache first
    const cacheKey = this._hashString(task);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Score all categories
    const scores = [];
    for (const category of this.categoryPriority) {
      const matchCount = this._matchesPattern(task, category);
      if (matchCount > 0) {
        const compiled = this.compiledPatterns.get(category);
        const confidence = matchCount / compiled.keywords.length;
        scores.push({ category, matchCount, confidence });

        // Early exit if > 80% match
        if (confidence > 0.8) {
          break;
        }
      }
    }

    // No matches found
    if (scores.length === 0) {
      this._addToCache(cacheKey, null);
      return null;
    }

    // Sort by confidence (highest first)
    scores.sort((a, b) => b.confidence - a.confidence);

    // Build result based on highest scoring category
    const topScore = scores[0];
    const alternatives = scores.slice(1).map(s => ({
      category: s.category,
      confidence: s.confidence
    }));

    let result = null;

    switch (topScore.category) {
      case 'api':
        result = {
          layer: 'api',
          tool: 'http-request',
          fallback: null,
          reason: 'Detected API/HTTP request keywords',
          confidence: topScore.confidence,
          alternatives,
          available: true
        };
        break;

      case 'browser': {
        const hasBrowserLayer = this.platform.layers?.includes('agent-browser') ||
                                this.platform.layers?.includes('playwright');
        result = {
          layer: 'browser',
          tool: 'agent-browser',
          fallback: 'playwright',
          reason: 'Detected web browsing keywords',
          confidence: topScore.confidence,
          alternatives,
          available: hasBrowserLayer
        };
        break;
      }

      case 'macos':
        if (this.platform.os === 'darwin') {
          const hasAppleScript = this.platform.layers?.includes('applescript');
          result = {
            layer: 'native',
            tool: 'applescript',
            fallback: 'bash',
            reason: 'Detected macOS native app keywords',
            confidence: topScore.confidence,
            alternatives,
            available: hasAppleScript
          };
        } else {
          // macOS keywords but not on macOS - try next best
          result = scores.length > 1 ? this._buildResultForCategory(scores[1], alternatives.slice(1)) : null;
        }
        break;

      case 'android': {
        const hasDroidRun = this.platform.layers?.includes('droidrun');
        result = {
          layer: 'mobile',
          tool: 'droidrun',
          fallback: null,
          reason: 'Detected Android/mobile keywords',
          confidence: topScore.confidence,
          alternatives,
          available: hasDroidRun
        };
        break;
      }

      case 'windows':
        if (this.platform.os === 'win32') {
          const hasPowerShell = this.platform.layers?.includes('powershell');
          result = {
            layer: 'native',
            tool: 'powershell',
            fallback: 'bash',
            reason: 'Detected Windows native keywords',
            confidence: topScore.confidence,
            alternatives,
            available: hasPowerShell
          };
        } else {
          // Windows keywords but not on Windows - try next best
          result = scores.length > 1 ? this._buildResultForCategory(scores[1], alternatives.slice(1)) : null;
        }
        break;

      case 'file': {
        const tool = this.platform.os === 'win32' ? 'powershell' : 'bash';
        result = {
          layer: 'system',
          tool: tool,
          fallback: null,
          reason: 'Detected file/system operation keywords',
          confidence: topScore.confidence,
          alternatives,
          available: true
        };
        break;
      }

      default:
        result = null;
    }

    // Add to cache
    this._addToCache(cacheKey, result);

    return result;
  }

  /**
   * Build result object for a given category score
   * @private
   */
  _buildResultForCategory(score, alternatives) {
    switch (score.category) {
      case 'api':
        return {
          layer: 'api',
          tool: 'http-request',
          fallback: null,
          reason: 'Detected API/HTTP request keywords',
          confidence: score.confidence,
          alternatives,
          available: true
        };
      case 'file': {
        const tool = this.platform.os === 'win32' ? 'powershell' : 'bash';
        return {
          layer: 'system',
          tool: tool,
          fallback: null,
          reason: 'Detected file/system operation keywords',
          confidence: score.confidence,
          alternatives,
          available: true
        };
      }
      default:
        return null;
    }
  }

  /**
   * Check if task matches any keyword in pattern list using precompiled regexes
   * @private
   * @param {string} task - Lowercase task description
   * @param {string} category - Category name (uses precompiled patterns)
   * @returns {number} Number of matched keywords
   */
  _matchesPattern(task, category) {
    const compiled = this.compiledPatterns.get(category);
    if (!compiled) return 0;

    let matchCount = 0;
    for (const regex of compiled.regexes) {
      if (regex.test(task)) {
        matchCount++;
      }
    }
    return matchCount;
  }

  /**
   * Simple string hash for cache keys
   * @private
   * @param {string} str - String to hash
   * @returns {string} Hash string
   */
  _hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Add result to LRU cache
   * @private
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   */
  _addToCache(key, value) {
    // Remove oldest entry if cache is full
    if (this.cache.size >= this.cacheMaxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
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
   * Add custom pattern keywords and recompile regexes
   * @param {string} category - Pattern category (api, browser, etc.)
   * @param {Array<string>} keywords - Keywords to add
   */
  addPatterns(category, keywords) {
    if (!this.patterns[category]) {
      this.patterns[category] = [];
    }
    this.patterns[category].push(...keywords);

    // Recompile patterns for this category
    const regexes = this.patterns[category].map(pattern =>
      new RegExp(`\\b${this._escapeRegex(pattern)}\\b`, 'i')
    );
    this.compiledPatterns.set(category, {
      keywords: this.patterns[category],
      regexes: regexes
    });

    // Clear cache since patterns changed
    this.cache.clear();
  }

  /**
   * Get routing suggestions for a task (shows why it matched)
   * @param {string} taskDescription - Task to analyze
   * @returns {Object} Detailed analysis
   */
  analyze(taskDescription) {
    const task = taskDescription.toLowerCase();
    const matches = {};

    // Use precompiled patterns for analysis
    for (const [category, compiled] of this.compiledPatterns.entries()) {
      const matchedKeywords = [];
      for (let i = 0; i < compiled.regexes.length; i++) {
        if (compiled.regexes[i].test(task)) {
          matchedKeywords.push(compiled.keywords[i]);
        }
      }

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
