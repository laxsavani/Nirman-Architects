const express = require('express');
const router = express.Router();
const taskController = require('../controllers/task.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

router.use(authMiddleware);

// Overdue & Monitoring
router.get('/overdue', taskController.getOverdueTasks);
router.get('/pending-review-too-long', taskController.getPendingReviewTooLong);

// Task CRUD
router.post('/create', roleMiddleware(['PROJECT_MANAGER', 'ADMIN', 'SUPER_ADMIN']), taskController.createTask);
router.get('/', taskController.getTasks);
router.get('/:id', taskController.getTaskById);
router.put('/:id', roleMiddleware(['PROJECT_MANAGER', 'ADMIN', 'SUPER_ADMIN']), taskController.updateTask);

// Workflow Status Transitions
router.put('/:id/accept', taskController.acceptTask);
router.put('/:id/reject', taskController.rejectTask);
router.put('/:id/start', taskController.startTask);
router.put('/:id/submit-for-review', taskController.submitForReview);
router.put('/:id/approve', roleMiddleware(['PROJECT_MANAGER', 'ADMIN', 'SUPER_ADMIN']), taskController.approveTask);
router.put('/:id/complete', taskController.completeTask);
router.get('/:id/status-history', taskController.getStatusHistory);

// Reassignment
router.put('/:id/reassign', roleMiddleware(['PROJECT_MANAGER', 'ADMIN', 'SUPER_ADMIN']), taskController.reassignTask);

// Checklist
router.post('/:id/checklist/add', taskController.addChecklistItem);
router.put('/:id/checklist/:itemId/toggle', taskController.toggleChecklistItem);
router.delete('/:id/checklist/:itemId', taskController.deleteChecklistItem);

// Comments
router.post('/:id/comments/add', taskController.addComment);
router.get('/:id/comments', taskController.getComments);

// Time Analysis
router.get('/:id/time-analysis', taskController.getTimeAnalysis);

module.exports = router;
