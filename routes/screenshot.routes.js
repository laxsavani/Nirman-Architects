const express = require('express');
const router = express.Router();
const screenshotController = require('../controllers/screenshot.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

// Config endpoint (accessible by agent to pick up interval settings)
router.get('/config', screenshotController.getConfig);

// Authenticated upload & sync endpoints (called by Electron desktop agent)
// Multer parses multipart file & form fields BEFORE authMiddleware
router.post(
  '/upload',
  screenshotController.upload.single('image'),
  authMiddleware,
  screenshotController.uploadScreenshot
);

router.post(
  '/sync',
  screenshotController.upload.single('image'),
  authMiddleware,
  screenshotController.syncScreenshot
);

// Super Admin Only endpoints
router.put(
  '/config',
  authMiddleware,
  roleMiddleware(['SUPER_ADMIN']),
  screenshotController.updateConfig
);

router.get(
  '/employee/:userId',
  authMiddleware,
  roleMiddleware(['SUPER_ADMIN']),
  screenshotController.getEmployeeScreenshots
);

router.get(
  '/employee/:userId/download-all',
  authMiddleware,
  roleMiddleware(['SUPER_ADMIN']),
  screenshotController.downloadEmployeeScreenshotsZip
);

module.exports = router;
