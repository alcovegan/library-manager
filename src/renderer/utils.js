/**
 * Renderer utility functions
 * Pure functions for HTML escaping, URL sanitization, parsing, etc.
 *
 * This module works in both browser (as global functions) and Node.js (as exports)
 */

(function(global) {
  'use strict';

  /**
   * Escapes HTML special characters to prevent XSS
   * @param {*} value - Value to escape
   * @returns {string} Escaped HTML string
   */
  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Sanitizes URL to allow only http(s) protocols
   * @param {string} url - URL to sanitize
   * @returns {string|null} Sanitized URL or null if invalid
   */
  function sanitizeUrl(url) {
    if (!url) return null;
    try {
      const parsed = new URL(String(url));
      if (!parsed.protocol.startsWith('http')) return null;
      return parsed.toString();
    } catch {
      return null;
    }
  }

  /**
   * Parses comma or semicolon separated list into array
   * @param {string} value - Comma/semicolon separated string
   * @returns {string[]} Array of trimmed non-empty strings
   */
  function parseCommaSeparatedList(value) {
    if (!value) return [];
    return String(value)
      .split(/[;,]/)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  /**
   * Parses float value from input element
   * @param {object} el - Input element with value property
   * @returns {number|null} Parsed float or null if invalid
   */
  function parseFloatFromInput(el) {
    if (!el) return null;
    const raw = String(el.value || '').replace(/\s+/g, '').replace(',', '.');
    if (!raw) return null;
    const num = Number(raw);
    return Number.isFinite(num) ? num : null;
  }

  // Export for Node.js (tests)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      escapeHtml,
      sanitizeUrl,
      parseCommaSeparatedList,
      parseFloatFromInput,
    };
  }

  // Make available globally in browser
  if (typeof window !== 'undefined') {
    window.escapeHtml = escapeHtml;
    window.sanitizeUrl = sanitizeUrl;
    window.parseCommaSeparatedList = parseCommaSeparatedList;
    window.parseFloatFromInput = parseFloatFromInput;
  }

})(typeof window !== 'undefined' ? window : global);

