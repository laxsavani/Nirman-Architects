const axios = require('axios');
const config = require('../config');
const fs = require('fs');

let onUnauthorizedHandler = null;

function setOnUnauthorizedHandler(handler) {
  onUnauthorizedHandler = handler;
}

function handleUnauthorized() {
  clearToken();
  if (typeof onUnauthorizedHandler === 'function') {
    try {
      onUnauthorizedHandler();
    } catch (e) {
      console.error('[API] Error in onUnauthorizedHandler:', e);
    }
  }
}

/**
 * Creates configured Axios instance
 */
function createApiClient(token = null, overrideBaseUrl = null) {
  const headers = {
    'Content-Type': 'application/json'
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const client = axios.create({
    baseURL: overrideBaseUrl || config.API_BASE_URL,
    timeout: 45000, // 45 seconds for Render server cold-start
    headers
  });

  client.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response && error.response.status === 401) {
        console.warn('[API] Received 401 Unauthorized from backend. Invalidating stored session token.');
        handleUnauthorized();
      }
      return Promise.reject(error);
    }
  );

  return client;
}

/**
 * Reads full token object from storage/token.json
 */
function getStoredTokenData() {
  try {
    if (fs.existsSync(config.TOKEN_FILE_PATH)) {
      const data = fs.readFileSync(config.TOKEN_FILE_PATH, 'utf8');
      return JSON.parse(data || '{}');
    }
  } catch (err) {
    console.error('[API] Error reading token.json:', err.message);
  }
  return {};
}

/**
 * Reads token string from storage/token.json
 */
function getStoredToken() {
  const data = getStoredTokenData();
  return data.token || null;
}

/**
 * Saves token to storage/token.json
 */
function saveToken(tokenData) {
  try {
    if (!fs.existsSync(config.STORAGE_DIR)) {
      fs.mkdirSync(config.STORAGE_DIR, { recursive: true });
    }
    const data = typeof tokenData === 'string' ? { token: tokenData, savedAt: new Date().toISOString() } : tokenData;
    fs.writeFileSync(config.TOKEN_FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[API] Error saving token.json:', err.message);
  }
}

/**
 * Clears stored token on logout
 */
function clearToken() {
  try {
    if (fs.existsSync(config.TOKEN_FILE_PATH)) {
      fs.unlinkSync(config.TOKEN_FILE_PATH);
    }
  } catch (err) {
    console.error('[API] Error deleting token.json:', err.message);
  }
}

module.exports = {
  createApiClient,
  getStoredToken,
  getStoredTokenData,
  saveToken,
  clearToken,
  setOnUnauthorizedHandler,
  handleUnauthorized
};

