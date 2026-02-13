import { describe, it, expect, beforeEach } from 'vitest';
import { WorkflowRunner } from '../agent/workflow-runner.js';

describe('WorkflowRunner', () => {
  let runner;

  beforeEach(() => {
    runner = new WorkflowRunner();
  });

  describe('execute()', () => {
    it('executes sequential steps', async () => {
      const workflow = {
        name: 'test-workflow',
        steps: [
          { name: 'Step 1', tool: 'test', action: 'do', params: { key: 'val' }, ref: 'result1' },
          { name: 'Step 2', tool: 'test', action: 'do', params: { input: '{{result1}}' } }
        ]
      };
      const executor = async (tool, action, params) => `executed-${action}`;
      const success = await runner.execute(workflow, executor);
      expect(success).toBe(true);
      expect(runner.getVariables().result1).toBe('executed-do');
    });

    it('handles optional step failures', async () => {
      const workflow = {
        name: 'test',
        steps: [
          { name: 'Fail', tool: 'x', action: 'fail', optional: true },
          { name: 'Pass', tool: 'x', action: 'pass', ref: 'ok' }
        ]
      };
      const executor = async (tool, action) => {
        if (action === 'fail') throw new Error('boom');
        return 'success';
      };
      const success = await runner.execute(workflow, executor);
      expect(success).toBe(true);
    });

    it('fails on non-optional step failure', async () => {
      const workflow = {
        name: 'test',
        steps: [{ name: 'Fail', tool: 'x', action: 'fail' }]
      };
      const executor = async () => { throw new Error('boom'); };
      const success = await runner.execute(workflow, executor);
      expect(success).toBe(false);
    });

    it('records step timing', async () => {
      const workflow = {
        name: 'test',
        steps: [{ name: 'Step', tool: 'x', action: 'do' }]
      };
      const executor = async () => 'done';
      await runner.execute(workflow, executor);
      const summary = runner.getSummary();
      expect(summary.results[0].duration).toBeDefined();
      expect(summary.results[0].duration).toBeGreaterThanOrEqual(0);
    });

    it('throws if executor is not a function', async () => {
      await expect(runner.execute({ name: 'x', steps: [] }, 'not-func')).rejects.toThrow();
    });
  });

  describe('resolveTemplates()', () => {
    it('resolves {{variables}} in params', () => {
      runner.setVariable('name', 'Alice');
      const resolved = runner.resolveTemplates({
        tool: 'test',
        action: 'greet',
        params: { greeting: 'Hello {{name}}' }
      });
      expect(resolved.params.greeting).toBe('Hello Alice');
    });

    it('keeps unresolved variables as-is', () => {
      const resolved = runner.resolveTemplates({
        tool: 'test',
        action: 'greet',
        params: { greeting: 'Hello {{unknown}}' }
      });
      expect(resolved.params.greeting).toBe('Hello {{unknown}}');
    });
  });

  describe('verification', () => {
    it('passes when variables exist', async () => {
      const workflow = {
        name: 'test',
        steps: [{ name: 'Get', tool: 'x', action: 'do', ref: 'data' }],
        verification: {
          checks: [{ variable: 'data', exists: true }]
        }
      };
      const executor = async () => 'result';
      const success = await runner.execute(workflow, executor);
      expect(success).toBe(true);
    });
  });

  describe('reset()', () => {
    it('clears all state', async () => {
      runner.setVariable('x', 1);
      runner.reset();
      expect(runner.getVariables()).toEqual({});
    });
  });
});
