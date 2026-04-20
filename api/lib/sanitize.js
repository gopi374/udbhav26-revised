/**
 * api/lib/sanitize.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared input sanitization utilities.
 * Strips HTML tags, script injection, NoSQL operators, and enforces length caps.
 * Used in every public-facing API endpoint.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Strip HTML tags, script content, and dangerous characters from a string.
 * Returns plain text only.
 */
export function sanitizeText(val, maxLen = 200) {
  if (val == null) return '';
  let s = String(val);
  // Remove script/style/html tags and their content
  s = s.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
  s = s.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '');
  // Strip all remaining HTML tags
  s = s.replace(/<[^>]*>/g, '');
  // Remove MongoDB NoSQL injection operators ($, {, })
  s = s.replace(/[${}]/g, '');
  // Remove null bytes
  s = s.replace(/\0/g, '');
  // Trim whitespace
  s = s.trim();
  // Enforce max length
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

/**
 * Sanitize an email address — only allow valid email characters.
 */
export function sanitizeEmail(val, maxLen = 254) {
  if (val == null) return '';
  let s = String(val).toLowerCase().trim();
  // Keep only chars valid in an email
  s = s.replace(/[^a-z0-9._%+\-@]/g, '');
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

/**
 * Sanitize a phone number — keep only digits, +, spaces, -.
 */
export function sanitizePhone(val, maxLen = 15) {
  if (val == null) return '';
  let s = String(val).trim();
  s = s.replace(/[^0-9+\-\s]/g, '');
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

/**
 * Sanitize a team code — only allow alphanumeric + hyphens.
 */
export function sanitizeCode(val, maxLen = 30) {
  if (val == null) return '';
  let s = String(val).toUpperCase().trim();
  s = s.replace(/[^A-Z0-9\-]/g, '');
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

/**
 * Validate an email address format.
 */
export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validate a phone number (10 digits for Indian numbers).
 */
export function isValidPhone(phone) {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 12;
}
