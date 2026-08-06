const ClientFeedback = require('../models/ClientFeedback');
const FeedbackPromptStatus = require('../models/FeedbackPromptStatus');
const ClientProjectLink = require('../models/ClientProjectLink');
const Project = require('../models/Project');
const { sendSuccess, sendError } = require('../utils/response');

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
 * GET /api/client/feedback/pending-prompts
 * Returns all PENDING feedback prompts for the calling client contact.
 */
exports.getPendingPrompts = async (req, res) => {
  try {
    const { contactId } = req.clientContact;

    const rawPrompts = await FeedbackPromptStatus.find({
      contactId,
      status: 'PENDING'
    }).sort({ createdAt: -1 });

    const prompts = [];
    for (const prompt of rawPrompts) {
      const pObj = prompt.toObject();
      if (prompt.triggerType === 'PROJECT_COMPLETION' || prompt.triggerType === 'DRAWING_BATCH_APPROVAL') {
        const project = await Project.findById(prompt.triggerRefId).select('name projectNumber status thumbnailUrl');
        pObj.project = project;
      }
      prompts.push(pObj);
    }

    return sendSuccess(res, 200, 'Pending feedback prompts retrieved successfully.', {
      count: prompts.length,
      prompts
    });
  } catch (error) {
    console.error('Error fetching pending feedback prompts:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve pending feedback prompts.');
  }
};

/**
 * POST /api/client/feedback/:promptId/submit
 * Submit feedback for a pending prompt.
 * Explicit Exception: All 3 permission levels (OWNER, MEMBER, VIEW_ONLY) are permitted.
 */
exports.submitFeedback = async (req, res) => {
  try {
    const { promptId } = req.params;
    const { overallRating, categoryRatings, comments } = req.body;
    const { clientId, contactId } = req.clientContact;

    const ratingNum = Number(overallRating);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return sendError(res, 400, 'overallRating is required and must be an integer between 1 and 5.');
    }

    const prompt = await FeedbackPromptStatus.findById(promptId);
    if (!prompt) {
      return sendError(res, 404, 'Feedback prompt not found.');
    }

    // Security Ownership Check
    if (prompt.contactId.toString() !== contactId.toString()) {
      return sendError(res, 403, 'Access denied. You cannot submit feedback for a prompt belonging to a different contact.');
    }

    if (prompt.status !== 'PENDING') {
      return sendError(res, 400, `This feedback prompt has already been ${prompt.status.toLowerCase()}.`);
    }

    const projectId = prompt.triggerRefId;

    // Validate project linkage
    const link = await verifyProjectLink(clientId, projectId);
    if (!link) {
      return sendError(res, 403, 'Access denied. Project is not linked or visible to your Client account.');
    }

    // Clean category ratings
    const processedCategoryRatings = [];
    if (Array.isArray(categoryRatings)) {
      for (const cat of categoryRatings) {
        if (cat && cat.categoryId && cat.rating) {
          const catRating = Number(cat.rating);
          if (catRating >= 1 && catRating <= 5) {
            processedCategoryRatings.push({
              categoryId: cat.categoryId,
              rating: catRating
            });
          }
        }
      }
    }

    // Save Feedback Submission
    const feedback = await ClientFeedback.create({
      clientId,
      contactId,
      projectId,
      triggerType: prompt.triggerType,
      triggerRefId: prompt.triggerRefId,
      overallRating: ratingNum,
      categoryRatings: processedCategoryRatings,
      comments: comments ? comments.trim() : null,
      submittedAt: new Date()
    });

    // Mark prompt as SUBMITTED
    prompt.status = 'SUBMITTED';
    prompt.resolvedAt = new Date();
    await prompt.save();

    const populatedFeedback = await ClientFeedback.findById(feedback._id)
      .populate('projectId', 'name projectNumber')
      .populate('categoryRatings.categoryId', 'name');

    return sendSuccess(res, 201, 'Feedback submitted successfully. Thank you for your review!', { feedback: populatedFeedback });
  } catch (error) {
    console.error('Error submitting client feedback:', error);
    return sendError(res, 500, error.message || 'Failed to submit feedback.');
  }
};

/**
 * POST /api/client/feedback/:promptId/skip
 * Skip a pending feedback prompt permanently for this trigger event.
 */
exports.skipPrompt = async (req, res) => {
  try {
    const { promptId } = req.params;
    const { contactId } = req.clientContact;

    const prompt = await FeedbackPromptStatus.findById(promptId);
    if (!prompt) {
      return sendError(res, 404, 'Feedback prompt not found.');
    }

    if (prompt.contactId.toString() !== contactId.toString()) {
      return sendError(res, 403, 'Access denied. You cannot skip a prompt belonging to a different contact.');
    }

    prompt.status = 'SKIPPED';
    prompt.resolvedAt = new Date();
    await prompt.save();

    return sendSuccess(res, 200, 'Feedback prompt skipped.', { prompt });
  } catch (error) {
    console.error('Error skipping feedback prompt:', error);
    return sendError(res, 500, error.message || 'Failed to skip feedback prompt.');
  }
};

/**
 * GET /api/client/feedback/my
 * Returns calling contact's own past submitted feedback history.
 */
exports.getMyFeedbackHistory = async (req, res) => {
  try {
    const { contactId } = req.clientContact;

    const feedbacks = await ClientFeedback.find({ contactId })
      .populate('projectId', 'name projectNumber status')
      .populate('categoryRatings.categoryId', 'name')
      .sort({ submittedAt: -1 });

    return sendSuccess(res, 200, 'Your feedback history retrieved successfully.', {
      count: feedbacks.length,
      feedbacks
    });
  } catch (error) {
    console.error('Error fetching personal feedback history:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve feedback history.');
  }
};

/**
 * GET /api/client/feedback/project/:projectId
 * Returns all feedback submitted by any contact under the client account for a specific project.
 */
exports.getProjectClientFeedback = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { clientId } = req.clientContact;

    const link = await verifyProjectLink(clientId, projectId);
    if (!link) {
      return sendError(res, 403, 'Access denied. Project is not linked or visible to your Client account.');
    }

    const rawFeedbacks = await ClientFeedback.find({ clientId, projectId })
      .populate('contactId', 'name email permissionLevel isPrimaryContact')
      .populate('categoryRatings.categoryId', 'name')
      .sort({ submittedAt: -1 });

    const feedbacks = rawFeedbacks.map(f => {
      const fObj = f.toObject();
      if (fObj.contactId) {
        fObj.formattedAuthorName = `${fObj.contactId.name} (${fObj.contactId.permissionLevel || 'Contact'})`;
      }
      return fObj;
    });

    return sendSuccess(res, 200, 'Project feedback retrieved successfully.', {
      count: feedbacks.length,
      feedbacks
    });
  } catch (error) {
    console.error('Error fetching project feedback:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve project feedback.');
  }
};
