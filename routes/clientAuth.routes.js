const express = require('express');
const router = express.Router();
const clientAuthController = require('../controllers/clientAuth.controller');
const clientAuthMiddleware = require('../middlewares/clientAuth.middleware');

/**
 * Client Portal Authentication Routes
 */

// Public Auth Endpoints
router.post('/login', clientAuthController.login);
router.post('/forgot-password', clientAuthController.forgotPassword);
router.post('/reset-password', clientAuthController.resetPassword);

// Client-Authenticated Endpoints
router.post('/change-password', clientAuthMiddleware, clientAuthController.changePassword);
router.get('/me', clientAuthMiddleware, clientAuthController.getMe);
router.put('/profile', clientAuthMiddleware, require('../controllers/clientPortal.controller').updateProfile);

module.exports = router;
