const mongoose = require('mongoose');

/**
 * DB Connector Middleware
 * Monitors connection status. Since Mongoose buffers commands, we warning-log if disconnected
 * but let the request proceed to avoid hard blocking unless necessary.
 */
module.exports = (req, res, next) => {
  const state = mongoose.connection.readyState;
  if (state !== 1 && state !== 2) {
    console.warn(`⚠️ Warning: Database connection state is ${state} (not connected)`);
  }
  next();
};
