const ClientTicket = require('../models/ClientTicket');
const ClientTicketResponse = require('../models/ClientTicketResponse');
const ClientTicketAssignmentLog = require('../models/ClientTicketAssignmentLog');
const User = require('../models/User');
const NotificationDispatcher = require('../utils/notificationDispatcher');
const { sendSuccess, sendError } = require('../utils/response');
const { emitToProjectRoom } = require('../utils/socket');

/**
 * GET /api/tickets/all?status=&priority=&assignedTo=&projectId=&clientId=
 * Get all client support tickets for Internal Team (PM / Admin / SuperAdmin).
 */
exports.getAllTickets = async (req, res) => {
  try {
    const { status, priority, assignedTo, projectId, clientId } = req.query;

    const filter = {};
    if (status) filter.status = status.toUpperCase();
    if (priority) filter.priority = priority;
    if (assignedTo) filter.assignedTo = assignedTo;
    if (projectId) filter.projectId = projectId;
    if (clientId) filter.clientId = clientId;

    const rawTickets = await ClientTicket.find(filter)
      .populate('clientId', 'companyName clientName email phone')
      .populate('projectId', 'name projectNumber status')
      .populate('raisedBy', 'name email phone permissionLevel isPrimaryContact')
      .populate('assignedTo', 'name email designation department')
      .sort({ createdAt: -1 });

    const tickets = rawTickets.map(t => {
      const tObj = t.toObject();
      if (tObj.raisedBy) {
        tObj.formattedRaisedBy = `${tObj.raisedBy.name} (${tObj.raisedBy.permissionLevel || 'Contact'})`;
      }
      if (tObj.assignedTo) {
        tObj.formattedAssignedTo = `${tObj.assignedTo.name} (${tObj.assignedTo.designation || 'Staff'})`;
      }
      return tObj;
    });

    return sendSuccess(res, 200, 'All client support tickets retrieved successfully.', {
      count: tickets.length,
      tickets
    });
  } catch (error) {
    console.error('Error retrieving all tickets for internal team:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve tickets.');
  }
};

/**
 * POST /api/tickets/:id/respond
 * Add an internal employee response to a ticket thread.
 */
exports.respondToTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const userId = req.user.id || req.user._id;

    if (!message || !message.trim()) {
      return sendError(res, 400, 'Message content is required.');
    }

    const ticket = await ClientTicket.findById(id);
    if (!ticket) {
      return sendError(res, 404, 'Ticket not found.');
    }

    if (['CLOSED', 'CANCELLED'].includes(ticket.status)) {
      return sendError(res, 400, `Cannot respond to ticket with status ${ticket.status}.`);
    }

    let attachments = [];
    if (req.files && Array.isArray(req.files)) {
      attachments = req.files.map(f => f.path.replace(/\\/g, '/'));
    } else if (req.body.attachments && Array.isArray(req.body.attachments)) {
      attachments = req.body.attachments;
    }

    const responseDoc = await ClientTicketResponse.create({
      ticketId: id,
      authorType: 'EMPLOYEE',
      authorId: userId,
      authorModel: 'User',
      message: message.trim(),
      attachments,
      respondedAt: new Date()
    });

    // Auto move OPEN -> IN_PROGRESS on first staff response if still OPEN
    if (ticket.status === 'OPEN') {
      ticket.status = 'IN_PROGRESS';
      await ticket.save();
    }

    const populatedResponse = await ClientTicketResponse.findById(responseDoc._id)
      .populate('authorId', 'name email designation department');

    const rObj = populatedResponse.toObject();
    const desig = rObj.authorId ? rObj.authorId.designation : 'Staff';
    rObj.formattedAuthorName = `${rObj.authorId ? rObj.authorId.name : 'Staff'} (${desig})`;

    emitToProjectRoom(ticket.projectId.toString(), 'ticket_response_added', { ticketId: id, response: rObj });

    // CRM Module 10 Hookpoint: Notify client contact of new staff response
    await NotificationDispatcher.dispatch({
      contactIds: [ticket.raisedBy],
      type: 'TICKET_NEW_RESPONSE',
      title: 'New Response on Support Ticket',
      message: `Staff member ${rObj.formattedAuthorName} added a response to your ticket "${ticket.subject}".`,
      deepLink: `client/tickets/${ticket._id}`,
      refId: ticket._id,
      projectId: ticket.projectId,
      clientId: ticket.clientId
    }).catch(err => console.warn('[Notification Error] Ticket response notification failed:', err.message));

    return sendSuccess(res, 201, 'Staff response added successfully.', { response: rObj, ticketStatus: ticket.status });
  } catch (error) {
    console.error('Error adding staff response to ticket:', error);
    return sendError(res, 500, error.message || 'Failed to add staff response.');
  }
};

/**
 * PUT /api/tickets/:id/status
 * Update ticket lifecycle status (IN_PROGRESS, RESOLVED, CLOSED, etc.).
 */
exports.updateTicketStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { newStatus, status } = req.body;
    const targetStatus = (newStatus || status || '').toUpperCase();

    const validStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED'];
    if (!validStatuses.includes(targetStatus)) {
      return sendError(res, 400, `Invalid ticket status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const ticket = await ClientTicket.findById(id);
    if (!ticket) {
      return sendError(res, 404, 'Ticket not found.');
    }

    ticket.status = targetStatus;
    if (targetStatus === 'RESOLVED') {
      ticket.resolvedAt = new Date();
    } else if (targetStatus === 'CLOSED') {
      ticket.closedAt = new Date();
      if (!ticket.resolvedAt) {
        ticket.resolvedAt = new Date();
      }
    }
    await ticket.save();

    const updatedTicket = await ClientTicket.findById(id)
      .populate('raisedBy', 'name email permissionLevel')
      .populate('assignedTo', 'name email designation')
      .populate('projectId', 'name projectNumber');

    emitToProjectRoom(ticket.projectId.toString(), 'ticket_status_changed', { ticketId: id, status: targetStatus, ticket: updatedTicket });

    // CRM Module 10 Hookpoint: Notify client contact of status update
    await NotificationDispatcher.dispatch({
      contactIds: [ticket.raisedBy],
      type: 'TICKET_STATUS_CHANGED',
      title: 'Ticket Status Updated',
      message: `Your ticket "${ticket.subject}" has been marked as ${targetStatus}.`,
      deepLink: `client/tickets/${ticket._id}`,
      refId: ticket._id,
      projectId: ticket.projectId,
      clientId: ticket.clientId
    }).catch(err => console.warn('[Notification Error] Ticket status notification failed:', err.message));

    return sendSuccess(res, 200, `Ticket status updated to ${targetStatus} successfully.`, { ticket: updatedTicket });
  } catch (error) {
    console.error('Error updating ticket status:', error);
    return sendError(res, 500, error.message || 'Failed to update ticket status.');
  }
};

/**
 * PUT /api/tickets/:id/reassign
 * Reassign ticket to a different internal staff member and log history.
 */
exports.reassignTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { newAssignedTo } = req.body;
    const reassignedBy = req.user.id || req.user._id;

    if (!newAssignedTo) {
      return sendError(res, 400, 'newAssignedTo (User ID) is required.');
    }

    const targetUser = await User.findById(newAssignedTo);
    if (!targetUser) {
      return sendError(res, 404, 'Target employee user not found.');
    }

    const ticket = await ClientTicket.findById(id);
    if (!ticket) {
      return sendError(res, 404, 'Ticket not found.');
    }

    const previousAssignedTo = ticket.assignedTo;
    ticket.assignedTo = newAssignedTo;
    await ticket.save();

    // Log assignment history
    const assignmentLog = await ClientTicketAssignmentLog.create({
      ticketId: id,
      fromUserId: previousAssignedTo,
      toUserId: newAssignedTo,
      reassignedBy,
      reassignedAt: new Date()
    });

    const updatedTicket = await ClientTicket.findById(id)
      .populate('assignedTo', 'name email designation department')
      .populate('projectId', 'name projectNumber');

    emitToProjectRoom(ticket.projectId.toString(), 'ticket_reassigned', { ticketId: id, newAssignedTo: updatedTicket.assignedTo });

    return sendSuccess(res, 200, 'Ticket reassigned successfully.', {
      ticket: updatedTicket,
      assignmentLog
    });
  } catch (error) {
    console.error('Error reassigning ticket:', error);
    return sendError(res, 500, error.message || 'Failed to reassign ticket.');
  }
};
