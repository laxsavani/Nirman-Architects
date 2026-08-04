const express = require('express');
const router = express.Router();
const leadController = require('../controllers/lead.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

// Protect all lead endpoints with auth & allowed roles (Project Manager, Admin, Super Admin, HR)
const allowedLeadRoles = ['PROJECT_MANAGER', 'ADMIN', 'SUPER_ADMIN', 'HR'];

router.use(authMiddleware);
router.use(roleMiddleware(allowedLeadRoles));

/**
 * Lead Management Routes
 */

// Create Lead
router.post('/create', leadController.createLead);
router.post('/', leadController.createLead);

// List Leads (Paginated, Searchable, Scoped)
router.get('/', leadController.getLeads);

// Follow-ups due endpoint (MUST precede /:id route)
router.get('/followups/due', leadController.getDueFollowUps);

// Lead Detail
router.get('/:id', leadController.getLeadById);

// Update Lead General Info
router.put('/:id/update', leadController.updateLead);
router.put('/:id', leadController.updateLead);

// Update Lead Status (Audit Logged)
router.put('/:id/update-status', leadController.updateLeadStatus);

// Log Lead Interaction
router.post('/:id/log-interaction', leadController.logInteraction);

// Get Lead Interactions Timeline
router.get('/:id/interactions', leadController.getLeadInteractions);

// Get Lead Status Audit Trail
router.get('/:id/status-history', leadController.getLeadStatusHistory);

// Convert Lead to Client (Module 2 Stub)
router.post('/:id/convert-to-client', leadController.convertToClientStub);

module.exports = router;
