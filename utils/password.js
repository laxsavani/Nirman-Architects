const bcrypt = require('bcryptjs');

/**
 * Hashes a plain text password using bcryptjs.
 * @param {string} password - The plain text password.
 * @returns {Promise<string>} The hashed password.
 */
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

/**
 * Compares a plain text password with a hashed password.
 * @param {string} password - The plain text password.
 * @param {string} hashedPassword - The hashed password.
 * @returns {Promise<boolean>} True if they match, false otherwise.
 */
const comparePassword = async (password, hashedPassword) => {
  return bcrypt.compare(password, hashedPassword);
};

/**
 * Validates password complexity rules:
 * - Length: 8 to 15 characters
 * - At least 1 uppercase letter (A-Z)
 * - At least 1 lowercase letter (a-z)
 * - At least 1 number (0-9)
 * - At least 1 special character (!@#$%^&*()_+-=[]{};':"|,.<>/?)
 * @param {string} password - Plain text password to validate.
 * @returns {{ valid: boolean, message?: string }} Validation result.
 */
const validatePasswordComplexity = (password) => {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'Password is required and must be a valid text string.' };
  }

  const trimmed = password.trim();

  if (trimmed.length < 8 || trimmed.length > 15) {
    return { valid: false, message: 'Password must be between 8 and 15 characters long.' };
  }

  if (!/[A-Z]/.test(trimmed)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter (A-Z).' };
  }

  if (!/[a-z]/.test(trimmed)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter (a-z).' };
  }

  if (!/\d/.test(trimmed)) {
    return { valid: false, message: 'Password must contain at least one number (0-9).' };
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(trimmed)) {
    return { valid: false, message: 'Password must contain at least one special character (e.g. !@#$%^&*).' };
  }

  return { valid: true };
};

module.exports = {
  hashPassword,
  comparePassword,
  validatePasswordComplexity
};

