const Lead = require('../models/Lead');
const LeadInteraction = require('../models/LeadInteraction');
const LeadStatusHistory = require('../models/LeadStatusHistory');
const User = require('../models/User');
const Client = require('../models/Client');
const ClientContact = require('../models/ClientContact');
const ClientContactActionLog = require('../models/ClientContactActionLog');
const { hashPassword } = require('../utils/password');
const { sendSuccess, sendError } = require('../utils/response');


/**
 * Helper to check if current user is Admin / SuperAdmin / HR
 */
const isCompanyWideRole = (user) => {
  const roleCode = (user.roleCode || user.role || '').toUpperCase();
  return ['ADMIN', 'SUPER_ADMIN', 'SUPERADMIN', 'HR'].includes(roleCode);
};

/**
 * Create a new Lead
 * POST /api/leads/create or POST /api/leads
 */
exports.createLead = async (req, res) => {
  try {
    const { name, phone, email, source, requirementNotes, assignedTo, nextFollowUpDate } = req.body;
    const currentUserId = req.user.id || req.user._id;

    if (!name || !phone || !source) {
      return sendError(res, 400, 'Name, phone, and source are required fields.');
    }

    // Default assignedTo to creator if not specified
    const leadAssignedTo = assignedTo || currentUserId;

    // Verify assigned user exists
    const assignedUser = await User.findById(leadAssignedTo);
    if (!assignedUser) {
      return sendError(res, 404, 'Assigned user does not exist.');
    }

    // Check for duplicate phone number among active leads (not WON or LOST)
    const existingActiveLead = await Lead.findOne({
      phone: phone.trim(),
      status: { $nin: ['WON', 'LOST'] }
    });

    const newLead = new Lead({
      name: name.trim(),
      phone: phone.trim(),
      email: email ? email.trim() : null,
      source,
      requirementNotes,
      assignedTo: leadAssignedTo,
      status: 'NEW',
      nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate) : null,
      createdBy: currentUserId
    });

    await newLead.save();

    // Create initial status history entry
    await LeadStatusHistory.create({
      leadId: newLead._id,
      fromStatus: null,
      toStatus: 'NEW',
      changedBy: currentUserId,
      changedAt: new Date()
    });

    let duplicateWarning = false;
    let duplicateLeadInfo = null;

    if (existingActiveLead) {
      duplicateWarning = true;
      duplicateLeadInfo = {
        id: existingActiveLead._id,
        name: existingActiveLead.name,
        status: existingActiveLead.status,
        assignedTo: existingActiveLead.assignedTo
      };
    }

    return sendSuccess(res, 201, 'Lead created successfully.', {
      lead: newLead,
      duplicateWarning,
      ...(duplicateWarning && { duplicateLeadInfo })
    });
  } catch (error) {
    console.error('Error creating lead:', error);
    return sendError(res, 500, error.message || 'Failed to create lead.');
  }
};

/**
 * Get paginated and filtered list of leads
 * GET /api/leads
 */
exports.getLeads = async (req, res) => {
  try {
    const { status, assignedTo, search, page = 1, limit = 10, pipelineView } = req.query;
    const currentUserId = req.user.id || req.user._id;
    const isCompanyWide = isCompanyWideRole(req.user);

    let filter = {};

    // Role-based visibility scoping
    if (!isCompanyWide) {
      // Non-admin roles (e.g. Project Manager) only see leads assigned to themselves
      filter.assignedTo = currentUserId;
    } else if (assignedTo) {
      filter.assignedTo = assignedTo;
    }

    if (status) {
      filter.status = status;
    }

    if (search) {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { name: searchRegex },
        { phone: searchRegex },
        { email: searchRegex }
      ];
    }

    // Kanban / Pipeline view data structure option
    if (pipelineView === 'true' || pipelineView === true) {
      const activeLeads = await Lead.find(filter)
        .populate('assignedTo', 'name email phone department designation')
        .populate('createdBy', 'name email')
        .sort({ updatedAt: -1 });

      const pipeline = {
        NEW: [],
        CONTACTED: [],
        QUALIFIED: [],
        PROPOSAL_SENT: [],
        NEGOTIATION: [],
        closedLeads: []
      };

      activeLeads.forEach(lead => {
        if (pipeline[lead.status]) {
          pipeline[lead.status].push(lead);
        } else {
          pipeline.closedLeads.push(lead);
        }
      });

      return sendSuccess(res, 200, 'Lead pipeline retrieved successfully.', { pipeline });
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    const [leads, total] = await Promise.all([
      Lead.find(filter)
        .populate('assignedTo', 'name email phone department designation')
        .populate('createdBy', 'name email')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Lead.countDocuments(filter)
    ]);

    return sendSuccess(res, 200, 'Leads retrieved successfully.', {
      leads,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching leads:', error);
    return sendError(res, 500, error.message || 'Failed to fetch leads.');
  }
};

/**
 * Get lead details by ID
 * GET /api/leads/:id
 */
exports.getLeadById = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user.id || req.user._id;
    const isCompanyWide = isCompanyWideRole(req.user);

    const lead = await Lead.findById(id)
      .populate('assignedTo', 'name email phone department designation')
      .populate('createdBy', 'name email');

    if (!lead) {
      return sendError(res, 404, 'Lead not found.');
    }

    // Role-based visibility check
    if (!isCompanyWide && lead.assignedTo._id.toString() !== currentUserId.toString()) {
      return sendError(res, 403, 'Access denied. You can only view leads assigned to you.');
    }

    // Metrics calculation
    const [interactionCount, lastInteraction] = await Promise.all([
      LeadInteraction.countDocuments({ leadId: id }),
      LeadInteraction.findOne({ leadId: id }).sort({ loggedAt: -1 })
    ]);

    const now = new Date();
    const daysSinceCreation = Math.floor((now - new Date(lead.createdAt)) / (1000 * 60 * 60 * 24));
    
    let daysSinceLastContact = null;
    if (lastInteraction) {
      daysSinceLastContact = Math.floor((now - new Date(lastInteraction.loggedAt)) / (1000 * 60 * 60 * 24));
    }

    return sendSuccess(res, 200, 'Lead details retrieved successfully.', {
      lead,
      metrics: {
        interactionCount,
        lastInteractionDate: lastInteraction ? lastInteraction.loggedAt : null,
        daysSinceLastContact,
        daysSinceCreation
      }
    });
  } catch (error) {
    console.error('Error fetching lead details:', error);
    return sendError(res, 500, error.message || 'Failed to fetch lead details.');
  }
};

/**
 * Update general fields of a lead (excluding status)
 * PUT /api/leads/:id/update or PUT /api/leads/:id
 */
exports.updateLead = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, requirementNotes, assignedTo, nextFollowUpDate, source } = req.body;
    const currentUserId = req.user.id || req.user._id;
    const isCompanyWide = isCompanyWideRole(req.user);

    const lead = await Lead.findById(id);
    if (!lead) {
      return sendError(res, 404, 'Lead not found.');
    }

    // Check ownership for non-admin
    if (!isCompanyWide && lead.assignedTo.toString() !== currentUserId.toString()) {
      return sendError(res, 403, 'Access denied. You can only update leads assigned to you.');
    }

    // Reassignment rule: only Admin/SuperAdmin/HR can reassign lead to a different employee
    if (assignedTo && assignedTo.toString() !== lead.assignedTo.toString()) {
      if (!isCompanyWide) {
        return sendError(res, 403, 'Access denied. Only Admins can reassign leads to another employee.');
      }
      const assignedUser = await User.findById(assignedTo);
      if (!assignedUser) {
        return sendError(res, 404, 'Newly assigned user does not exist.');
      }
      lead.assignedTo = assignedTo;
    }

    if (name) lead.name = name.trim();
    if (phone) lead.phone = phone.trim();
    if (email !== undefined) lead.email = email ? email.trim() : null;
    if (requirementNotes !== undefined) lead.requirementNotes = requirementNotes;
    if (source) lead.source = source;
    if (nextFollowUpDate !== undefined) {
      lead.nextFollowUpDate = nextFollowUpDate ? new Date(nextFollowUpDate) : null;
    }

    await lead.save();

    const updatedLead = await Lead.findById(id)
      .populate('assignedTo', 'name email phone department designation')
      .populate('createdBy', 'name email');

    return sendSuccess(res, 200, 'Lead updated successfully.', { lead: updatedLead });
  } catch (error) {
    console.error('Error updating lead:', error);
    return sendError(res, 500, error.message || 'Failed to update lead.');
  }
};

/**
 * Update lifecycle status of a lead with mandatory audit logging
 * PUT /api/leads/:id/update-status
 */
exports.updateLeadStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { newStatus, lostReason } = req.body;
    const currentUserId = req.user.id || req.user._id;
    const isCompanyWide = isCompanyWideRole(req.user);

    const validStatuses = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT', 'NEGOTIATION', 'WON', 'LOST'];
    if (!newStatus || !validStatuses.includes(newStatus)) {
      return sendError(res, 400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const lead = await Lead.findById(id);
    if (!lead) {
      return sendError(res, 404, 'Lead not found.');
    }

    // Check ownership for non-admin
    if (!isCompanyWide && lead.assignedTo.toString() !== currentUserId.toString()) {
      return sendError(res, 403, 'Access denied. You can only change status for leads assigned to you.');
    }

    // Mandatory lostReason validation when changing status to LOST
    if (newStatus === 'LOST') {
      if (!lostReason || !lostReason.trim()) {
        return sendError(res, 400, 'A lostReason is mandatory when marking a lead as LOST.');
      }
      lead.lostReason = lostReason.trim();
    } else {
      // Clear lostReason if reactivating from LOST
      lead.lostReason = null;
    }

    const fromStatus = lead.status;
    lead.status = newStatus;

    await lead.save();

    // Log status change audit trail
    const statusHistoryDoc = await LeadStatusHistory.create({
      leadId: lead._id,
      fromStatus,
      toStatus: newStatus,
      changedBy: currentUserId,
      changedAt: new Date()
    });

    const updatedLead = await Lead.findById(id)
      .populate('assignedTo', 'name email phone department designation')
      .populate('createdBy', 'name email');

    return sendSuccess(res, 200, `Lead status updated from ${fromStatus} to ${newStatus}.`, {
      lead: updatedLead,
      statusHistory: statusHistoryDoc
    });
  } catch (error) {
    console.error('Error updating lead status:', error);
    return sendError(res, 500, error.message || 'Failed to update lead status.');
  }
};

/**
 * Log an interaction (touchpoint) for a lead
 * POST /api/leads/:id/log-interaction
 */
exports.logInteraction = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, notes } = req.body;
    const currentUserId = req.user.id || req.user._id;
    const isCompanyWide = isCompanyWideRole(req.user);

    const validTypes = ['Call', 'Meeting', 'Email', 'Note'];
    if (!type || !validTypes.includes(type)) {
      return sendError(res, 400, `Invalid interaction type. Must be one of: ${validTypes.join(', ')}`);
    }

    if (!notes || !notes.trim()) {
      return sendError(res, 400, 'Interaction notes are required.');
    }

    const lead = await Lead.findById(id);
    if (!lead) {
      return sendError(res, 404, 'Lead not found.');
    }

    // Check ownership for non-admin
    if (!isCompanyWide && lead.assignedTo.toString() !== currentUserId.toString()) {
      return sendError(res, 403, 'Access denied. You can only log interactions for leads assigned to you.');
    }

    const interaction = new LeadInteraction({
      leadId: id,
      type,
      notes: notes.trim(),
      loggedBy: currentUserId,
      loggedAt: new Date()
    });

    await interaction.save();

    const populatedInteraction = await LeadInteraction.findById(interaction._id)
      .populate('loggedBy', 'name email designation');

    return sendSuccess(res, 201, 'Lead interaction logged successfully.', {
      interaction: populatedInteraction
    });
  } catch (error) {
    console.error('Error logging interaction:', error);
    return sendError(res, 500, error.message || 'Failed to log interaction.');
  }
};

/**
 * Get full interaction timeline for a lead
 * GET /api/leads/:id/interactions
 */
exports.getLeadInteractions = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user.id || req.user._id;
    const isCompanyWide = isCompanyWideRole(req.user);

    const lead = await Lead.findById(id);
    if (!lead) {
      return sendError(res, 404, 'Lead not found.');
    }

    if (!isCompanyWide && lead.assignedTo.toString() !== currentUserId.toString()) {
      return sendError(res, 403, 'Access denied. You can only view interactions for leads assigned to you.');
    }

    const interactions = await LeadInteraction.find({ leadId: id })
      .populate('loggedBy', 'name email designation')
      .sort({ loggedAt: -1 });

    return sendSuccess(res, 200, 'Lead interactions retrieved successfully.', {
      interactions
    });
  } catch (error) {
    console.error('Error fetching interactions:', error);
    return sendError(res, 500, error.message || 'Failed to fetch interactions.');
  }
};

/**
 * Get status change audit trail for a lead
 * GET /api/leads/:id/status-history
 */
exports.getLeadStatusHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user.id || req.user._id;
    const isCompanyWide = isCompanyWideRole(req.user);

    const lead = await Lead.findById(id);
    if (!lead) {
      return sendError(res, 404, 'Lead not found.');
    }

    if (!isCompanyWide && lead.assignedTo.toString() !== currentUserId.toString()) {
      return sendError(res, 403, 'Access denied. You can only view status history for leads assigned to you.');
    }

    const history = await LeadStatusHistory.find({ leadId: id })
      .populate('changedBy', 'name email designation')
      .sort({ changedAt: 1 });

    return sendSuccess(res, 200, 'Lead status history retrieved successfully.', {
      history
    });
  } catch (error) {
    console.error('Error fetching status history:', error);
    return sendError(res, 500, error.message || 'Failed to fetch status history.');
  }
};

/**
 * Get leads with follow-ups due on or before specified date
 * GET /api/leads/followups/due
 */
exports.getDueFollowUps = async (req, res) => {
  try {
    const { date } = req.query;
    const currentUserId = req.user.id || req.user._id;
    const isCompanyWide = isCompanyWideRole(req.user);

    // Target date defaults to end of current day if not specified
    let targetDate = new Date();
    if (date) {
      targetDate = new Date(date);
    }
    targetDate.setHours(23, 59, 59, 999);

    let filter = {
      nextFollowUpDate: { $lte: targetDate },
      status: { $nin: ['WON', 'LOST'] }
    };

    if (!isCompanyWide) {
      filter.assignedTo = currentUserId;
    }

    const leads = await Lead.find(filter)
      .populate('assignedTo', 'name email phone department')
      .sort({ nextFollowUpDate: 1 });

    return sendSuccess(res, 200, 'Due follow-up leads retrieved successfully.', {
      count: leads.length,
      leads
    });
  } catch (error) {
    console.error('Error fetching due follow-ups:', error);
    return sendError(res, 500, error.message || 'Failed to fetch due follow-ups.');
  }
};

/**
 * Convert Lead to Client & Primary ClientContact
 * POST /api/leads/:id/convert-to-client
 */
const generateTempPasswordForLead = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const nums = '0123456789';
  const spec = '!@#$%^&*';
  const pick = (str) => str.charAt(Math.floor(Math.random() * str.length));
  const required = [pick(chars), pick(lower), pick(nums), pick(spec)];
  const all = chars + lower + nums + spec;
  for (let i = 4; i < 10; i++) required.push(pick(all));
  for (let i = required.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [required[i], required[j]] = [required[j], required[i]];
  }
  return required.join('');
};

const convertToClient = async (req, res) => {
  try {
    const { id } = req.params;
    const { primaryContactEmail, companyName, billingAddress, siteAddresses } = req.body || {};
    const currentUserId = req.user.id || req.user._id;
    const isCompanyWide = isCompanyWideRole(req.user);

    const lead = await Lead.findById(id);
    if (!lead) {
      return sendError(res, 404, 'Lead not found.');
    }

    if (!isCompanyWide && lead.assignedTo.toString() !== currentUserId.toString()) {
      return sendError(res, 403, 'Access denied. You can only convert leads assigned to you.');
    }

    if (lead.convertedToClientId) {
      return sendError(res, 400, 'This lead has already been converted to a Client account.');
    }

    if (lead.status === 'LOST') {
      return sendError(res, 400, 'A LOST lead cannot be converted to a Client without reactivating it first.');
    }

    // Email requirement check for ClientContact portal login
    const contactEmail = lead.email ? lead.email.trim().toLowerCase() : (primaryContactEmail ? primaryContactEmail.trim().toLowerCase() : null);

    if (!contactEmail) {
      return sendError(
        res,
        400,
        'Lead does not have an email address captured. Please supply "primaryContactEmail" in the request body to create portal login.'
      );
    }

    // Check if ClientContact with this email already exists
    const existingContact = await ClientContact.findOne({ email: contactEmail });
    if (existingContact) {
      return sendError(res, 400, `A ClientContact with email '${contactEmail}' already exists.`);
    }

    // 1. Create Client document
    const client = new Client({
      name: lead.name,
      companyName: companyName ? companyName.trim() : null,
      phone: lead.phone,
      email: contactEmail,
      billingAddress: billingAddress || null,
      siteAddresses: Array.isArray(siteAddresses) ? siteAddresses : (lead.requirementNotes ? [lead.requirementNotes] : []),
      sourceLeadId: lead._id,
      isActive: true
    });

    await client.save();

    // 2. Generate temporary password & create primary ClientContact
    const tempPassword = generateTempPasswordForLead();
    const hashedPassword = await hashPassword(tempPassword);

    const primaryContact = new ClientContact({
      clientId: client._id,
      name: lead.name,
      email: contactEmail,
      password: hashedPassword,
      phone: lead.phone,
      permissionLevel: 'OWNER',
      isPrimaryContact: true,
      mustChangePassword: true,
      isActive: true,
      createdBy: currentUserId,
      createdByModel: 'User'
    });

    await primaryContact.save();

    // 3. Update Lead status and convertedToClientId
    const fromStatus = lead.status;
    lead.status = 'WON';
    lead.convertedToClientId = client._id;
    await lead.save();

    // 4. Log status change history if status was not WON
    if (fromStatus !== 'WON') {
      await LeadStatusHistory.create({
        leadId: lead._id,
        fromStatus,
        toStatus: 'WON',
        changedBy: currentUserId,
        changedAt: new Date()
      });
    }

    // 5. Audit log contact addition
    await ClientContactActionLog.create({
      clientId: client._id,
      contactId: primaryContact._id,
      action: 'CONTACT_ADDED',
      targetContactId: primaryContact._id,
      performedAt: new Date()
    });

    return sendSuccess(res, 200, 'Lead successfully converted to Client and primary ClientContact created.', {
      leadId: lead._id,
      client,
      primaryContact: {
        id: primaryContact._id,
        name: primaryContact.name,
        email: primaryContact.email,
        phone: primaryContact.phone,
        permissionLevel: primaryContact.permissionLevel,
        isPrimaryContact: primaryContact.isPrimaryContact,
        mustChangePassword: primaryContact.mustChangePassword,
        temporaryPassword: tempPassword
      },
      temporaryPasswordSent: true
    });
  } catch (error) {
    console.error('Error converting lead to client:', error);
    return sendError(res, 500, error.message || 'Failed to convert lead to client.');
  }
};

exports.convertToClient = convertToClient;
exports.convertToClientStub = convertToClient;

