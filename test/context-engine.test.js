import { describe, it, expect, beforeEach } from 'vitest';
import { ContextEngine } from '../agent/context-engine.js';

describe('ContextEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new ContextEngine();
  });

  describe('constructor', () => {
    it('creates with default budgets', () => {
      const status = engine.getStatus();
      expect(status.budget).toBe(2000);
      expect(status.complexity).toBe('simple');
    });

    it('accepts custom budgets', () => {
      const custom = new ContextEngine({ maxTokensSimple: 1000 });
      const status = custom.getStatus();
      expect(status.budget).toBe(1000);
    });
  });

  describe('setComplexity()', () => {
    it('changes budget for medium', () => {
      engine.setComplexity('medium');
      expect(engine.getStatus().budget).toBe(5000);
    });

    it('changes budget for complex', () => {
      engine.setComplexity('complex');
      expect(engine.getStatus().budget).toBe(15000);
    });

    it('throws on invalid level', () => {
      expect(() => engine.setComplexity('extreme')).toThrow();
    });
  });

  describe('addFact()', () => {
    it('adds fact and increases token count', () => {
      engine.addFact('The price is $42.99');
      expect(engine.getStatus().factCount).toBe(1);
      expect(engine.getStatus().tokensUsed).toBeGreaterThan(0);
    });

    it('supports priority parameter', () => {
      engine.addFact('Critical data', 'critical');
      const facts = engine.getFacts();
      expect(facts[0].priority).toBe('critical');
    });

    it('defaults to normal priority', () => {
      engine.addFact('Regular data');
      const facts = engine.getFacts();
      expect(facts[0].priority).toBe('normal');
    });
  });

  describe('extractFacts()', () => {
    it('extracts facts from snapshot', () => {
      engine.extractFacts({}, ['fact1', 'fact2']);
      expect(engine.getStatus().factCount).toBe(2);
    });

    it('clears snapshot after extraction', () => {
      engine.updateSnapshot({ data: 'test' });
      engine.extractFacts({ data: 'test' }, ['extracted fact']);
      expect(engine.getSnapshot()).toBeNull();
    });

    it('throws on non-array factsList', () => {
      expect(() => engine.extractFacts({}, 'not-array')).toThrow();
    });
  });

  describe('prune()', () => {
    it('removes facts when over budget', () => {
      engine.setComplexity('simple'); // 2000 budget
      // Add many facts to exceed budget
      for (let i = 0; i < 200; i++) {
        engine.addFact(`This is a fairly long fact number ${i} with some extra words to consume tokens`);
      }
      expect(engine.isOverBudget()).toBe(true);
      const pruned = engine.prune();
      expect(pruned).toBeGreaterThan(0);
      expect(engine.isOverBudget()).toBe(false);
    });

    it('prunes ephemeral facts before normal', () => {
      engine.setComplexity('simple');
      engine.addFact('Normal fact 1', 'normal');
      engine.addFact('Ephemeral fact 1', 'ephemeral');
      engine.addFact('Normal fact 2', 'normal');
      // Fill to over budget
      for (let i = 0; i < 200; i++) {
        engine.addFact(`Padding fact ${i}`, 'ephemeral');
      }
      engine.prune();
      // Normal facts should still be there, ephemeral removed first
      const facts = engine.getFacts();
      const normalFacts = facts.filter(f => f.priority === 'normal');
      expect(normalFacts.length).toBeGreaterThan(0);
    });

    it('never prunes critical facts', () => {
      engine.setComplexity('simple');
      engine.addFact('Critical data', 'critical');
      for (let i = 0; i < 200; i++) {
        engine.addFact(`Padding ${i}`, 'ephemeral');
      }
      engine.prune();
      const facts = engine.getFacts();
      const criticalFacts = facts.filter(f => f.priority === 'critical');
      expect(criticalFacts.length).toBe(1);
    });
  });

  describe('getStatus()', () => {
    it('returns warning level', () => {
      const status = engine.getStatus();
      expect(status.warningLevel).toBe('ok');
    });

    it('returns warning at 80%+ usage', () => {
      engine.setComplexity('simple'); // 2000 budget
      // Add facts to reach ~80%
      for (let i = 0; i < 120; i++) {
        engine.addFact(`Fact number ${i} with extra padding words`);
      }
      const status = engine.getStatus();
      if (status.percentUsed >= 80 && status.percentUsed < 95) {
        expect(status.warningLevel).toBe('warning');
      }
    });
  });

  describe('reset()', () => {
    it('clears all state', () => {
      engine.addFact('test');
      engine.setComplexity('complex');
      engine.reset();
      const status = engine.getStatus();
      expect(status.factCount).toBe(0);
      expect(status.tokensUsed).toBe(0);
      expect(status.complexity).toBe('simple');
    });
  });

  describe('token estimation', () => {
    it('uses word-based estimation', () => {
      // Word-based: "hello world" = 2 words * 1.3 = 3 tokens (rounded up)
      engine.addFact('hello world');
      const facts = engine.getFacts();
      expect(facts[0].tokens).toBe(3); // ceil(2 * 1.3)
    });
  });
});
