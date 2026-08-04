const jwt = require('jsonwebtoken');
const { sendError } = require('../utils/response');

/**
 * Authentication Middleware
 * Validates the JWT token in Authorization header.
 */
module.exports = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 401, 'Access denied. Authorization token required.');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'developer-secret-key-2508');
    
    // Mount the decoded payload onto the request object
    req.user = decoded;
    next();
  } catch (error) {
    return sendError(res, 401, 'Access denied. Invalid or expired token.');
  }
};
