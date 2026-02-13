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
  }

  /**
   * Extract facts from snapshot and add to fact list
   * After extraction, snapshot can be discarded (Rule C2: extract & discard)
   * @param {any} snapshot - Snapshot to extract from
   * @param {Array<string>} factsList - List of facts extracted
   */
  extractFacts(snapshot, factsList) {
    if (!Array.isArray(factsList)) {
      throw new Error('factsList must be an array of strings');
    }

    // Add facts with timestamp
    const timestamp = new Date().toISOString();
    for (const fact of factsList) {
      const factEntry = {
        fact: String(fact),
        extractedAt: timestamp,
        tokens: this._estimateTokens(String(fact))
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
   * Prune oldest facts to get under budget (Rule C4: prune when necessary)
   * @returns {number} Number of facts pruned
   */
  prune() {
    const budget = this.budgets[this.taskComplexity];
    let pruned = 0;

    // Remove oldest facts (FIFO) until we're under budget
    while (this.tokenCount > budget && this.facts.length > 0) {
      const removed = this.facts.shift();
      if (removed) {
        this.tokenCount -= removed.tokens;
        pruned++;
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
  }

  /**
   * Get status summary of context state (Rule C7: visibility)
   * @returns {Object} Status object with current state
   */
  getStatus() {
    const budget = this.budgets[this.taskComplexity];
    return {
      complexity: this.taskComplexity,
      budget: budget,
      tokensUsed: this.tokenCount,
      tokensRemaining: budget - this.tokenCount,
      percentUsed: Math.round((this.tokenCount / budget) * 100),
      factCount: this.facts.length,
      hasSnapshot: this.currentSnapshot !== null,
      isOverBudget: this.isOverBudget()
    };
  }

  /**
   * Estimate token count for text (rough: 4 chars = 1 token)
   * @private
   * @param {string} text - Text to estimate
   * @returns {number} Estimated token count
   */
  _estimateTokens(text) {
    if (typeof text !== 'string') {
      text = JSON.stringify(text);
    }
    // Rough estimation: 4 characters ≈ 1 token
    return Math.ceil(text.length / 4);
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
   */
  addFact(fact) {
    const factEntry = {
      fact: String(fact),
      extractedAt: new Date().toISOString(),
      tokens: this._estimateTokens(String(fact))
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
