const express = require('express');
const router = express.Router();
const leaveController = require('../controllers/leave.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

router.use(authMiddleware);

// Leave Requests (Employee & All Roles)
router.post('/apply', leaveController.applyLeave);
router.get('/my', leaveController.getMyLeaves);
router.put('/:id/update', leaveController.updateLeaveRequest);
router.post('/cancel', leaveController.cancelLeave);

// Leave Management & Approvals (Super Admin / HR)
router.get('/pending', roleMiddleware(['SUPER_ADMIN']), leaveController.getPendingRequests);
router.post('/approve', roleMiddleware(['SUPER_ADMIN']), leaveController.approveLeave);
router.post('/reject', roleMiddleware(['SUPER_ADMIN']), leaveController.rejectLeave);
router.get('/all', roleMiddleware(['SUPER_ADMIN', 'HR']), leaveController.getCompanyLeaves);

// Leave Balances
router.get('/balance/my', leaveController.getMyLeaves);
router.get('/balance/:userId', roleMiddleware(['SUPER_ADMIN', 'HR']), leaveController.getUserBalances);
router.post('/balance/adjust', roleMiddleware(['SUPER_ADMIN', 'HR']), leaveController.adjustBalance);

module.exports = router;
