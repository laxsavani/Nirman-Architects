const ClientTicket = require('../models/ClientTicket');
const ClientTicketResponse = require('../models/ClientTicketResponse');
const ClientProjectLink = require('../models/ClientProjectLink');
const Project = require('../models/Project');
const { sendSuccess, sendError } = require('../utils/response');
const { emitToProjectRoom } = require('../utils/socket');
const notifyAdmins = require('../utils/notifyAdmins');

const REOPEN_GRACE_PERIOD_MS = 14 * 24 * 60 * 60 * 1000; // 14 Days

/**
 * Helper to verify client-project security linkage
 */
async function verifyProjectLink(clientId, projectId) {
  return await ClientProjectLink.findOne({
    clientId,
    projectId,
    isActive: true,
    visibleToClient: true
  });
}

/**
 * POST /api/client/tickets/create
 * Creates a new client support ticket (OWNER / MEMBER only). Auto-assigns to Project PM.
 */
exports.createTicket = async (req, res) => {
  try {
    const { projectId, subject, description, priority } = req.body;
    const { clientId, contactId, permissionLevel } = req.clientContact;

    // RBAC: OWNER or MEMBER only
    if (['VIEW_ONLY'].includes(permissionLevel)) {
      return sendError(res, 403, 'Access denied. View Only permission level cannot create support tickets.');
    }

    if (!projectId || !subject || !description) {
      return sendError(res, 400, 'projectId, subject, and description are required fields.');
    }

    // Security Linkage Enforcement
    const link = await verifyProjectLink(clientId, projectId);
    if (!link) {
      return sendError(res, 403, 'Access denied. This project is not linked or visible to your Client account.');
    }

    // Attachment file handling (if uploaded via Multer)
    let attachments = [];
    if (req.files && Array.isArray(req.files)) {
      attachments = req.files.map(file => file.path.replace(/\\/g, '/'));
    } else if (req.body.attachments && Array.isArray(req.body.attachments)) {
      attachments = req.body.attachments;
    }

    // Auto-assignment to assigned PM of the project
    let assignedTo = null;
    const project = await Project.findById(projectId);
    if (project) {
      if (project.projectManager) {
        assignedTo = project.projectManager;
      } else if (project.assignedPM) {
        assignedTo = project.assignedPM;
      }
    }

    const ticket = await ClientTicket.create({
      clientId,
      projectId,
      raisedBy: contactId,
      subject: subject.trim(),
      description: description.trim(),
      priority: ['Low', 'Medium', 'High'].includes(priority) ? priority : 'Medium',
      attachments,
      status: 'OPEN',
      assignedTo
    });

    const populatedTicket = await ClientTicket.findById(ticket._id)
      .populate('raisedBy', 'name email permissionLevel isPrimaryContact')
      .populate('assignedTo', 'name email designation department')
      .populate('projectId', 'name projectNumber');

    // Real-Time Socket Broadcast & Admin Notification
    emitToProjectRoom(projectId, 'ticket_created', { ticket: populatedTicket });
    notifyAdmins('TICKET_CREATED', `[New Client Ticket] ${subject} raised for project ${project ? project.name : projectId}`);

    return sendSuccess(res, 201, 'Support ticket created successfully.', { ticket: populatedTicket });
  } catch (error) {
    console.error('Error creating client ticket:', error);
    return sendError(res, 500, error.message || 'Failed to create support ticket.');
  }
};

/**
 * GET /api/client/tickets/my?status=&projectId=
 * Returns all tickets belonging to the client organization (shared visibility across all contacts of the client).
 */
exports.getMyTickets = async (req, res) => {
  try {
    const { status, projectId } = req.query;
    const { clientId } = req.clientContact;

    const filter = { clientId };
    if (status) {
      filter.status = status.toUpperCase();
    }
    if (projectId) {
      filter.projectId = projectId;
    }

    const rawTickets = await ClientTicket.find(filter)
      .populate('raisedBy', 'name email permissionLevel isPrimaryContact')
      .populate('assignedTo', 'name email designation department')
      .populate('projectId', 'name projectNumber')
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

    return sendSuccess(res, 200, 'Client tickets retrieved successfully.', {
      count: tickets.length,
      tickets
    });
  } catch (error) {
    console.error('Error fetching client tickets:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve client tickets.');
  }
};

/**
 * GET /api/client/tickets/:id
 * Returns ticket detail along with full chronological response thread.
 */
exports.getTicketDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const { clientId } = req.clientContact;

    const ticket = await ClientTicket.findById(id)
      .populate('raisedBy', 'name email phone permissionLevel isPrimaryContact')
      .populate('assignedTo', 'name email phone designation department')
      .populate('projectId', 'name projectNumber status')
      .populate('clientId', 'companyName clientName');

    if (!ticket) {
      return sendError(res, 404, 'Ticket not found.');
    }

    // Security Boundary Check
    if (ticket.clientId._id.toString() !== clientId.toString()) {
      return sendError(res, 403, 'Access denied. You cannot access tickets belonging to another Client account.');
    }

    // Fetch response thread
    const rawResponses = await ClientTicketResponse.find({ ticketId: id })
      .populate('authorId', 'name email phone permissionLevel designation department')
      .sort({ respondedAt: 1, createdAt: 1 });

    const responses = rawResponses.map(resp => {
      const rObj = resp.toObject();
      if (rObj.authorType === 'CLIENT_CONTACT' && rObj.authorId) {
        const role = rObj.authorId.permissionLevel || 'Contact';
        rObj.formattedAuthorName = `${rObj.authorId.name} (${role})`;
      } else if (rObj.authorType === 'EMPLOYEE' && rObj.authorId) {
        const desig = rObj.authorId.designation || 'Staff';
        rObj.formattedAuthorName = `${rObj.authorId.name} (${desig})`;
      } else {
        rObj.formattedAuthorName = 'Unknown Author';
      }
      return rObj;
    });

    const tObj = ticket.toObject();
    if (tObj.raisedBy) {
      tObj.formattedRaisedBy = `${tObj.raisedBy.name} (${tObj.raisedBy.permissionLevel || 'Contact'})`;
    }

    return sendSuccess(res, 200, 'Ticket detail retrieved successfully.', {
      ticket: tObj,
      responses,
      responseCount: responses.length
    });
  } catch (error) {
    console.error('Error fetching ticket detail:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve ticket detail.');
  }
};

/**
 * POST /api/client/tickets/:id/respond
 * Add a client response to a ticket thread (OWNER / MEMBER only).
 */
exports.respondToTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const { clientId, contactId, permissionLevel } = req.clientContact;

    if (['VIEW_ONLY'].includes(permissionLevel)) {
      return sendError(res, 403, 'Access denied. View Only permission level cannot respond to tickets.');
    }

    if (!message || !message.trim()) {
      return sendError(res, 400, 'Message content is required.');
    }

    const ticket = await ClientTicket.findById(id);
    if (!ticket) {
      return sendError(res, 404, 'Ticket not found.');
    }

    if (ticket.clientId.toString() !== clientId.toString()) {
      return sendError(res, 403, 'Access denied. Ticket belongs to a different client account.');
    }

    if (['CLOSED', 'CANCELLED'].includes(ticket.status)) {
      return sendError(res, 400, `Cannot respond to a ticket with status ${ticket.status}. Reopen the ticket first if within grace period.`);
    }

    let attachments = [];
    if (req.files && Array.isArray(req.files)) {
      attachments = req.files.map(f => f.path.replace(/\\/g, '/'));
    } else if (req.body.attachments && Array.isArray(req.body.attachments)) {
      attachments = req.body.attachments;
    }

    const responseDoc = await ClientTicketResponse.create({
      ticketId: id,
      authorType: 'CLIENT_CONTACT',
      authorId: contactId,
      authorModel: 'ClientContact',
      message: message.trim(),
      attachments,
      respondedAt: new Date()
    });

    const populatedResponse = await ClientTicketResponse.findById(responseDoc._id)
      .populate('authorId', 'name email permissionLevel');

    const rObj = populatedResponse.toObject();
    const role = rObj.authorId ? rObj.authorId.permissionLevel : 'Contact';
    rObj.formattedAuthorName = `${rObj.authorId ? rObj.authorId.name : 'Client'} (${role})`;

    emitToProjectRoom(ticket.projectId.toString(), 'ticket_response_added', { ticketId: id, response: rObj });

    return sendSuccess(res, 201, 'Response added successfully.', { response: rObj });
  } catch (error) {
    console.error('Error responding to ticket:', error);
    return sendError(res, 500, error.message || 'Failed to add response.');
  }
};

/**
 * POST /api/client/tickets/:id/reopen
 * Reopen a CLOSED ticket within 14-day grace period (OWNER / MEMBER only).
 */
exports.reopenTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const { clientId, contactId, permissionLevel } = req.clientContact;

    if (['VIEW_ONLY'].includes(permissionLevel)) {
      return sendError(res, 403, 'Access denied. View Only permission level cannot reopen tickets.');
    }

    const ticket = await ClientTicket.findById(id);
    if (!ticket) {
      return sendError(res, 404, 'Ticket not found.');
    }

    if (ticket.clientId.toString() !== clientId.toString()) {
      return sendError(res, 403, 'Access denied.');
    }

    if (ticket.status !== 'CLOSED') {
      return sendError(res, 400, `Only CLOSED tickets can be reopened. Current status: ${ticket.status}.`);
    }

    // Server-side timestamp validation for 14-day grace period
    const closedTime = ticket.closedAt ? new Date(ticket.closedAt).getTime() : new Date(ticket.updatedAt).getTime();
    const timeSinceClosed = Date.now() - closedTime;

    if (timeSinceClosed > REOPEN_GRACE_PERIOD_MS) {
      return sendError(res, 400, 'Reopen grace period of 14 days has expired. Please raise a new ticket for this issue.');
    }

    ticket.status = 'OPEN';
    ticket.reopenedCount = (ticket.reopenedCount || 0) + 1;
    ticket.resolvedAt = null;
    ticket.closedAt = null;
    await ticket.save();

    // Create automated thread response for reopen event
    const reopenMsg = reason && reason.trim() 
      ? `Reopened ticket. Reason: ${reason.trim()}`
      : 'Reopened ticket within 14-day grace period.';

    await ClientTicketResponse.create({
      ticketId: id,
      authorType: 'CLIENT_CONTACT',
      authorId: contactId,
      authorModel: 'ClientContact',
      message: reopenMsg,
      respondedAt: new Date()
    });

    const updatedTicket = await ClientTicket.findById(id)
      .populate('raisedBy', 'name email permissionLevel')
      .populate('assignedTo', 'name email designation')
      .populate('projectId', 'name projectNumber');

    emitToProjectRoom(ticket.projectId.toString(), 'ticket_reopened', { ticketId: id, ticket: updatedTicket });

    return sendSuccess(res, 200, 'Ticket reopened successfully.', { ticket: updatedTicket });
  } catch (error) {
    console.error('Error reopening ticket:', error);
    return sendError(res, 500, error.message || 'Failed to reopen ticket.');
  }
};

/**
 * POST /api/client/tickets/:id/cancel
 * Cancel an OPEN or IN_PROGRESS ticket (OWNER / MEMBER only).
 */
exports.cancelTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { clientId, permissionLevel } = req.clientContact;

    if (['VIEW_ONLY'].includes(permissionLevel)) {
      return sendError(res, 403, 'Access denied. View Only permission level cannot cancel tickets.');
    }

    const ticket = await ClientTicket.findById(id);
    if (!ticket) {
      return sendError(res, 404, 'Ticket not found.');
    }

    if (ticket.clientId.toString() !== clientId.toString()) {
      return sendError(res, 403, 'Access denied.');
    }

    if (!['OPEN', 'IN_PROGRESS'].includes(ticket.status)) {
      return sendError(res, 400, `Cannot cancel ticket with status ${ticket.status}. Cancellation is only permitted for OPEN or IN_PROGRESS tickets.`);
    }

    ticket.status = 'CANCELLED';
    await ticket.save();

    emitToProjectRoom(ticket.projectId.toString(), 'ticket_cancelled', { ticketId: id });

    return sendSuccess(res, 200, 'Ticket cancelled successfully.', { ticket });
  } catch (error) {
    console.error('Error cancelling ticket:', error);
    return sendError(res, 500, error.message || 'Failed to cancel ticket.');
  }
};
