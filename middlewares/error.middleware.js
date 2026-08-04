/**
 * Global Error Handler Middleware
 * Catch-all for Express application exceptions.
 */
module.exports = (err, req, res, next) => {
  console.error("❌ Error encountered:", err.message || err);
  
  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    success: false,
    error: {
      message: err.message || "Internal Server Error",
      status: statusCode
    }
  });
};
