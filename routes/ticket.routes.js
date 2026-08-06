const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ticketController = require('../controllers/ticket.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');
const { getStorageRoot } = require('../utils/storagePathResolver');

const allowedRoles = ['PROJECT_MANAGER', 'ADMIN', 'SUPER_ADMIN', 'HR', 'ARCHITECT'];

// Configure Multer storage for staff ticket response attachments
const ticketStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(getStorageRoot(), 'tickets');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `staff-ticket-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: ticketStorage,
  limits: { fileSize: 15 * 1024 * 1024 }
});

/**
 * Internal Team Ticket Management Routes
 * Mounted at /api/tickets
 */
router.use(authMiddleware);

// List all client tickets across projects (PM / Admin / SuperAdmin / HR / Architect)
router.get('/all', roleMiddleware(allowedRoles), ticketController.getAllTickets);

// Add internal staff response to a ticket thread
router.post('/:id/respond', roleMiddleware(allowedRoles), upload.array('attachments', 5), ticketController.respondToTicket);

// Update ticket lifecycle status (IN_PROGRESS, RESOLVED, CLOSED, etc.)
router.put('/:id/status', roleMiddleware(allowedRoles), ticketController.updateTicketStatus);

// Reassign ticket to another internal employee
router.put('/:id/reassign', roleMiddleware(allowedRoles), ticketController.reassignTicket);

module.exports = router;
