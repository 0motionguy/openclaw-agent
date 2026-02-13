/**
 * ContextEngine - Enforces context engineering rules C1-C7 from OpenClaw guide
 *
 * Rules enforced:
 * - C1: Discard old snapshots, keep only current
 * - C2: Extract facts from snapshots, discard raw data
 * - C3: Maintain token budgets per task complexity
 * - C4: Prune oldest facts when over budget
 * - C5: Reset context between tasks
 * - C6: Track token usage accurately
 * - C7: Provide visibility into context state
 */

export class ContextEngine {
  /**
   * @param {Object} options - Configuration options
   * @param {number} options.maxTokensSimple - Budget for simple tasks (default: 2000)
   * @param {number} options.maxTokensMedium - Budget for medium tasks (default: 5000)
   * @param {number} options.maxTokensComplex - Budget for complex tasks (default: 15000)
   */
  constructor(options = {}) {
    this.budgets = {
      simple: options.maxTokensSimple || 2000,
      medium: options.maxTokensMedium || 5000,
      complex: options.maxTokensComplex || 15000,
    };
    this.currentSnapshot = null;
    this.facts = [];
    this.tokenCount = 0;
    this.taskComplexity = 'simple';
    this.snapshotVersion = 0;
  }

  /**
   * Set task complexity level and adjust budget accordingly
   * @param {'simple' | 'medium' | 'complex'} level - Complexity level
   */
  setComplexity(level) {
    if (!['simple', 'medium', 'complex'].includes(level)) {
      throw new Error(`Invalid complexity level: ${level}. Must be 'simple', 'medium', or 'complex'`);
    }
    this.taskComplexity = level;
  }

  /**
   * Store new snapshot, discarding old one (Rule C1: discard old snapshots)
   * @param {any} snapshot - New snapshot data
   */
  updateSnapshot(snapshot) {
    // Discard old snapshot completely
    this.currentSnapshot = snapshot;
    this.snapshotVersion++;
  }

  /**
   * Extract facts from snapshot and add to fact list
   * After extraction, snapshot can be discarded (Rule C2: extract & discard)
   * @param {any} snapshot - Snapshot to extract from
   * @param {Array<string>} factsList - List of facts extracted
   * @param {'critical' | 'normal' | 'ephemeral'} priority - Fact priority (default: 'normal')
   */
  extractFacts(snapshot, factsList, priority = 'normal') {
    if (!Array.isArray(factsList)) {
      throw new Error('factsList must be an array of strings');
    }

    if (!['critical', 'normal', 'ephemeral'].includes(priority)) {
      throw new Error('priority must be "critical", "normal", or "ephemeral"');
    }

    // Add facts with timestamp and priority
    const timestamp = new Date().toISOString();
    for (const fact of factsList) {
      const factEntry = {
        fact: String(fact),
        extractedAt: timestamp,
        tokens: this._estimateTokens(String(fact)),
        priority: priority
      };
      this.facts.push(factEntry);
      this.tokenCount += factEntry.tokens;
    }

    // After extracting facts, we can discard the snapshot
    this.currentSnapshot = null;
  }

  /**
   * Check if current context exceeds token budget
   * @returns {boolean} True if over budget
   */
  isOverBudget() {
    const budget = this.budgets[this.taskComplexity];
    return this.tokenCount > budget;
  }

  /**
   * Get remaining budget for current complexity level
   * @returns {number} Tokens remaining (negative if over budget)
   */
  getBudgetRemaining() {
    const budget = this.budgets[this.taskComplexity];
    return budget - this.tokenCount;
  }

  /**
   * Prune facts to get under budget (Rule C4: prune when necessary)
   * Priority-based: ephemeral first, then normal. NEVER auto-prune critical.
   * @returns {number} Number of facts pruned
   */
  prune() {
    const budget = this.budgets[this.taskComplexity];
    let pruned = 0;

    // First pass: remove ephemeral facts (oldest first)
    let i = 0;
    while (this.tokenCount > budget && i < this.facts.length) {
      if (this.facts[i].priority === 'ephemeral') {
        const removed = this.facts.splice(i, 1)[0];
        this.tokenCount -= removed.tokens;
        pruned++;
      } else {
        i++;
      }
    }

    // Second pass: remove normal facts (oldest first)
    i = 0;
    while (this.tokenCount > budget && i < this.facts.length) {
      if (this.facts[i].priority === 'normal') {
        const removed = this.facts.splice(i, 1)[0];
        this.tokenCount -= removed.tokens;
        pruned++;
      } else {
        i++;
      }
    }

    // Never auto-prune critical facts
    // If still over budget, log a warning but don't prune critical facts
    if (this.tokenCount > budget) {
      const criticalCount = this.facts.filter(f => f.priority === 'critical').length;
      if (criticalCount > 0) {
        console.warn(`Warning: Context over budget but ${criticalCount} critical facts remain`);
      }
    }

    return pruned;
  }

  /**
   * Reset context for new task (Rule C5: reset between tasks)
   */
  reset() {
    this.currentSnapshot = null;
    this.facts = [];
    this.tokenCount = 0;
    this.taskComplexity = 'simple';
    this.snapshotVersion = 0;
  }

  /**
   * Get status summary of context state (Rule C7: visibility)
   * @returns {Object} Status object with current state
   */
  getStatus() {
    const budget = this.budgets[this.taskComplexity];
    const percentUsed = Math.round((this.tokenCount / budget) * 100);

    // Determine warning level
    let warningLevel;
    if (percentUsed > 100) {
      warningLevel = 'exceeded';
    } else if (percentUsed >= 95) {
      warningLevel = 'critical';
    } else if (percentUsed >= 80) {
      warningLevel = 'warning';
    } else {
      warningLevel = 'ok';
    }

    return {
      complexity: this.taskComplexity,
      budget: budget,
      tokensUsed: this.tokenCount,
      tokensRemaining: budget - this.tokenCount,
      percentUsed: percentUsed,
      warningLevel: warningLevel,
      factCount: this.facts.length,
      hasSnapshot: this.currentSnapshot !== null,
      isOverBudget: this.isOverBudget()
    };
  }

  /**
   * Get snapshot age (how many snapshots ago current one was set)
   * @returns {number} Snapshot version counter
   */
  getSnapshotAge() {
    return this.snapshotVersion;
  }

  /**
   * Estimate token count for text using word-based approximation
   * @private
   * @param {string} text - Text to estimate
   * @returns {number} Estimated token count
   */
  _estimateTokens(text) {
    if (typeof text !== 'string') {
      text = JSON.stringify(text);
    }
    // Word-based estimation: ~1.3x word count (closer to BPE tokenization)
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
    return Math.ceil(wordCount * 1.3);
  }

  /**
   * Get all current facts
   * @returns {Array<Object>} Array of fact entries
   */
  getFacts() {
    return [...this.facts];
  }

  /**
   * Get current snapshot (if any)
   * @returns {any} Current snapshot or null
   */
  getSnapshot() {
    return this.currentSnapshot;
  }

  /**
   * Manually add a single fact
   * @param {string} fact - Fact to add
   * @param {'critical' | 'normal' | 'ephemeral'} priority - Fact priority (default: 'normal')
   */
  addFact(fact, priority = 'normal') {
    if (!['critical', 'normal', 'ephemeral'].includes(priority)) {
      throw new Error('priority must be "critical", "normal", or "ephemeral"');
    }

    const factEntry = {
      fact: String(fact),
      extractedAt: new Date().toISOString(),
      tokens: this._estimateTokens(String(fact)),
      priority: priority
    };
    this.facts.push(factEntry);
    this.tokenCount += factEntry.tokens;
  }

  /**
   * Get summary string for logging
   * @returns {string} Human-readable summary
   */
  toString() {
    const status = this.getStatus();
    return `ContextEngine [${status.complexity}] ${status.tokensUsed}/${status.budget} tokens (${status.percentUsed}%) | ${status.factCount} facts`;
  }
}
