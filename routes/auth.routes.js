const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const rateLimiter = require('../middlewares/rateLimiter.middleware');

router.post('/register', authController.register);
router.post('/login', rateLimiter(5, 15 * 60 * 1000), authController.login);

module.exports = router;
