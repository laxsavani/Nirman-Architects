const ClientFeedback = require('../models/ClientFeedback');
const FeedbackPromptStatus = require('../models/FeedbackPromptStatus');
const FeedbackCategory = require('../models/FeedbackCategory');
const ClientProjectLink = require('../models/ClientProjectLink');
const ClientContact = require('../models/ClientContact');
const NotificationDispatcher = require('../utils/notificationDispatcher');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * System Hook: Called when a Project's status changes to 'Completed'.
 * Creates a PENDING FeedbackPromptStatus entry for EVERY active ClientContact under the linked Client(s).
 */
exports.onProjectStatusChangedToCompleted = async (projectId) => {
  try {
    const activeLinks = await ClientProjectLink.find({
      projectId,
      isActive: true,
      visibleToClient: true
    });

    let createdCount = 0;

    for (const link of activeLinks) {
      const contacts = await ClientContact.find({
        clientId: link.clientId,
        isActive: true
      });

      for (const contact of contacts) {
        const promptDoc = await FeedbackPromptStatus.findOneAndUpdate(
          {
            contactId: contact._id,
            triggerType: 'PROJECT_COMPLETION',
            triggerRefId: projectId
          },
          {
            $setOnInsert: {
              contactId: contact._id,
              triggerType: 'PROJECT_COMPLETION',
              triggerRefId: projectId,
              status: 'PENDING',
              lastPromptedAt: new Date()
            }
          },
          { upsert: true, new: true }
        );
        createdCount++;

        // CRM Module 10 Hookpoint: Dispatch feedback prompt notification
        NotificationDispatcher.dispatch({
          contactIds: [contact._id],
          type: 'FEEDBACK_PROMPT_AVAILABLE',
          title: 'Project Completed - Share Your Feedback',
          message: 'Your project has been completed! We would love to hear your feedback.',
          deepLink: `client/feedback/pending-prompts`,
          refId: promptDoc._id,
          projectId,
          clientId: link.clientId
        }).catch(err => console.warn('[Notification Error] Feedback prompt notification failed:', err.message));
      }
    }

    console.log(`[Feedback Trigger] Created/Verified ${createdCount} feedback prompt(s) for completed project ${projectId}.`);
    return createdCount;
  } catch (error) {
    console.error('[Feedback Trigger Error] Failed to generate prompts on project completion:', error);
    throw error;
  }
};

/**
 * GET /api/feedback/all?projectId=&clientId=&minRating=&maxRating=&dateFrom=&dateTo=
 * Internal Team endpoint to list all submitted client feedback with filtering.
 */
exports.getAllFeedback = async (req, res) => {
  try {
    const { projectId, clientId, minRating, maxRating, dateFrom, dateTo } = req.query;

    const filter = {};
    if (projectId) filter.projectId = projectId;
    if (clientId) filter.clientId = clientId;

    if (minRating || maxRating) {
      filter.overallRating = {};
      if (minRating) filter.overallRating.$gte = Number(minRating);
      if (maxRating) filter.overallRating.$lte = Number(maxRating);
    }

    if (dateFrom || dateTo) {
      filter.submittedAt = {};
      if (dateFrom) filter.submittedAt.$gte = new Date(dateFrom);
      if (dateTo) filter.submittedAt.$lte = new Date(dateTo);
    }

    const rawFeedbacks = await ClientFeedback.find(filter)
      .populate('clientId', 'name companyName email phone')
      .populate('contactId', 'name email phone permissionLevel isPrimaryContact')
      .populate('projectId', 'name projectNumber status')
      .populate('categoryRatings.categoryId', 'name')
      .sort({ submittedAt: -1 });

    const feedbacks = rawFeedbacks.map(f => {
      const fObj = f.toObject();
      if (fObj.contactId) {
        fObj.formattedAuthorName = `${fObj.contactId.name} (${fObj.contactId.permissionLevel || 'Contact'})`;
      }
      return fObj;
    });

    return sendSuccess(res, 200, 'Client feedback submissions retrieved successfully.', {
      count: feedbacks.length,
      feedbacks
    });
  } catch (error) {
    console.error('Error fetching all client feedback:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve feedback submissions.');
  }
};

/**
 * GET /api/feedback/aggregate-summary?projectId=&clientId=
 * Internal Team endpoint computing aggregate satisfaction analytics.
 */
exports.getAggregateSummary = async (req, res) => {
  try {
    const { projectId, clientId } = req.query;

    const filter = {};
    if (projectId) filter.projectId = projectId;
    if (clientId) filter.clientId = clientId;

    const feedbacks = await ClientFeedback.find(filter).populate('categoryRatings.categoryId', 'name');

    const totalSubmissions = feedbacks.length;
    if (totalSubmissions === 0) {
      return sendSuccess(res, 200, 'No feedback submissions found for specified parameters.', {
        totalSubmissions: 0,
        averageOverallRating: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        categoryAverages: []
      });
    }

    let overallSum = 0;
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const categoryStats = {}; // categoryId -> { name, sum, count }

    for (const f of feedbacks) {
      overallSum += f.overallRating;
      const roundedRating = Math.round(f.overallRating);
      if (ratingDistribution[roundedRating] !== undefined) {
        ratingDistribution[roundedRating]++;
      }

      if (Array.isArray(f.categoryRatings)) {
        for (const catItem of f.categoryRatings) {
          if (catItem.categoryId && catItem.rating) {
            const cId = catItem.categoryId._id ? catItem.categoryId._id.toString() : catItem.categoryId.toString();
            const cName = catItem.categoryId.name || 'Category';

            if (!categoryStats[cId]) {
              categoryStats[cId] = { categoryId: cId, categoryName: cName, sum: 0, count: 0 };
            }
            categoryStats[cId].sum += catItem.rating;
            categoryStats[cId].count++;
          }
        }
      }
    }

    const averageOverallRating = Number((overallSum / totalSubmissions).toFixed(2));

    const categoryAverages = Object.values(categoryStats).map(c => ({
      categoryId: c.categoryId,
      categoryName: c.categoryName,
      averageRating: Number((c.sum / c.count).toFixed(2)),
      submissionCount: c.count
    }));

    return sendSuccess(res, 200, 'Aggregate feedback summary computed successfully.', {
      totalSubmissions,
      averageOverallRating,
      ratingDistribution,
      categoryAverages
    });
  } catch (error) {
    console.error('Error computing feedback aggregate summary:', error);
    return sendError(res, 500, error.message || 'Failed to compute aggregate summary.');
  }
};
