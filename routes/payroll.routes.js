const express = require('express');
const router = express.Router();
const payrollController = require('../controllers/payroll.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

router.use(authMiddleware);

// Self endpoints
router.get('/my', payrollController.getMyPayroll);
router.get('/my/download', payrollController.downloadOwnPayslip);

// Admin & HR endpoints
router.get('/all', roleMiddleware(['SUPER_ADMIN', 'HR']), payrollController.getAllPayroll);
router.post('/generate', roleMiddleware(['SUPER_ADMIN']), payrollController.generateAllPayroll);
router.post('/generate/:userId', roleMiddleware(['SUPER_ADMIN']), payrollController.generateSingleUserPayroll);
router.get('/download-all', roleMiddleware(['SUPER_ADMIN']), payrollController.downloadAllPayslipsZip);
router.get('/download/:userId', roleMiddleware(['SUPER_ADMIN']), payrollController.downloadEmployeePayslip);

module.exports = router;
