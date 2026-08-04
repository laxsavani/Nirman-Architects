const Client = require('../models/Client');
const ClientContact = require('../models/ClientContact');
const ClientContactActionLog = require('../models/ClientContactActionLog');
const Project = require('../models/Project');
const { hashPassword, validatePasswordComplexity } = require('../utils/password');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Generates a random temporary password that satisfies complexity rules:
 * - 8 to 15 characters
 * - Uppercase, lowercase, number, special character
 */
const generateTempPassword = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const nums = '0123456789';
  const spec = '!@#$%^&*';

  const pick = (str) => str.charAt(Math.floor(Math.random() * str.length));
  
  // Force one of each required type
  const required = [pick(chars), pick(lower), pick(nums), pick(spec)];
  
  // Fill remaining to 10 characters
  const all = chars + lower + nums + spec;
  for (let i = 4; i < 10; i++) {
    required.push(pick(all));
  }
  
  // Shuffle array
  for (let i = required.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [required[i], required[j]] = [required[j], required[i]];
  }

  return required.join('');
};

/**
 * Helper to check if caller has OWNER rights for a specific clientId
 */
const canManageClientContacts = (req, targetClientId) => {
  if (req.user) {
    const roleCode = (req.user.roleCode || req.user.role || '').toUpperCase();
    if (['ADMIN', 'SUPER_ADMIN', 'SUPERADMIN', 'PROJECT_MANAGER', 'HR'].includes(roleCode)) {
      return true;
    }
  }
  if (req.clientContact) {
    if (
      req.clientContact.clientId === targetClientId.toString() &&
      req.clientContact.permissionLevel === 'OWNER'
    ) {
      return true;
    }
  }
  return false;
};

/**
 * Create Client directly (internal team, no prior lead)
 * POST /api/clients/create or POST /api/clients
 */
exports.createClient = async (req, res) => {
  try {
    const {
      name,
      companyName,
      phone,
      email,
      billingAddress,
      siteAddresses,
      primaryContactName,
      primaryContactEmail,
      primaryContactPhone
    } = req.body;

    const currentUserId = req.user ? (req.user.id || req.user._id) : null;

    if (!name || !phone || !primaryContactName || !primaryContactEmail) {
      return sendError(res, 400, 'Client name, phone, primary contact name, and primary contact email are required.');
    }

    const cleanContactEmail = primaryContactEmail.trim().toLowerCase();

    // Check if email already registered as ClientContact
    const existingContact = await ClientContact.findOne({ email: cleanContactEmail });
    if (existingContact) {
      return sendError(res, 400, 'A ClientContact with this email already exists.');
    }

    // 1. Create Client record
    const client = new Client({
      name: name.trim(),
      companyName: companyName ? companyName.trim() : null,
      phone: phone.trim(),
      email: email ? email.trim().toLowerCase() : cleanContactEmail,
      billingAddress: billingAddress || null,
      siteAddresses: Array.isArray(siteAddresses) ? siteAddresses : (siteAddresses ? [siteAddresses] : []),
      sourceLeadId: null,
      isActive: true
    });

    await client.save();

    // 2. Generate temporary password for primary ClientContact
    const tempPassword = generateTempPassword();
    const hashedPassword = await hashPassword(tempPassword);

    // 3. Create Primary ClientContact record
    const primaryContact = new ClientContact({
      clientId: client._id,
      name: primaryContactName.trim(),
      email: cleanContactEmail,
      password: hashedPassword,
      phone: primaryContactPhone ? primaryContactPhone.trim() : phone.trim(),
      permissionLevel: 'OWNER',
      isPrimaryContact: true,
      mustChangePassword: true,
      isActive: true,
      createdBy: currentUserId,
      createdByModel: 'User'
    });

    await primaryContact.save();

    // Audit log
    await ClientContactActionLog.create({
      clientId: client._id,
      contactId: primaryContact._id,
      action: 'CONTACT_ADDED',
      targetContactId: primaryContact._id,
      performedAt: new Date()
    });

    return sendSuccess(res, 201, 'Client and primary ClientContact created successfully.', {
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
    console.error('Error creating client:', error);
    return sendError(res, 500, error.message || 'Failed to create client.');
  }
};

/**
 * Get paginated & searchable list of clients (Internal team view)
 * GET /api/clients
 */
exports.getClients = async (req, res) => {
  try {
    const { search, isActive = 'true', page = 1, limit = 10 } = req.query;

    let filter = {};

    if (isActive !== undefined && isActive !== '') {
      filter.isActive = isActive === 'true' || isActive === true;
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { name: searchRegex },
        { companyName: searchRegex },
        { phone: searchRegex },
        { email: searchRegex }
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    const [clients, total] = await Promise.all([
      Client.find(filter)
        .populate('sourceLeadId', 'name phone email status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Client.countDocuments(filter)
    ]);

    // Attach primary contact and active project count info to each client
    const clientIds = clients.map(c => c._id);

    const primaryContacts = await ClientContact.find({
      clientId: { $in: clientIds },
      isPrimaryContact: true
    }).select('-password');

    const primaryContactMap = {};
    primaryContacts.forEach(pc => {
      primaryContactMap[pc.clientId.toString()] = pc;
    });

    let projectCountMap = {};
    if (Project && typeof Project.aggregate === 'function') {
      try {
        const counts = await Project.aggregate([
          { $match: { clientId: { $in: clientIds } } },
          { $group: { _id: '$clientId', count: { $sum: 1 } } }
        ]);
        counts.forEach(c => {
          projectCountMap[c._id.toString()] = c.count;
        });
      } catch (err) {
        // Fallback if aggregate fails or Project schema is light
      }
    }

    const enrichedClients = clients.map(client => {
      const cObj = client.toObject();
      cObj.primaryContact = primaryContactMap[client._id.toString()] || null;
      cObj.activeProjectCount = projectCountMap[client._id.toString()] || 0;
      return cObj;
    });

    return sendSuccess(res, 200, 'Clients retrieved successfully.', {
      clients: enrichedClients,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching clients:', error);
    return sendError(res, 500, error.message || 'Failed to fetch clients.');
  }
};

/**
 * Get Client details by ID (with list of ClientContacts)
 * GET /api/clients/:id
 */
exports.getClientById = async (req, res) => {
  try {
    const { id } = req.params;

    const client = await Client.findById(id).populate('sourceLeadId', 'name phone email status assignedTo');
    if (!client) {
      return sendError(res, 404, 'Client not found.');
    }

    const contacts = await ClientContact.find({ clientId: id }).select('-password').sort({ isPrimaryContact: -1, createdAt: 1 });

    let activeProjectCount = 0;
    if (Project) {
      try {
        activeProjectCount = await Project.countDocuments({ clientId: id });
      } catch (err) {}
    }

    return sendSuccess(res, 200, 'Client details retrieved successfully.', {
      client,
      contacts,
      activeProjectCount
    });
  } catch (error) {
    console.error('Error fetching client details:', error);
    return sendError(res, 500, error.message || 'Failed to fetch client details.');
  }
};

/**
 * Update Client account-level fields
 * PUT /api/clients/:id
 */
exports.updateClient = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, companyName, phone, email, billingAddress, siteAddresses } = req.body;

    const client = await Client.findById(id);
    if (!client) {
      return sendError(res, 404, 'Client not found.');
    }

    if (name) client.name = name.trim();
    if (companyName !== undefined) client.companyName = companyName ? companyName.trim() : null;
    if (phone) client.phone = phone.trim();
    if (email !== undefined) client.email = email ? email.trim().toLowerCase() : null;
    if (billingAddress !== undefined) client.billingAddress = billingAddress;
    if (siteAddresses !== undefined) {
      client.siteAddresses = Array.isArray(siteAddresses) ? siteAddresses : (siteAddresses ? [siteAddresses] : []);
    }

    await client.save();

    return sendSuccess(res, 200, 'Client account updated successfully.', { client });
  } catch (error) {
    console.error('Error updating client:', error);
    return sendError(res, 500, error.message || 'Failed to update client.');
  }
};

/**
 * Soft-delete Client account
 * PUT /api/clients/:id/deactivate
 */
exports.deactivateClient = async (req, res) => {
  try {
    const { id } = req.params;

    const client = await Client.findById(id);
    if (!client) {
      return sendError(res, 404, 'Client not found.');
    }

    // Edge Case Check: warning/block if active projects linked
    let activeProjectCount = 0;
    if (Project) {
      try {
        activeProjectCount = await Project.countDocuments({ clientId: id, status: { $ne: 'COMPLETED' } });
      } catch (err) {}
    }

    if (activeProjectCount > 0 && req.query.force !== 'true') {
      return sendError(
        res,
        400,
        `Cannot deactivate Client account. This Client has ${activeProjectCount} active project(s). Complete or archive projects first, or supply force=true.`
      );
    }

    client.isActive = false;
    await client.save();

    // Soft-deactivate all contacts of this client
    await ClientContact.updateMany({ clientId: id }, { isActive: false });

    return sendSuccess(res, 200, 'Client account deactivated successfully.', { client });
  } catch (error) {
    console.error('Error deactivating client:', error);
    return sendError(res, 500, error.message || 'Failed to deactivate client.');
  }
};

/**
 * Add additional ClientContact to a Client account
 * POST /api/clients/:clientId/contacts/add
 */
exports.addContact = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { name, email, phone, permissionLevel } = req.body;

    // Authorization check: internal team OR OWNER contact of this clientId
    if (!canManageClientContacts(req, clientId)) {
      return sendError(res, 403, 'Access denied. Only Admins or Client OWNER contacts can add new contacts.');
    }

    const client = await Client.findById(clientId);
    if (!client || !client.isActive) {
      return sendError(res, 404, 'Client account not found or inactive.');
    }

    if (!name || !email) {
      return sendError(res, 400, 'Contact name and email are required.');
    }

    const cleanEmail = email.trim().toLowerCase();

    // Unique email check
    const existingContact = await ClientContact.findOne({ email: cleanEmail });
    if (existingContact) {
      return sendError(res, 400, 'A ClientContact with this email already exists.');
    }

    const validPermissions = ['OWNER', 'MEMBER', 'VIEW_ONLY'];
    const contactPermission = permissionLevel && validPermissions.includes(permissionLevel) ? permissionLevel : 'MEMBER';

    const tempPassword = generateTempPassword();
    const hashedPassword = await hashPassword(tempPassword);

    let createdBy = null;
    let createdByModel = 'User';

    if (req.user) {
      createdBy = req.user.id || req.user._id;
      createdByModel = 'User';
    } else if (req.clientContact) {
      createdBy = req.clientContact.contactId;
      createdByModel = 'ClientContact';
    }

    const newContact = new ClientContact({
      clientId: client._id,
      name: name.trim(),
      email: cleanEmail,
      password: hashedPassword,
      phone: phone ? phone.trim() : null,
      permissionLevel: contactPermission,
      isPrimaryContact: false,
      mustChangePassword: true,
      isActive: true,
      createdBy,
      createdByModel
    });

    await newContact.save();

    // Audit log
    await ClientContactActionLog.create({
      clientId: client._id,
      contactId: createdBy || newContact._id,
      action: 'CONTACT_ADDED',
      targetContactId: newContact._id,
      performedAt: new Date()
    });

    return sendSuccess(res, 201, 'Additional ClientContact added successfully.', {
      contact: {
        id: newContact._id,
        clientId: newContact.clientId,
        name: newContact.name,
        email: newContact.email,
        phone: newContact.phone,
        permissionLevel: newContact.permissionLevel,
        isPrimaryContact: newContact.isPrimaryContact,
        mustChangePassword: newContact.mustChangePassword,
        temporaryPassword: tempPassword
      },
      temporaryPasswordSent: true
    });
  } catch (error) {
    console.error('Error adding client contact:', error);
    return sendError(res, 500, error.message || 'Failed to add client contact.');
  }
};

/**
 * List contacts for a Client
 * GET /api/clients/:clientId/contacts
 */
exports.getClientContacts = async (req, res) => {
  try {
    const { clientId } = req.params;

    // Check authorization: internal team OR any contact belonging to that clientId
    const isInternal = !!req.user;
    const isClientOfThis = req.clientContact && req.clientContact.clientId === clientId.toString();

    if (!isInternal && !isClientOfThis) {
      return sendError(res, 403, 'Access denied. You can only view contacts for your own Client account.');
    }

    const contacts = await ClientContact.find({ clientId }).select('-password').sort({ isPrimaryContact: -1, createdAt: 1 });

    return sendSuccess(res, 200, 'Client contacts retrieved successfully.', { contacts });
  } catch (error) {
    console.error('Error fetching client contacts:', error);
    return sendError(res, 500, error.message || 'Failed to fetch client contacts.');
  }
};

/**
 * Update permission level of a ClientContact
 * PUT /api/clients/:clientId/contacts/:contactId/permission
 */
exports.updateContactPermission = async (req, res) => {
  try {
    const { clientId, contactId } = req.params;
    const { newPermissionLevel } = req.body;

    if (!canManageClientContacts(req, clientId)) {
      return sendError(res, 403, 'Access denied. Only Admins or Client OWNER contacts can update contact permissions.');
    }

    const validPermissions = ['OWNER', 'MEMBER', 'VIEW_ONLY'];
    if (!newPermissionLevel || !validPermissions.includes(newPermissionLevel)) {
      return sendError(res, 400, `Invalid permission level. Must be one of: ${validPermissions.join(', ')}`);
    }

    const contact = await ClientContact.findOne({ _id: contactId, clientId });
    if (!contact) {
      return sendError(res, 404, 'Client contact not found under this account.');
    }

    // Edge Case: If demoting an OWNER away from OWNER level, ensure at least 1 other active OWNER exists
    if (contact.permissionLevel === 'OWNER' && newPermissionLevel !== 'OWNER') {
      const activeOwnerCount = await ClientContact.countDocuments({
        clientId,
        permissionLevel: 'OWNER',
        isActive: true,
        _id: { $ne: contactId }
      });

      if (activeOwnerCount === 0) {
        return sendError(
          res,
          400,
          'Cannot demote this contact. A Client account must maintain at least one active OWNER contact.'
        );
      }
    }

    const oldPermission = contact.permissionLevel;
    contact.permissionLevel = newPermissionLevel;
    await contact.save();

    let performingId = req.user ? req.user.id || req.user._id : (req.clientContact ? req.clientContact.contactId : contactId);

    // Audit log
    await ClientContactActionLog.create({
      clientId,
      contactId: performingId,
      action: 'PERMISSION_CHANGED',
      targetContactId: contact._id,
      performedAt: new Date()
    });

    return sendSuccess(res, 200, `Permission level updated from ${oldPermission} to ${newPermissionLevel}.`, {
      contact: {
        id: contact._id,
        name: contact.name,
        email: contact.email,
        permissionLevel: contact.permissionLevel
      }
    });
  } catch (error) {
    console.error('Error updating contact permission:', error);
    return sendError(res, 500, error.message || 'Failed to update contact permission.');
  }
};

/**
 * Soft-delete (deactivate) a ClientContact
 * PUT /api/clients/:clientId/contacts/:contactId/deactivate
 */
exports.deactivateContact = async (req, res) => {
  try {
    const { clientId, contactId } = req.params;

    if (!canManageClientContacts(req, clientId)) {
      return sendError(res, 403, 'Access denied. Only Admins or Client OWNER contacts can deactivate contacts.');
    }

    const contact = await ClientContact.findOne({ _id: contactId, clientId });
    if (!contact) {
      return sendError(res, 404, 'Client contact not found under this account.');
    }

    if (!contact.isActive) {
      return sendError(res, 400, 'Client contact is already deactivated.');
    }

    // Edge Case Safeguard: Cannot deactivate the last remaining active OWNER contact
    if (contact.permissionLevel === 'OWNER') {
      const otherActiveOwners = await ClientContact.countDocuments({
        clientId,
        permissionLevel: 'OWNER',
        isActive: true,
        _id: { $ne: contactId }
      });

      if (otherActiveOwners === 0) {
        return sendError(
          res,
          400,
          'Cannot deactivate contact. Client account must maintain at least one active OWNER contact.'
        );
      }
    }

    contact.isActive = false;
    await contact.save();

    let performingId = req.user ? req.user.id || req.user._id : (req.clientContact ? req.clientContact.contactId : contactId);

    // Audit log
    await ClientContactActionLog.create({
      clientId,
      contactId: performingId,
      action: 'CONTACT_DEACTIVATED',
      targetContactId: contact._id,
      performedAt: new Date()
    });

    return sendSuccess(res, 200, 'Client contact deactivated successfully.', {
      contact: {
        id: contact._id,
        name: contact.name,
        email: contact.email,
        isActive: contact.isActive
      }
    });
  } catch (error) {
    console.error('Error deactivating contact:', error);
    return sendError(res, 500, error.message || 'Failed to deactivate contact.');
  }
};

/**
 * Admin helper to regenerate & return temporary password for a contact
 * POST /api/clients/:clientId/contacts/:contactId/reset-temp-password
 */
exports.resetTempPassword = async (req, res) => {
  try {
    const { clientId, contactId } = req.params;

    // Internal team only
    if (!req.user) {
      return sendError(res, 403, 'Access denied. Admin privileges required.');
    }

    const contact = await ClientContact.findOne({ _id: contactId, clientId });
    if (!contact) {
      return sendError(res, 404, 'Client contact not found.');
    }

    const tempPassword = generateTempPassword();
    const hashedPassword = await hashPassword(tempPassword);

    contact.password = hashedPassword;
    contact.mustChangePassword = true;
    await contact.save();

    await ClientContactActionLog.create({
      clientId,
      contactId: req.user.id || req.user._id,
      action: 'TEMP_PASSWORD_REGENERATED',
      targetContactId: contact._id,
      performedAt: new Date()
    });

    return sendSuccess(res, 200, 'Temporary password regenerated successfully.', {
      contactId: contact._id,
      email: contact.email,
      temporaryPassword: tempPassword,
      mustChangePassword: true
    });
  } catch (error) {
    console.error('Error resetting temp password:', error);
    return sendError(res, 500, error.message || 'Failed to regenerate temporary password.');
  }
};
