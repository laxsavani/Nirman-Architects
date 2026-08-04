const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const OfferLetter = require('../models/OfferLetter');
const Notification = require('../models/Notification');
const { getOfferLetterPath } = require('../utils/storagePathResolver');
const { generateOfferLetterPDF } = require('../utils/offerLetterPdfGenerator');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Get Offer Letter metadata for a user.
 */
exports.getOfferLetterMetadata = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const requesterId = (req.user && (req.user.userId || req.user.id)).toString();
    const roleCode = req.user ? (req.user.roleCode || req.user.role || '').toUpperCase() : '';

    const isAdminOrHR = ['SUPER_ADMIN', 'HR'].includes(roleCode);
    if (!isAdminOrHR && requesterId !== userId.toString()) {
      return sendError(res, 403, 'Access denied. You can only view your own offer letter.');
    }

    const offerLetters = await OfferLetter.find({ userId }).sort({ generatedAt: -1 });
    if (!offerLetters || offerLetters.length === 0) {
      return sendError(res, 404, 'No offer letter found for this user.');
    }

    return sendSuccess(res, 200, 'Offer letter metadata retrieved successfully.', {
      latest: offerLetters[0],
      history: offerLetters
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Download / stream Offer Letter PDF file.
 * Self-service: employee can only download their own; Admin/HR can download any.
 */
exports.downloadOfferLetterPDF = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const requesterId = (req.user && (req.user.userId || req.user.id)).toString();
    const roleCode = req.user ? (req.user.roleCode || req.user.role || '').toUpperCase() : '';

    const isAdminOrHR = ['SUPER_ADMIN', 'HR'].includes(roleCode);
    if (!isAdminOrHR && requesterId !== userId.toString()) {
      return sendError(res, 403, 'Access denied. You can only download your own offer letter.');
    }

    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, 404, 'User not found.');
    }

    const latestOffer = await OfferLetter.findOne({ userId }).sort({ generatedAt: -1 });
    const snapshotData = {
      designationSnapshot: latestOffer ? latestOffer.designationSnapshot : user.designation,
      departmentSnapshot: latestOffer ? latestOffer.departmentSnapshot : user.department,
      baseSalarySnapshot: latestOffer ? latestOffer.baseSalarySnapshot : user.baseSalary,
      joiningDateSnapshot: latestOffer ? latestOffer.joiningDateSnapshot : user.joiningDate
    };

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=OfferLetter_${user.name.replace(/\s+/g, '_')}.pdf`);

    // Stream PDF live
    await generateOfferLetterPDF(user, snapshotData, res, null);
  } catch (error) {
    next(error);
  }
};

/**
 * Admin/HR Endpoint: Regenerate Offer Letter for a user.
 * Creates a NEW OfferLetter record + NEW PDF file without overwriting old versions.
 */
exports.regenerateOfferLetter = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const adminUserId = req.user.userId || req.user.id;
    const { designation, department, baseSalary, joiningDate } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, 404, 'User not found.');
    }

    const snapshotData = {
      designationSnapshot: designation || user.designation || 'Staff',
      departmentSnapshot: department || user.department || 'General',
      baseSalarySnapshot: baseSalary !== undefined ? Number(baseSalary) : (user.baseSalary || 0),
      joiningDateSnapshot: joiningDate ? new Date(joiningDate) : (user.joiningDate || new Date())
    };

    const timestamp = Date.now();
    const pathInfo = getOfferLetterPath(user._id, timestamp);

    // Save PDF file under /storage/offer_letters/<userId>/
    await generateOfferLetterPDF(user, snapshotData, null, pathInfo.fullPath);

    // Create new OfferLetter record
    const newOffer = new OfferLetter({
      userId: user._id,
      generatedBy: adminUserId,
      filePath: pathInfo.relativePath,
      ...snapshotData,
      status: 'GENERATED',
      generatedAt: new Date()
    });
    await newOffer.save();

    await Notification.create({
      userId: user._id,
      type: 'OFFER_LETTER_REGENERATED',
      message: 'An updated Offer Letter has been issued by HR.'
    });

    return sendSuccess(res, 201, 'New offer letter generated successfully.', newOffer);
  } catch (error) {
    next(error);
  }
};
