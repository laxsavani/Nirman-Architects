/**
 * URL Sanitizer Middleware
 * Collapses duplicate consecutive slashes in the request URL.
 */
module.exports = (req, res, next) => {
  const sanitizedUrl = req.url.replace(/\/\/+/g, '/');
  if (req.url !== sanitizedUrl) {
    req.url = sanitizedUrl;
  }
  next();
};
