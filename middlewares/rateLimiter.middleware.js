const loginAttempts = new Map();

/**
 * Lightweight In-Memory Rate Limiter Middleware for Auth Endpoints
 * Limits requests per IP within a window to prevent brute-force attacks.
 */
module.exports = (maxRequests = 10, windowMs = 15 * 60 * 1000) => {
  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    if (!loginAttempts.has(ip)) {
      loginAttempts.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }

    const record = loginAttempts.get(ip);
    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + windowMs;
      return next();
    }

    record.count += 1;
    if (record.count > maxRequests) {
      const retrySecs = Math.ceil((record.resetTime - now) / 1000);
      return res.status(429).json({
        success: false,
        message: `Too many login attempts from this IP. Please try again in ${retrySecs} seconds.`
      });
    }

    next();
  };
};
