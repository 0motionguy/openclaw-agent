import { describe, it, expect, beforeEach } from 'vitest';
import { DecisionRouter } from '../agent/decision-router.js';

describe('DecisionRouter', () => {
  let router;

  beforeEach(() => {
    router = new DecisionRouter({ os: 'darwin', layers: ['agent-browser', 'playwright', 'applescript'] });
  });

  describe('route()', () => {
    it('routes API tasks correctly', () => {
      const result = router.route('Make an API call to get user data');
      expect(result).not.toBeNull();
      expect(result.layer).toBe('api');
      expect(result.tool).toBe('http-request');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('routes browser tasks correctly', () => {
      const result = router.route('Open the website and fill the login form');
      expect(result).not.toBeNull();
      expect(result.layer).toBe('browser');
      expect(result.tool).toBe('agent-browser');
      expect(result.fallback).toBe('playwright');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('routes macOS tasks on darwin', () => {
      const result = router.route('Open Notes and create a new document');
      expect(result).not.toBeNull();
      expect(result.tool).toBe('applescript');
    });

    it('does not route macOS tasks on linux', () => {
      const linuxRouter = new DecisionRouter({ os: 'linux', layers: ['agent-browser'] });
      const result = linuxRouter.route('Open Notes and create a new document');
      // Should not route to applescript on linux
      if (result) {
        expect(result.tool).not.toBe('applescript');
      }
    });

    it('routes Android tasks correctly', () => {
      const result = router.route('Open the app on my phone and tap the button');
      expect(result).not.toBeNull();
      expect(result.layer).toBe('mobile');
      expect(result.tool).toBe('droidrun');
    });

    it('routes file tasks correctly', () => {
      const result = router.route('Create a new directory and copy files');
      expect(result).not.toBeNull();
      expect(result.layer).toBe('system');
    });

    it('returns null for unrecognized tasks', () => {
      const result = router.route('asdflkjasdf random gibberish');
      expect(result).toBeNull();
    });

    it('returns confidence scores', () => {
      const result = router.route('Open the website login form and fill it');
      expect(result).not.toBeNull();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('returns alternatives when multiple categories match', () => {
      // "download file from website" could match both browser and file
      const result = router.route('Download the file from the website');
      expect(result).not.toBeNull();
      // Should have alternatives since both browser and file keywords match
      expect(result.alternatives).toBeDefined();
    });

    it('uses cache for repeated queries', () => {
      const result1 = router.route('Open Google and search for cats');
      const result2 = router.route('Open Google and search for cats');
      expect(result1).toEqual(result2);
    });
  });

  describe('analyze()', () => {
    it('returns matched patterns', () => {
      const analysis = router.analyze('Open the website and fill the form');
      expect(analysis.matchedPatterns).toBeDefined();
      expect(analysis.matchedPatterns.browser).toBeDefined();
    });
  });

  describe('addPatterns()', () => {
    it('adds custom patterns', () => {
      router.addPatterns('browser', ['custom-keyword']);
      const result = router.route('Do the custom-keyword thing');
      expect(result).not.toBeNull();
      expect(result.layer).toBe('browser');
    });
  });
});
