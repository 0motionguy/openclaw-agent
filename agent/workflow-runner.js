/**
 * WorkflowRunner - Execute JSON-defined workflows with context management
 *
 * Loads and executes workflows defined in JSON format, with support for:
 * - Template variable resolution ({{variable}})
 * - Step execution with result capture
 * - Verification steps
 * - Context budget management
 */

import { readFile } from 'node:fs/promises';
import { ContextEngine } from './context-engine.js';

export class WorkflowRunner {
  /**
   * @param {Object} options - Configuration options
   * @param {number} options.maxTokensSimple - Budget for simple tasks
   * @param {number} options.maxTokensMedium - Budget for medium tasks
   * @param {number} options.maxTokensComplex - Budget for complex tasks
   */
  constructor(options = {}) {
    this.context = new ContextEngine(options);
    this.variables = {};
    this.stepResults = [];
  }

  /**
   * Load workflow from JSON file
   * @param {string} filePath - Path to workflow JSON file
   * @returns {Promise<Object>} Parsed workflow object
   */
  async loadWorkflow(filePath) {
    try {
      const content = await readFile(filePath, 'utf-8');
      const workflow = JSON.parse(content);

      // Validate workflow structure
      if (!workflow.name) {
        throw new Error('Workflow must have a "name" field');
      }
      if (!Array.isArray(workflow.steps)) {
        throw new Error('Workflow must have a "steps" array');
      }

      // Set context complexity if specified
      if (workflow.complexity) {
        this.context.setComplexity(workflow.complexity);
      }

      return workflow;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in workflow file: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Execute a workflow
   * @param {Object} workflow - Workflow object with steps
   * @param {Function} executor - Async function(tool, action, params) => result
   * @returns {Promise<boolean>} True if workflow succeeded
   */
  async execute(workflow, executor) {
    if (typeof executor !== 'function') {
      throw new Error('Executor must be a function');
    }

    this.stepResults = [];
    this.variables = {
      workflow_name: workflow.name,
      current_date: new Date().toISOString().split('T')[0],
      current_time: new Date().toISOString(),
      current_timestamp: Date.now()
    };

    try {
      // Execute each step in sequence
      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        const stepNumber = i + 1;

        console.log(`\n[Step ${stepNumber}/${workflow.steps.length}] ${step.name || 'Unnamed step'}`);

        // Check if this is a parallel step group
        if (step.parallel && Array.isArray(step.parallel)) {
          await this._executeParallelStep(step, stepNumber, executor);
        } else {
          // Execute single step with retry support
          await this._executeSingleStep(step, stepNumber, executor);
        }

        // Check context budget
        if (this.context.isOverBudget()) {
          console.warn(`  ⚠ Context over budget, pruning...`);
          const pruned = this.context.prune();
          console.log(`  Pruned ${pruned} facts`);
        }
      }

      // Run verification if present
      if (workflow.verification) {
        console.log(`\n[Verification] Running verification checks...`);
        const verificationPassed = await this._runVerification(workflow.verification, executor);

        if (!verificationPassed) {
          console.error(`  ✗ Verification failed`);
          return false;
        }

        console.log(`  ✓ Verification passed`);
      }

      console.log(`\n✓ Workflow "${workflow.name}" completed successfully`);
      return true;

    } catch (error) {
      console.error(`\n✗ Workflow "${workflow.name}" failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Resolve template variables in a step
   * @param {Object} step - Step object with potential templates
   * @returns {Object} Step with resolved templates
   */
  resolveTemplates(step) {
    const resolved = { ...step };

    // Resolve params object recursively
    if (step.params) {
      resolved.params = this._resolveObject(step.params, this.variables);
    }

    return resolved;
  }

  /**
   * Recursively resolve templates in an object
   * @private
   * @param {any} obj - Object to resolve
   * @param {Object} vars - Variable map
   * @returns {any} Resolved object
   */
  _resolveObject(obj, vars) {
    if (typeof obj === 'string') {
      return this._resolveString(obj, vars);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this._resolveObject(item, vars));
    }

    if (obj && typeof obj === 'object') {
      const resolved = {};
      for (const [key, value] of Object.entries(obj)) {
        resolved[key] = this._resolveObject(value, vars);
      }
      return resolved;
    }

    return obj;
  }

  /**
   * Resolve template variables in a string
   * @private
   * @param {string} str - String with {{templates}}
   * @param {Object} vars - Variable map
   * @returns {string} Resolved string
   */
  _resolveString(str, vars) {
    return str.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
      const trimmed = varName.trim();

      // Check if variable exists
      if (trimmed in vars) {
        const value = vars[trimmed];
        // If value is object/array, stringify it
        return typeof value === 'object' ? JSON.stringify(value) : String(value);
      }

      // Return original if not found
      return match;
    });
  }

  /**
   * Execute a single step with retry support
   * @private
   * @param {Object} step - Step configuration
   * @param {number} stepNumber - Step number
   * @param {Function} executor - Executor function
   */
  async _executeSingleStep(step, stepNumber, executor) {
    const maxRetries = step.retry?.max || 0;
    const backoffMs = step.retry?.backoffMs || 1000;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        console.log(`  ⟳ Retry attempt ${attempt}/${maxRetries} (waiting ${backoffMs}ms)...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }

      const startTime = Date.now();

      try {
        // Resolve templates in step parameters
        const resolvedStep = this.resolveTemplates(step);

        // Execute the step
        const result = await executor(
          resolvedStep.tool,
          resolvedStep.action,
          resolvedStep.params || {}
        );

        const duration = Date.now() - startTime;

        // Store result
        const stepResult = {
          stepNumber,
          name: step.name,
          tool: resolvedStep.tool,
          action: resolvedStep.action,
          result,
          success: true,
          timestamp: new Date().toISOString(),
          startTime,
          duration
        };
        this.stepResults.push(stepResult);

        // Store result in variables if ref is specified
        if (step.ref) {
          this.variables[step.ref] = result;
        }

        // Store last value for easy access
        this.variables.last_value = result;
        this.variables.last_step = stepNumber;

        // Extract facts if specified
        if (step.extractFacts && Array.isArray(step.extractFacts)) {
          const facts = step.extractFacts.map(factTemplate =>
            this._resolveString(factTemplate, this.variables)
          );
          const priority = step.factPriority || 'normal';
          this.context.extractFacts(result, facts, priority);
        }

        console.log(`  ✓ Success (${duration}ms)`);
        return; // Success, exit retry loop

      } catch (error) {
        if (attempt === maxRetries) {
          // Last attempt failed
          const duration = Date.now() - startTime;
          console.error(`  ✗ Failed after ${maxRetries + 1} attempts: ${error.message}`);

          // Store error result
          const stepResult = {
            stepNumber,
            name: step.name,
            tool: step.tool,
            action: step.action,
            error: error.message,
            success: false,
            timestamp: new Date().toISOString(),
            startTime,
            duration,
            attempts: maxRetries + 1
          };
          this.stepResults.push(stepResult);

          // If step is not optional, fail workflow
          if (!step.optional) {
            throw new Error(`Step ${stepNumber} failed: ${error.message}`);
          }

          console.log(`  ⚠ Step marked as optional, continuing...`);
        }
      }
    }
  }

  /**
   * Execute parallel substeps
   * @private
   * @param {Object} step - Step configuration with parallel array
   * @param {number} stepNumber - Step number
   * @param {Function} executor - Executor function
   */
  async _executeParallelStep(step, stepNumber, executor) {
    console.log(`  Running ${step.parallel.length} parallel substeps...`);
    const startTime = Date.now();

    // Execute all parallel substeps
    const results = await Promise.allSettled(
      step.parallel.map(async (substep, index) => {
        const resolved = this.resolveTemplates(substep);
        try {
          const result = await executor(resolved.tool, resolved.action, resolved.params || {});
          console.log(`  ✓ Substep ${index + 1}/${step.parallel.length} success`);
          return { substep, result, success: true };
        } catch (error) {
          console.error(`  ✗ Substep ${index + 1}/${step.parallel.length} failed: ${error.message}`);
          return { substep, error, success: false };
        }
      })
    );

    const duration = Date.now() - startTime;

    // Process results
    const successes = [];
    const failures = [];

    for (let i = 0; i < results.length; i++) {
      const settled = results[i];
      if (settled.status === 'fulfilled') {
        const { substep, result, success, error } = settled.value;

        if (success) {
          successes.push({ substep, result });
          // Store result if ref is specified
          if (substep.ref) {
            this.variables[substep.ref] = result;
          }
        } else {
          failures.push({ substep, error });
        }
      } else {
        // Promise rejected
        failures.push({ substep: step.parallel[i], error: settled.reason });
      }
    }

    // Store combined result
    const stepResult = {
      stepNumber,
      name: step.name,
      type: 'parallel',
      successes: successes.length,
      failures: failures.length,
      results: successes,
      errors: failures,
      success: failures.length === 0,
      timestamp: new Date().toISOString(),
      startTime,
      duration
    };
    this.stepResults.push(stepResult);

    // Check if any non-optional substeps failed
    const hasRequiredFailure = failures.some(f => !f.substep.optional);

    if (hasRequiredFailure && !step.optional) {
      const errorMessages = failures.map(f => f.error?.message || f.error).join(', ');
      throw new Error(`Parallel step ${stepNumber} had required substep failures: ${errorMessages}`);
    }

    console.log(`  ✓ Parallel group completed: ${successes.length}/${step.parallel.length} succeeded (${duration}ms)`);
  }

  /**
   * Run verification checks
   * @private
   * @param {Object} verification - Verification config
   * @param {Function} executor - Executor function
   * @returns {Promise<boolean>} True if verification passes
   */
  async _runVerification(verification, executor) {
    // Simple verification: check if specified variables exist and match conditions
    if (verification.checks) {
      for (const check of verification.checks) {
        const value = this.variables[check.variable];

        if (check.exists !== undefined && check.exists) {
          if (value === undefined) {
            console.error(`  Variable "${check.variable}" does not exist`);
            return false;
          }
        }

        if (check.equals !== undefined) {
          if (value !== check.equals) {
            console.error(`  Variable "${check.variable}" does not equal expected value`);
            return false;
          }
        }

        if (check.contains !== undefined) {
          const stringValue = String(value);
          if (!stringValue.includes(check.contains)) {
            console.error(`  Variable "${check.variable}" does not contain "${check.contains}"`);
            return false;
          }
        }
      }
    }

    // Execute verification steps if present
    if (verification.steps) {
      for (const step of verification.steps) {
        const resolvedStep = this.resolveTemplates(step);
        try {
          await executor(resolvedStep.tool, resolvedStep.action, resolvedStep.params || {});
        } catch (error) {
          console.error(`  Verification step failed: ${error.message}`);
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Get workflow execution summary
   * @returns {Object} Summary object
   */
  getSummary() {
    const totalSteps = this.stepResults.length;
    const successSteps = this.stepResults.filter(r => r.success).length;
    const failedSteps = this.stepResults.filter(r => !r.success).length;

    return {
      totalSteps,
      successSteps,
      failedSteps,
      successRate: totalSteps > 0 ? (successSteps / totalSteps) * 100 : 0,
      variables: { ...this.variables },
      contextStatus: this.context.getStatus(),
      results: this.stepResults
    };
  }

  /**
   * Reset runner for new workflow
   */
  reset() {
    this.variables = {};
    this.stepResults = [];
    this.context.reset();
  }

  /**
   * Get current variables
   * @returns {Object} Current variable map
   */
  getVariables() {
    return { ...this.variables };
  }

  /**
   * Set a variable manually
   * @param {string} name - Variable name
   * @param {any} value - Variable value
   */
  setVariable(name, value) {
    this.variables[name] = value;
  }

  /**
   * Get context engine instance
   * @returns {ContextEngine} Context engine
   */
  getContext() {
    return this.context;
  }

  /**
   * Export workflow results as JSON
   * @returns {string} JSON string
   */
  exportResults() {
    return JSON.stringify(this.getSummary(), null, 2);
  }
}
