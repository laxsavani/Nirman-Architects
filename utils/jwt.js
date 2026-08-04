const jwt = require('jsonwebtoken');

/**
 * Generates a JSON Web Token for the user.
 * @param {object} payload - The token payload (e.g. { userId, email, role }).
 * @returns {string} The signed JWT.
 */
const generateToken = (payload) => {
  return jwt.sign(
    payload,
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRE }
  );
};

module.exports = {
  generateToken
};
