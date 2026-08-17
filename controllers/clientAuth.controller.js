const jwt = require('jsonwebtoken');
const ClientContact = require('../models/ClientContact');
const Client = require('../models/Client');
const ClientContactActionLog = require('../models/ClientContactActionLog');
const { hashPassword, comparePassword, validatePasswordComplexity } = require('../utils/password');
const { sendSuccess, sendError } = require('../utils/response');

const CLIENT_SECRET = process.env.CLIENT_JWT_SECRET || 'client-portal-secret-key-2508';

/**
 * Client Portal Login
 * POST /api/client-auth/login
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendError(res, 400, 'Email and password are required.');
    }

    const cleanEmail = email.trim().toLowerCase();
    const contact = await ClientContact.findOne({ email: cleanEmail });

    if (!contact) {
      return sendError(res, 401, 'Invalid email or password.');
    }

    if (!contact.isActive) {
      return sendError(res, 403, 'Account is deactivated. Please contact support.');
    }

    // Verify parent Client account is active
    const client = await Client.findById(contact.clientId);
    if (!client || !client.isActive) {
      return sendError(res, 403, 'Client account is inactive.');
    }

    const isMatch = await comparePassword(password, contact.password);
    if (!isMatch) {
      return sendError(res, 401, 'Invalid email or password.');
    }

    // Generate Client-scoped JWT token
    const payload = {
      contactId: contact._id.toString(),
      clientId: contact.clientId.toString(),
      permissionLevel: contact.permissionLevel,
      isClientPortal: true
    };

    const token = jwt.sign(payload, CLIENT_SECRET, {
      expiresIn: process.env.JWT_ACCESS_EXPIRE || '24h'
    });

    // Audit log
    await ClientContactActionLog.create({
      clientId: contact.clientId,
      contactId: contact._id,
      action: 'LOGIN',
      performedAt: new Date()
    });

    const { clearRateLimit } = require('../middlewares/rateLimiter.middleware');
    clearRateLimit(req);

    return sendSuccess(res, 200, 'Client Portal login successful.', {
      token,
      contact: {
        id: contact._id,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        permissionLevel: contact.permissionLevel,
        isPrimaryContact: contact.isPrimaryContact,
        mustChangePassword: contact.mustChangePassword,
        clientId: contact.clientId
      },
      client: {
        id: client._id,
        name: client.name,
        companyName: client.companyName
      }
    });
  } catch (error) {
    console.error('Error in Client Portal login:', error);
    return sendError(res, 500, error.message || 'Client login failed.');
  }
};

/**
 * Change Password for Logged-In Client Contact
 * POST /api/client-auth/change-password
 */
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const contactId = req.clientContact.contactId;

    if (!currentPassword || !newPassword) {
      return sendError(res, 400, 'Current password and new password are required.');
    }

    const contact = await ClientContact.findById(contactId);
    if (!contact || !contact.isActive) {
      return sendError(res, 404, 'Client contact not found or inactive.');
    }

    const isMatch = await comparePassword(currentPassword, contact.password);
    if (!isMatch) {
      return sendError(res, 400, 'Current password is incorrect.');
    }

    // Validate new password complexity
    const complexityCheck = validatePasswordComplexity(newPassword);
    if (!complexityCheck.valid) {
      return sendError(res, 400, complexityCheck.message);
    }

    const hashed = await hashPassword(newPassword.trim());
    contact.password = hashed;
    contact.mustChangePassword = false;
    await contact.save();

    // Audit log
    await ClientContactActionLog.create({
      clientId: contact.clientId,
      contactId: contact._id,
      action: 'PASSWORD_CHANGED',
      performedAt: new Date()
    });

    return sendSuccess(res, 200, 'Password updated successfully.', {
      mustChangePassword: false
    });
  } catch (error) {
    console.error('Error changing client password:', error);
    return sendError(res, 500, error.message || 'Failed to change password.');
  }
};

/**
 * Forgot Password (Request Reset Token/Link)
 * POST /api/client-auth/forgot-password
 */
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return sendError(res, 400, 'Email is required.');
    }

    const cleanEmail = email.trim().toLowerCase();
    const contact = await ClientContact.findOne({ email: cleanEmail, isActive: true });

    if (!contact) {
      // Return success even if email not found for security enumeration resistance
      return sendSuccess(res, 200, 'If an account exists with this email, a reset token has been generated.', {
        resetTokenSent: true
      });
    }

    const resetToken = jwt.sign(
      { contactId: contact._id.toString(), email: contact.email, type: 'PASSWORD_RESET' },
      CLIENT_SECRET,
      { expiresIn: '1h' }
    );

    // Audit log
    await ClientContactActionLog.create({
      clientId: contact.clientId,
      contactId: contact._id,
      action: 'PASSWORD_RESET_REQUESTED',
      performedAt: new Date()
    });

    return sendSuccess(res, 200, 'Password reset token generated successfully.', {
      resetTokenSent: true,
      resetToken // Returned in response for dev/testing ease
    });
  } catch (error) {
    console.error('Error in client forgot password:', error);
    return sendError(res, 500, error.message || 'Failed to process forgot password request.');
  }
};

/**
 * Reset Password using Token
 * POST /api/client-auth/reset-password
 */
exports.resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return sendError(res, 400, 'Reset token and new password are required.');
    }

    let decoded;
    try {
      decoded = jwt.verify(resetToken, CLIENT_SECRET);
    } catch (err) {
      return sendError(res, 400, 'Invalid or expired password reset token.');
    }

    if (!decoded || decoded.type !== 'PASSWORD_RESET' || !decoded.contactId) {
      return sendError(res, 400, 'Invalid reset token payload.');
    }

    const contact = await ClientContact.findById(decoded.contactId);
    if (!contact || !contact.isActive) {
      return sendError(res, 404, 'Client contact not found or inactive.');
    }

    const complexityCheck = validatePasswordComplexity(newPassword);
    if (!complexityCheck.valid) {
      return sendError(res, 400, complexityCheck.message);
    }

    const hashed = await hashPassword(newPassword.trim());
    contact.password = hashed;
    contact.mustChangePassword = false;
    await contact.save();

    await ClientContactActionLog.create({
      clientId: contact.clientId,
      contactId: contact._id,
      action: 'PASSWORD_RESET_COMPLETED',
      performedAt: new Date()
    });

    return sendSuccess(res, 200, 'Password has been reset successfully.', {
      mustChangePassword: false
    });
  } catch (error) {
    console.error('Error resetting client password:', error);
    return sendError(res, 500, error.message || 'Failed to reset password.');
  }
};

/**
 * Get Currently Logged-In Client Contact Profile
 * GET /api/client-auth/me
 */
exports.getMe = async (req, res) => {
  try {
    const contactId = req.clientContact.contactId;

    const contact = await ClientContact.findById(contactId).select('-password');
    if (!contact) {
      return sendError(res, 404, 'Client contact profile not found.');
    }

    const client = await Client.findById(contact.clientId);

    return sendSuccess(res, 200, 'Client contact profile retrieved.', {
      contact,
      client
    });
  } catch (error) {
    console.error('Error in client getMe:', error);
    return sendError(res, 500, error.message || 'Failed to fetch client profile.');
  }
};
