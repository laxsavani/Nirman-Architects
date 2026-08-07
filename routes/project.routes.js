const express = require('express');
const router = express.Router();
const projectController = require('../controllers/project.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

router.use(authMiddleware);

// Project CRUD
router.post('/create', roleMiddleware(['PROJECT_MANAGER', 'ADMIN', 'SUPER_ADMIN']), projectController.createProject);
router.get('/', projectController.getProjects);
router.get('/:id', projectController.getProjectById);
router.put('/:id', roleMiddleware(['PROJECT_MANAGER', 'ADMIN', 'SUPER_ADMIN']), projectController.updateProject);

// Status Management & Audit History
router.put('/:id/update-status', roleMiddleware(['PROJECT_MANAGER', 'ADMIN', 'SUPER_ADMIN']), projectController.updateStatus);
router.get('/:id/status-history', projectController.getStatusHistory);

// Milestones & Progress
router.post('/:id/milestones/add', roleMiddleware(['PROJECT_MANAGER', 'ADMIN', 'SUPER_ADMIN']), projectController.addMilestone);
router.put('/:id/milestones/:milestoneId/complete', roleMiddleware(['PROJECT_MANAGER', 'ADMIN', 'SUPER_ADMIN', 'ARCHITECT', 'DESIGNER']), projectController.completeMilestone);
router.put('/:id/milestones/:milestoneId', roleMiddleware(['PROJECT_MANAGER', 'ADMIN', 'SUPER_ADMIN']), projectController.updateMilestone);
router.delete('/:id/milestones/:milestoneId', roleMiddleware(['PROJECT_MANAGER', 'ADMIN', 'SUPER_ADMIN']), projectController.deleteMilestone);
router.put('/:id/progress', roleMiddleware(['PROJECT_MANAGER', 'ADMIN', 'SUPER_ADMIN']), projectController.updateProgress);

// Team Assignment
router.post('/:id/team/assign', roleMiddleware(['PROJECT_MANAGER', 'ADMIN', 'SUPER_ADMIN']), projectController.assignTeamMember);
router.delete('/:id/team/:userId/remove', roleMiddleware(['PROJECT_MANAGER', 'ADMIN', 'SUPER_ADMIN']), projectController.removeTeamMember);
router.put('/:id/team/:userId/role', roleMiddleware(['PROJECT_MANAGER', 'ADMIN', 'SUPER_ADMIN']), projectController.updateTeamRole);
router.get('/:id/team', projectController.getTeamMembers);

// Responsibility Matrix
router.post('/:id/responsibility-matrix/add', roleMiddleware(['PROJECT_MANAGER', 'ADMIN', 'SUPER_ADMIN']), projectController.addResponsibilityMatrix);
router.get('/:id/responsibility-matrix', projectController.getResponsibilityMatrix);

// Progress Breakdown Placeholder
router.get('/:id/progress-breakdown', projectController.getProgressBreakdown);

module.exports = router;
