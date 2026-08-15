const InternalTicket = require('../models/InternalTicket');
const InternalTicketResponse = require('../models/InternalTicketResponse');
const User = require('../models/User');
const RoleMaster = require('../models/RoleMaster');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Helper to check user role code
 */
async function getUserRoleCode(user) {
  if (!user) return '';
  if (user.roleId && typeof user.roleId === 'object' && user.roleId.roleCode) {
    return user.roleId.roleCode;
  }
  if (user.roleId) {
    const role = await RoleMaster.findById(user.roleId);
    return role ? role.roleCode : '';
  }
  return '';
}

/**
 * POST /api/internal-tickets/create
 * Raise internal support ticket (Any Employee)
 */
exports.createTicket = async (req, res) => {
  try {
    const { category = 'OTHER', subject, description, priority = 'Medium', attachments = [] } = req.body;
    const userId = req.user._id || req.user.id;

    if (!subject || !subject.trim() || !description || !description.trim()) {
      return sendError(res, 400, 'subject and description are required.');
    }

    const ticket = await InternalTicket.create({
      raisedBy: userId,
      category: category.toUpperCase(),
      subject: subject.trim(),
      description: description.trim(),
      priority,
      attachments: Array.isArray(attachments) ? attachments : [],
      status: 'OPEN'
    });

    const populated = await InternalTicket.findById(ticket._id)
      .populate('raisedBy', 'name email designation department');

    return sendSuccess(res, 201, 'Internal ticket created successfully.', { ticket: populated });
  } catch (error) {
    console.error('Error creating internal ticket:', error);
    return sendError(res, 500, error.message || 'Failed to create internal ticket.');
  }
};

/**
 * GET /api/internal-tickets/my
 * Get tickets raised by calling employee
 */
exports.getMyTickets = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { status, page = 1, limit = 20 } = req.query;

    const filter = { raisedBy: userId };
    if (status) filter.status = status.toUpperCase();

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const tickets = await InternalTicket.find(filter)
      .populate('assignedTo', 'name email designation')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalCount = await InternalTicket.countDocuments(filter);

    return sendSuccess(res, 200, 'My internal tickets retrieved successfully.', {
      tickets,
      totalCount,
      page: parseInt(page),
      totalPages: Math.ceil(totalCount / parseInt(limit))
    });
  } catch (error) {
    console.error('Error fetching my internal tickets:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve tickets.');
  }
};

/**
 * GET /api/internal-tickets/all
 * HR/Admin/Super Admin filterable list of all internal tickets
 */
exports.getAllTickets = async (req, res) => {
  try {
    const roleCode = await getUserRoleCode(req.user);
    if (!['HR', 'ADMIN', 'SUPER_ADMIN', 'PROJECT_MANAGER'].includes(roleCode)) {
      return sendError(res, 403, 'Access denied. Management role required.');
    }

    const { status, category, priority, assignedTo, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (status) filter.status = status.toUpperCase();
    if (category) filter.category = category.toUpperCase();
    if (priority) filter.priority = priority;
    if (assignedTo) filter.assignedTo = assignedTo;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const tickets = await InternalTicket.find(filter)
      .populate('raisedBy', 'name email designation department')
      .populate('assignedTo', 'name email designation')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalCount = await InternalTicket.countDocuments(filter);

    return sendSuccess(res, 200, 'All internal tickets retrieved successfully.', {
      tickets,
      totalCount,
      page: parseInt(page),
      totalPages: Math.ceil(totalCount / parseInt(limit))
    });
  } catch (error) {
    console.error('Error fetching all internal tickets:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve internal tickets.');
  }
};

/**
 * GET /api/internal-tickets/:id
 */
exports.getTicketById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req.user._id || req.user.id).toString();
    const roleCode = await getUserRoleCode(req.user);

    const ticket = await InternalTicket.findById(id)
      .populate('raisedBy', 'name email designation department')
      .populate('assignedTo', 'name email designation');

    if (!ticket) {
      return sendError(res, 404, 'Internal ticket not found.');
    }

    const isOwner = ticket.raisedBy._id.toString() === userId;
    const isAssigned = ticket.assignedTo && ticket.assignedTo._id.toString() === userId;
    const isManager = ['HR', 'ADMIN', 'SUPER_ADMIN'].includes(roleCode);

    if (!isOwner && !isAssigned && !isManager) {
      return sendError(res, 403, 'Access denied. You do not have permission to view this ticket.');
    }

    const responses = await InternalTicketResponse.find({ ticketId: id })
      .populate('respondedBy', 'name email designation')
      .sort({ createdAt: 1 });

    return sendSuccess(res, 200, 'Internal ticket details retrieved successfully.', { ticket, responses });
  } catch (error) {
    console.error('Error fetching internal ticket by ID:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve ticket detail.');
  }
};

/**
 * POST /api/internal-tickets/:id/respond
 */
exports.respondToTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const userId = req.user._id || req.user.id;

    if (!message || !message.trim()) {
      return sendError(res, 400, 'message text is required.');
    }

    const ticket = await InternalTicket.findById(id);
    if (!ticket) {
      return sendError(res, 404, 'Internal ticket not found.');
    }

    const responseDoc = await InternalTicketResponse.create({
      ticketId: id,
      respondedBy: userId,
      message: message.trim(),
      respondedAt: new Date()
    });

    const populated = await InternalTicketResponse.findById(responseDoc._id)
      .populate('respondedBy', 'name email designation');

    return sendSuccess(res, 201, 'Response posted to internal ticket.', { response: populated });
  } catch (error) {
    console.error('Error responding to internal ticket:', error);
    return sendError(res, 500, error.message || 'Failed to post response.');
  }
};

/**
 * PUT /api/internal-tickets/:id/status
 */
exports.updateTicketStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = (req.user._id || req.user.id).toString();
    const roleCode = await getUserRoleCode(req.user);

    if (!status || !['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED'].includes(status.toUpperCase())) {
      return sendError(res, 400, 'Valid status enum is required (OPEN, IN_PROGRESS, RESOLVED, CLOSED, CANCELLED).');
    }

    const ticket = await InternalTicket.findById(id);
    if (!ticket) {
      return sendError(res, 404, 'Internal ticket not found.');
    }

    const isAssigned = ticket.assignedTo && ticket.assignedTo.toString() === userId;
    const isManager = ['HR', 'ADMIN', 'SUPER_ADMIN'].includes(roleCode);

    if (!isAssigned && !isManager) {
      return sendError(res, 403, 'Access denied. Only assigned staff or managers can update ticket status.');
    }

    const upperStatus = status.toUpperCase();
    ticket.status = upperStatus;

    if (upperStatus === 'RESOLVED') ticket.resolvedAt = new Date();
    if (upperStatus === 'CLOSED') ticket.closedAt = new Date();

    await ticket.save();

    return sendSuccess(res, 200, `Internal ticket status updated to ${upperStatus}.`, { ticket });
  } catch (error) {
    console.error('Error updating internal ticket status:', error);
    return sendError(res, 500, error.message || 'Failed to update status.');
  }
};

/**
 * PUT /api/internal-tickets/:id/assign
 */
exports.assignTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedTo } = req.body;
    const roleCode = await getUserRoleCode(req.user);

    if (!['HR', 'ADMIN', 'SUPER_ADMIN'].includes(roleCode)) {
      return sendError(res, 403, 'Access denied. HR/Admin privileges required to assign tickets.');
    }

    const ticket = await InternalTicket.findById(id);
    if (!ticket) {
      return sendError(res, 404, 'Internal ticket not found.');
    }

    if (assignedTo) {
      const assignee = await User.findById(assignedTo);
      if (!assignee) return sendError(res, 404, 'Assignee employee not found.');
      ticket.assignedTo = assignedTo;
      if (ticket.status === 'OPEN') ticket.status = 'IN_PROGRESS';
    } else {
      ticket.assignedTo = null;
    }

    await ticket.save();

    const populated = await InternalTicket.findById(id)
      .populate('assignedTo', 'name email designation');

    return sendSuccess(res, 200, 'Ticket assigned successfully.', { ticket: populated });
  } catch (error) {
    console.error('Error assigning internal ticket:', error);
    return sendError(res, 500, error.message || 'Failed to assign ticket.');
  }
};

/**
 * POST /api/internal-tickets/:id/reopen
 */
exports.reopenTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req.user._id || req.user.id).toString();

    const ticket = await InternalTicket.findById(id);
    if (!ticket) {
      return sendError(res, 404, 'Internal ticket not found.');
    }

    if (ticket.raisedBy.toString() !== userId) {
      return sendError(res, 403, 'Only the employee who raised this ticket can reopen it.');
    }

    if (!['RESOLVED', 'CLOSED'].includes(ticket.status)) {
      return sendError(res, 400, `Cannot reopen ticket from status "${ticket.status}". Must be RESOLVED or CLOSED.`);
    }

    ticket.status = 'OPEN';
    ticket.reopenedCount += 1;
    ticket.resolvedAt = null;
    ticket.closedAt = null;
    await ticket.save();

    return sendSuccess(res, 200, 'Internal ticket reopened successfully.', { ticket });
  } catch (error) {
    console.error('Error reopening internal ticket:', error);
    return sendError(res, 500, error.message || 'Failed to reopen ticket.');
  }
};

/**
 * POST /api/internal-tickets/:id/cancel
 */
exports.cancelTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req.user._id || req.user.id).toString();

    const ticket = await InternalTicket.findById(id);
    if (!ticket) {
      return sendError(res, 404, 'Internal ticket not found.');
    }

    if (ticket.raisedBy.toString() !== userId) {
      return sendError(res, 403, 'Only the employee who raised this ticket can cancel it.');
    }

    if (['RESOLVED', 'CLOSED', 'CANCELLED'].includes(ticket.status)) {
      return sendError(res, 400, `Cannot cancel ticket already in status "${ticket.status}".`);
    }

    ticket.status = 'CANCELLED';
    await ticket.save();

    return sendSuccess(res, 200, 'Internal ticket cancelled successfully.', { ticket });
  } catch (error) {
    console.error('Error cancelling internal ticket:', error);
    return sendError(res, 500, error.message || 'Failed to cancel ticket.');
  }
};
