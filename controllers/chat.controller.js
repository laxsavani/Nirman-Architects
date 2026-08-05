const ChatMessage = require('../models/ChatMessage');
const Project = require('../models/Project');
const { sendSuccess, sendError } = require('../utils/response');
const { emitToProjectRoom } = require('../utils/socket');

/**
 * GET /api/chat/:projectId
 * Internal team view fetching full project chat history.
 */
exports.getInternalProjectChat = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { since } = req.query;

    const project = await Project.findById(projectId);
    if (!project) {
      return sendError(res, 404, 'Project not found.');
    }

    const filter = { projectId };
    if (since) {
      filter.sentAt = { $gt: new Date(since) };
    }

    const rawMessages = await ChatMessage.find(filter)
      .populate('authorId', 'name email designation department phone permissionLevel')
      .populate('replyToMessageId')
      .sort({ sentAt: 1, createdAt: 1 });

    const messages = rawMessages.map(msg => {
      const mObj = msg.toObject();
      if (mObj.authorType === 'CLIENT_CONTACT' && mObj.authorId) {
        const roleLabel = mObj.authorId.permissionLevel || 'Contact';
        mObj.formattedAuthorName = `${mObj.authorId.name} (${roleLabel})`;
      } else if (mObj.authorType === 'EMPLOYEE' && mObj.authorId) {
        const desig = mObj.authorId.designation || 'Staff';
        mObj.formattedAuthorName = `${mObj.authorId.name} (${desig})`;
      } else {
        mObj.formattedAuthorName = 'Unknown Author';
      }
      return mObj;
    });

    return sendSuccess(res, 200, 'Project chat history retrieved for internal team.', {
      projectId: project._id,
      projectName: project.name,
      messages,
      totalCount: messages.length
    });
  } catch (error) {
    console.error('Error retrieving internal project chat:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve project chat history.');
  }
};

/**
 * POST /api/chat/:projectId/message
 * Internal team sends chat message into project thread and broadcasts via Socket.io.
 */
exports.sendInternalMessage = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { messageText, mentionedIds, replyToMessageId } = req.body;
    const userId = req.user._id || req.user.id;

    if (!messageText || !messageText.trim()) {
      return sendError(res, 400, 'Message text is required.');
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return sendError(res, 404, 'Project not found.');
    }

    const createdMsg = await ChatMessage.create({
      projectId,
      authorType: 'EMPLOYEE',
      authorId: userId,
      authorModel: 'User',
      messageText: messageText.trim(),
      mentionedIds: Array.isArray(mentionedIds) ? mentionedIds : [],
      replyToMessageId: replyToMessageId || null,
      sentAt: new Date()
    });

    const populatedMsg = await ChatMessage.findById(createdMsg._id)
      .populate('authorId', 'name email designation department phone')
      .populate('replyToMessageId');

    const mObj = populatedMsg.toObject();
    const desig = mObj.authorId ? mObj.authorId.designation || 'Staff' : 'Staff';
    mObj.formattedAuthorName = `${mObj.authorId ? mObj.authorId.name : 'Employee'} (${desig})`;

    // Real-Time Socket.io Broadcast to project room
    emitToProjectRoom(projectId, 'new_message', { message: mObj });

    return sendSuccess(res, 201, 'Internal chat message sent successfully.', { message: mObj });
  } catch (error) {
    console.error('Error sending internal chat message:', error);
    return sendError(res, 500, error.message || 'Failed to send internal chat message.');
  }
};
