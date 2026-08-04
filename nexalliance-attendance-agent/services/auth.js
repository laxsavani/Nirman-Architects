const { createApiClient, saveToken, getStoredToken, clearToken } = require('./api');
const config = require('../config');

/**
 * Authenticates user credentials against backend (supports /auth/login and /login)
 */
async function login(email, password) {
  const trimmedEmail = email ? email.trim() : '';
  const trimmedPassword = password ? password.trim() : '';

  const targetUrls = [
    'https://nirman-architects.onrender.com/api/',
    config.API_BASE_URL,
    'http://localhost:5000/api/'
  ].filter((v, i, a) => Boolean(v) && a.indexOf(v) === i);

  let lastError = null;

  for (const baseUrl of targetUrls) {
    try {
      console.log(`[Auth] Attempting login for user: ${trimmedEmail} via API: ${baseUrl}`);
      const client = createApiClient(null, baseUrl);
      let response;

      try {
        response = await client.post('/auth/login', { email: trimmedEmail, password: trimmedPassword });
      } catch (e) {
        if (e.response && e.response.status === 404) {
          response = await client.post('/login', { email: trimmedEmail, password: trimmedPassword });
        } else {
          throw e;
        }
      }
      
      const data = response.data;
      const token = data.token || (data.data && data.data.token);
      const user = data.user || (data.data && data.data.user);

      if (token) {
        config.API_BASE_URL = baseUrl;
        saveToken({
          token,
          user,
          email: trimmedEmail,
          savedAt: new Date().toISOString()
        });
        console.log(`[Auth] User ${trimmedEmail} logged in successfully using active API: ${baseUrl}`);
        return { success: true, token, user };
      }

      const failureMsg = data.message || 'Login failed: No token returned from server.';
      console.error(`[Auth] Login failed for ${trimmedEmail}: ${failureMsg}`);
      return { success: false, message: failureMsg };
    } catch (error) {
      lastError = error;
      const status = error.response?.status ? ` [HTTP ${error.response.status}]` : '';
      const msg = error.response?.data?.message || error.response?.data?.error || error.message || 'Authentication failed.';
      
      // If server responded authoritatively (400 Invalid credentials, 401 Unauthorized, 403 Deactivated), stop retrying!
      if (error.response && [400, 401, 403].includes(error.response.status)) {
        console.error(`[Auth] Authentication failed on ${baseUrl}: ${msg}${status}`);
        return { success: false, message: msg };
      }

      console.warn(`[Auth] Connection attempt to ${baseUrl} failed: ${msg}${status}. Retrying fallback endpoint...`);
    }
  }

  const msg = lastError?.response?.data?.message || lastError?.response?.data?.error || lastError?.message || 'Authentication failed.';
  console.error(`[Auth] All login API attempts failed for ${trimmedEmail}: ${msg}`);
  return { success: false, message: msg };
}

/**
 * Checks if a valid token exists
 */
function isAuthenticated() {
  const token = getStoredToken();
  return !!token;
}

/**
 * Performs local logout
 */
function logout() {
  clearToken();
  console.log('[Auth] Logged out.');
}

module.exports = {
  login,
  isAuthenticated,
  logout
};
