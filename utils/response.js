/**
 * Sends a structured success JSON response.
 * @param {object} res - Express response object.
 * @param {number} statusCode - HTTP status code.
 * @param {string} message - Response message.
 * @param {object} [data={}] - Response payload data.
 */
const sendSuccess = (res, statusCode, message, data = {}) => {
  const payload = data && typeof data.toObject === 'function' ? data.toObject() : data;
  return res.status(statusCode).json({
    success: true,
    message,
    ...payload
  });
};

/**
 * Sends a structured error JSON response.
 * @param {object} res - Express response object.
 * @param {number} statusCode - HTTP status code.
 * @param {string} message - Error message.
 */
const sendError = (res, statusCode, message) => {
  return res.status(statusCode).json({
    success: false,
    message
  });
};

module.exports = {
  sendSuccess,
  sendError
};
