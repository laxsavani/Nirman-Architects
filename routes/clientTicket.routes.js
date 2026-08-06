const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const clientTicketController = require('../controllers/clientTicket.controller');
const clientAuthMiddleware = require('../middlewares/clientAuth.middleware');
const { getStorageRoot } = require('../utils/storagePathResolver');

// Configure Multer storage for client ticket attachments
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
    cb(null, `ticket-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: ticketStorage,
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB file size limit
});

/**
 * Client Portal Ticket Routes
 * Mounted at /api/client/tickets
 */
router.use(clientAuthMiddleware);

// Create new ticket
router.post('/create', upload.array('attachments', 5), clientTicketController.createTicket);

// Get client's tickets (shared company visibility)
router.get('/my', clientTicketController.getMyTickets);

// Get ticket detail with full response thread
router.get('/:id', clientTicketController.getTicketDetail);

// Add client response to ticket
router.post('/:id/respond', upload.array('attachments', 5), clientTicketController.respondToTicket);

// Reopen CLOSED ticket within 14-day grace period
router.post('/:id/reopen', clientTicketController.reopenTicket);

// Cancel OPEN / IN_PROGRESS ticket
router.post('/:id/cancel', clientTicketController.cancelTicket);

module.exports = router;
