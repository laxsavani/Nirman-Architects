const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ClientContact = require('../models/ClientContact');
const Client = require('../models/Client');
const RoleMaster = require('../models/RoleMaster');
const { sendError } = require('../utils/response');

/**
 * Dual Authentication Middleware (Internal Employee OR Client Contact)
 * Validates either an Employee JWT or a Client Portal JWT.
 */
module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 401, 'Access denied. Authorization token required.');
    }

    const token = authHeader.split(' ')[1];

    // 1. Try decoding as Internal Employee token
    try {
      const decodedUser = jwt.verify(token, process.env.JWT_SECRET || 'developer-secret-key-2508');
      if (decodedUser && (decodedUser.id || decodedUser._id) && !decodedUser.isClientPortal) {
        req.user = decodedUser;
        return next();
      }
    } catch (err) {
      // Not a valid employee token, try client portal token next
    }

    // 2. Try decoding as Client Portal token
    try {
      const clientSecret = process.env.CLIENT_JWT_SECRET || 'client-portal-secret-key-2508';
      const decodedClient = jwt.verify(token, clientSecret);
      if (decodedClient && decodedClient.isClientPortal && decodedClient.contactId && decodedClient.clientId) {
        const contact = await ClientContact.findById(decodedClient.contactId);
        if (contact && contact.isActive) {
          const client = await Client.findById(decodedClient.clientId);
          if (client && client.isActive) {
            req.clientContact = {
              contactId: contact._id.toString(),
              clientId: client._id.toString(),
              permissionLevel: contact.permissionLevel,
              email: contact.email,
              name: contact.name,
              isPrimaryContact: contact.isPrimaryContact,
              mustChangePassword: contact.mustChangePassword
            };
            req.clientContactDoc = contact;
            req.clientDoc = client;
            return next();
          }
        }
      }
    } catch (err) {
      // Not a valid client token
    }

    return sendError(res, 401, 'Access denied. Invalid or expired authentication token.');
  } catch (error) {
    console.error('Dual auth middleware error:', error);
    return sendError(res, 500, 'Server error validating request credentials.');
  }
};
