const loginAttempts = new Map();

// Stepped lockout durations in milliseconds:
// 1st lockout (after 5 failed requests): 3 minutes
// 2nd lockout (after 5 failed requests): 5 minutes
// 3rd lockout (after 5 failed requests): 10 minutes
// 4th+ lockout (after 5 failed requests): 15 minutes
const LOCK_DURATIONS_MS = [
  3 * 60 * 1000,   // Tier 1: 3 minutes
  5 * 60 * 1000,   // Tier 2: 5 minutes
  10 * 60 * 1000,  // Tier 3: 10 minutes
  15 * 60 * 1000   // Tier 4+: 15 minutes
];

const INACTIVITY_RESET_MS = 60 * 60 * 1000; // 1 hour of inactivity resets lock tier back to 0

/**
 * Progressive Stepped Rate Limiter Middleware for Auth Endpoints
 * 5 failed attempts -> 3 mins lock -> 5 mins lock -> 10 mins lock -> 15 mins lock
 */
const rateLimiter = (maxRequests = 5) => {
  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    if (!loginAttempts.has(ip)) {
      loginAttempts.set(ip, {
        count: 1,
        lockLevel: 0,
        resetTime: 0,
        lastAttemptTime: now
      });
      return next();
    }

    const record = loginAttempts.get(ip);

    // Auto-reset lock level if IP was inactive for over 1 hour
    if (now - record.lastAttemptTime > INACTIVITY_RESET_MS) {
      record.count = 1;
      record.lockLevel = 0;
      record.resetTime = 0;
      record.lastAttemptTime = now;
      return next();
    }

    record.lastAttemptTime = now;

    // Check if currently locked out
    if (now < record.resetTime) {
      const retrySecs = Math.ceil((record.resetTime - now) / 1000);
      const retryMins = Math.ceil(retrySecs / 60);
      const activeLockIndex = Math.max(0, record.lockLevel - 1);
      const lockDurationMins = Math.round(LOCK_DURATIONS_MS[Math.min(activeLockIndex, LOCK_DURATIONS_MS.length - 1)] / 60000);

      return res.status(429).json({
        success: false,
        message: `Too many login attempts (maximum ${maxRequests} allowed). Account locked for ${lockDurationMins} minute(s). Please try again in ${retryMins} minute(s).`
      });
    }

    // Previous lock expired -> reset request counter for new round
    if (record.resetTime > 0 && now >= record.resetTime) {
      record.count = 1;
      record.resetTime = 0;
      return next();
    }

    // Increment request count within active window
    record.count += 1;

    if (record.count > maxRequests) {
      // Determine lock duration based on current lockLevel tier
      const lockIndex = Math.min(record.lockLevel, LOCK_DURATIONS_MS.length - 1);
      const lockDurationMs = LOCK_DURATIONS_MS[lockIndex];
      const lockDurationMins = Math.round(lockDurationMs / (60 * 1000));

      record.resetTime = now + lockDurationMs;
      record.lockLevel += 1; // Elevate to next tier for subsequent failures

      const retrySecs = Math.ceil(lockDurationMs / 1000);
      const retryMins = Math.ceil(retrySecs / 60);

      return res.status(429).json({
        success: false,
        message: `Too many login attempts (maximum ${maxRequests} allowed). Locked for ${lockDurationMins} minute(s). Please try again in ${retryMins} minute(s).`
      });
    }

    next();
  };
};

/**
 * Helper to reset rate limit state on successful login
 */
const clearRateLimit = (req) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  loginAttempts.delete(ip);
};

module.exports = rateLimiter;
module.exports.clearRateLimit = clearRateLimit;
module.exports.loginAttempts = loginAttempts;
