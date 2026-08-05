const Drawing = require('../models/Drawing');
const ClientApprovalLog = require('../models/ClientApprovalLog');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * GET /api/drawings/:drawingId/client-approval-log
 * Internal PM/Admin view of full client approval history for a drawing.
 */
exports.getClientApprovalLog = async (req, res) => {
  try {
    const { drawingId } = req.params;

    const drawing = await Drawing.findById(drawingId);
    if (!drawing) {
      return sendError(res, 404, 'Drawing not found.');
    }

    const logs = await ClientApprovalLog.find({ drawingId })
      .populate('contactId', 'name email phone permissionLevel isPrimaryContact')
      .populate('clientId', 'name companyName email')
      .sort({ actedAt: -1 });

    return sendSuccess(res, 200, 'Client approval log retrieved successfully.', {
      drawingId: drawing._id,
      title: drawing.title,
      status: drawing.status,
      logs
    });
  } catch (error) {
    console.error('Error retrieving client approval log for internal team:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve client approval log.');
  }
};
