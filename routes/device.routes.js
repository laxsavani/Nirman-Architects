const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/device.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// Apply auth middleware to all device endpoints
router.use(authMiddleware);

router.post('/register', deviceController.registerDevice);
router.post('/heartbeat', deviceController.heartbeat);
router.get('/status', deviceController.getDeviceStatus);
router.get('/pending', deviceController.getPendingRequests);
router.post('/approve', deviceController.approveDevice);
router.post('/assign', deviceController.assignDevice);

module.exports = router;
