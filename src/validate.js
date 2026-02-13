/**
 * Input validation utilities for OpenClaw installer
 */

const VALID_OS = ['darwin', 'win32', 'linux'];
const VALID_TARGETS = ['desktop', 'code', 'both', 'skip'];
const MODEL_NAME_REGEX = /^[a-zA-Z0-9._:\/-]+$/;

export function validatePlatform(platform) {
  if (!platform || typeof platform !== 'object') {
    throw new TypeError('platform must be an object');
  }
  if (!VALID_OS.includes(platform.os)) {
    throw new Error(`Invalid platform.os: ${platform.os}`);
  }
}

export function validateLayers(layers) {
  if (!layers || typeof layers !== 'object') {
    throw new TypeError('layers must be an object');
  }
}

export function validateTarget(target) {
  if (!VALID_TARGETS.includes(target)) {
    throw new Error(`Invalid MCP target: ${target}. Must be one of: ${VALID_TARGETS.join(', ')}`);
  }
}

export function validateModelName(model) {
  if (typeof model !== 'string' || !MODEL_NAME_REGEX.test(model)) {
    throw new Error(`Invalid model name: ${model}. Only alphanumeric, dots, colons, slashes, and hyphens allowed.`);
  }
}
