const jwt = require('jsonwebtoken');
const ClientContact = require('../models/ClientContact');
const Client = require('../models/Client');
const { sendError } = require('../utils/response');

/**
 * Client Portal Authentication Middleware
 * Validates Client-scoped JWT token in Authorization header.
 * Ensures the token is strictly issued for Client Portal authentication.
 */
module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 401, 'Access denied. Client portal authorization token required.');
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.CLIENT_JWT_SECRET || 'client-portal-secret-key-2508';

    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch (err) {
      return sendError(res, 401, 'Access denied. Invalid or expired Client Portal token.');
    }

    // Must be a client-scoped token
    if (!decoded || !decoded.isClientPortal || !decoded.contactId || !decoded.clientId) {
      return sendError(res, 401, 'Access denied. Token is not a valid Client Portal credentials payload.');
    }

    // Verify contact existence and active state
    const contact = await ClientContact.findById(decoded.contactId);
    if (!contact || !contact.isActive) {
      return sendError(res, 401, 'Access denied. Client contact account is inactive or deleted.');
    }

    // Verify parent client active state
    const client = await Client.findById(decoded.clientId);
    if (!client || !client.isActive) {
      return sendError(res, 401, 'Access denied. Linked Client account is inactive.');
    }

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

    next();
  } catch (error) {
    console.error('Client auth middleware error:', error);
    return sendError(res, 500, 'Server error validating client portal authentication.');
  }
};
