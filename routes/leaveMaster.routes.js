const express = require('express');
const router = express.Router();
const leaveMasterController = require('../controllers/leaveMaster.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

// Public or active list endpoint for dynamic dropdowns
router.get('/active', leaveMasterController.getActiveLeaveTypes);

router.use(authMiddleware);

router.get('/all', roleMiddleware(['SUPER_ADMIN']), leaveMasterController.getAllLeaveTypes);
router.post('/create', roleMiddleware(['SUPER_ADMIN']), leaveMasterController.createLeaveType);
router.put('/:id/update', roleMiddleware(['SUPER_ADMIN']), leaveMasterController.updateLeaveType);
router.put('/:id/deactivate', roleMiddleware(['SUPER_ADMIN']), leaveMasterController.deactivateLeaveType);

module.exports = router;
