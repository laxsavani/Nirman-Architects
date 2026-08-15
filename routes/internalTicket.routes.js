const express = require('express');
const router = express.Router();
const internalTicketController = require('../controllers/internalTicket.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.use(authMiddleware);

// Employee CRUD
router.post('/create', internalTicketController.createTicket);
router.get('/my', internalTicketController.getMyTickets);
router.get('/all', internalTicketController.getAllTickets);
router.get('/:id', internalTicketController.getTicketById);

// Response Thread
router.post('/:id/respond', internalTicketController.respondToTicket);

// Status & Assignment
router.put('/:id/status', internalTicketController.updateTicketStatus);
router.put('/:id/assign', internalTicketController.assignTicket);
router.post('/:id/reopen', internalTicketController.reopenTicket);
router.post('/:id/cancel', internalTicketController.cancelTicket);

module.exports = router;
