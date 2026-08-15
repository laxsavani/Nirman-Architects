const express = require('express');
const router = express.Router();
const adminDashboardController = require('../controllers/adminDashboard.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.use(authMiddleware);

router.get('/', adminDashboardController.getHealthConfig);
router.put('/', adminDashboardController.updateHealthConfig);

module.exports = router;
