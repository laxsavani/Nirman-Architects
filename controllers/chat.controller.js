const ChatMessage = require('../models/ChatMessage');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Drawing = require('../models/Drawing');
const DrawingVersion = require('../models/DrawingVersion');
const EmployeeChatReadStatus = require('../models/EmployeeChatReadStatus');
const RoleMaster = require('../models/RoleMaster');
const InternalNotificationDispatcher = require('../utils/internalNotificationDispatcher');
const { sendSuccess, sendError } = require('../utils/response');
const { emitToProjectRoom } = require('../utils/socket');

/**
 * Helper to check user role code
 */
async function getUserRoleCode(user) {
  if (!user) return '';
  if (user.roleId && typeof user.roleId === 'object' && user.roleId.roleCode) {
    return user.roleId.roleCode;
  }
  if (user.roleId) {
    const role = await RoleMaster.findById(user.roleId);
    return role ? role.roleCode : '';
  }
  return '';
}

/**
 * Helper to verify internal employee team-assignment or Admin access
 */
async function verifyTeamAccess(userId, user, projectId) {
  const project = await Project.findById(projectId);
  if (!project || !project.isActive) {
    return { allowed: false, statusCode: 404, message: 'Project not found.' };
  }

  const roleCode = await getUserRoleCode(user);
  if (['ADMIN', 'SUPER_ADMIN'].includes(roleCode)) {
    return { allowed: true, project };
  }

  const isAssigned = project.teamAssignments && project.teamAssignments.some(
    t => t.userId && t.userId.toString() === userId.toString()
  );

  if (!isAssigned) {
    return { allowed: false, statusCode: 403, message: 'Access denied. You are not assigned to this project team.' };
  }

  return { allowed: true, project };
}

/**
 * GET /api/projects/:projectId/chat
 * Team-scoped internal project chat history
 */
exports.getInternalProjectChat = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { since } = req.query || {};
    const userId = req.user ? (req.user._id || req.user.id) : null;

    const access = await verifyTeamAccess(userId, req.user, projectId);
    if (!access.allowed) {
      return sendError(res, access.statusCode, access.message);
    }

    const filter = { projectId };
    if (since) {
      filter.sentAt = { $gt: new Date(since) };
    }

    const rawMessages = await ChatMessage.find(filter)
      .populate('authorId', 'name email designation department phone permissionLevel')
      .populate('replyToMessageId')
      .populate('linkedTaskId', 'taskName status taskNumber')
      .populate({
        path: 'linkedDrawingVersionId',
        select: 'versionNumber drawingId filePath',
        populate: { path: 'drawingId', select: 'drawingName categoryName' }
      })
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
      projectId: access.project._id,
      projectName: access.project.projectName || access.project.name,
      messages,
      totalCount: messages.length
    });
  } catch (error) {
    console.error('Error retrieving internal project chat:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve project chat history.');
  }
};

/**
 * POST /api/projects/:projectId/chat/message
 * Send message with optional Task and DrawingVersion contextual references
 */
exports.sendInternalMessage = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { messageText, mentionedIds, replyToMessageId, linkedTaskId, linkedDrawingVersionId } = req.body;
    const userId = req.user ? (req.user._id || req.user.id) : null;

    if (!messageText || !messageText.trim()) {
      return sendError(res, 400, 'Message text is required.');
    }

    const access = await verifyTeamAccess(userId, req.user, projectId);
    if (!access.allowed) {
      return sendError(res, access.statusCode, access.message);
    }

    // Validate linkedTaskId belongs to same project
    if (linkedTaskId) {
      const task = await Task.findById(linkedTaskId);
      if (!task || task.projectId.toString() !== projectId.toString()) {
        return sendError(res, 400, 'linkedTaskId does not exist or does not belong to this project.');
      }
    }

    // Validate linkedDrawingVersionId belongs to same project
    if (linkedDrawingVersionId) {
      const version = await DrawingVersion.findById(linkedDrawingVersionId);
      if (!version) {
        return sendError(res, 400, 'linkedDrawingVersionId not found.');
      }
      const drawing = await Drawing.findById(version.drawingId);
      if (!drawing || drawing.projectId.toString() !== projectId.toString()) {
        return sendError(res, 400, 'linkedDrawingVersionId drawing does not belong to this project.');
      }
    }

    const createdMsg = await ChatMessage.create({
      projectId,
      authorType: 'EMPLOYEE',
      authorId: userId,
      authorModel: 'User',
      messageText: messageText.trim(),
      mentionedIds: Array.isArray(mentionedIds) ? mentionedIds : [],
      replyToMessageId: replyToMessageId || null,
      linkedTaskId: linkedTaskId || null,
      linkedDrawingVersionId: linkedDrawingVersionId || null,
      sentAt: new Date()
    });

    const populatedMsg = await ChatMessage.findById(createdMsg._id)
      .populate('authorId', 'name email designation department phone')
      .populate('replyToMessageId')
      .populate('linkedTaskId', 'taskName status taskNumber')
      .populate({
        path: 'linkedDrawingVersionId',
        select: 'versionNumber drawingId filePath',
        populate: { path: 'drawingId', select: 'drawingName categoryName' }
      });

    const mObj = populatedMsg.toObject();
    const desig = mObj.authorId ? mObj.authorId.designation || 'Staff' : 'Staff';
    mObj.formattedAuthorName = `${mObj.authorId ? mObj.authorId.name : 'Employee'} (${desig})`;

    // Real-Time Socket.io Broadcast to shared project room
    emitToProjectRoom(projectId, 'new_message', { message: mObj });

    // Internal Notification Dispatching
    if (Array.isArray(mentionedIds) && mentionedIds.length > 0) {
      InternalNotificationDispatcher.dispatch({
        userIds: mentionedIds.map(id => id.toString()),
        projectId,
        type: 'CHAT_MENTION',
        title: 'You were mentioned in Project Chat',
        message: `${mObj.authorId ? mObj.authorId.name : 'Team member'} mentioned you: "${messageText.slice(0, 50)}..."`,
        deepLink: `project/${projectId}/chat`,
        refId: createdMsg._id
      }).catch(err => console.error('Chat mention notification dispatch error:', err));
    } else {
      InternalNotificationDispatcher.dispatch({
        broadcastToRoles: ['PROJECT_MANAGER', 'SUPER_ADMIN'],
        projectId,
        type: 'CHAT_NEW_MESSAGE',
        title: 'New Project Chat Message',
        message: `${mObj.authorId ? mObj.authorId.name : 'Team member'}: "${messageText.slice(0, 50)}..."`,
        deepLink: `project/${projectId}/chat`,
        refId: createdMsg._id
      }).catch(err => console.error('Chat new message notification dispatch error:', err));
    }

    return sendSuccess(res, 201, 'Internal chat message sent successfully.', { message: mObj });
  } catch (error) {
    console.error('Error sending internal chat message:', error);
    return sendError(res, 500, error.message || 'Failed to send internal chat message.');
  }
};

/**
 * POST /api/projects/:projectId/chat/sync
 * Batch sync offline composed messages
 */
exports.syncOfflineMessages = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { messages } = req.body;
    const userId = req.user ? (req.user._id || req.user.id) : null;

    if (!Array.isArray(messages) || messages.length === 0) {
      return sendError(res, 400, 'messages array is required and must not be empty.');
    }

    const access = await verifyTeamAccess(userId, req.user, projectId);
    if (!access.allowed) {
      return sendError(res, access.statusCode, access.message);
    }

    const syncedMessages = [];

    for (const item of messages) {
      if (!item.messageText || !item.messageText.trim()) continue;

      const created = await ChatMessage.create({
        projectId,
        authorType: 'EMPLOYEE',
        authorId: userId,
        authorModel: 'User',
        messageText: item.messageText.trim(),
        mentionedIds: Array.isArray(item.mentionedIds) ? item.mentionedIds : [],
        replyToMessageId: item.replyToMessageId || null,
        linkedTaskId: item.linkedTaskId || null,
        linkedDrawingVersionId: item.linkedDrawingVersionId || null,
        isOfflineSync: true,
        localComposedAt: item.localComposedAt ? new Date(item.localComposedAt) : null,
        sentAt: new Date()
      });

      const populated = await ChatMessage.findById(created._id)
        .populate('authorId', 'name email designation department phone')
        .populate('replyToMessageId')
        .populate('linkedTaskId', 'taskName status taskNumber')
        .populate({
          path: 'linkedDrawingVersionId',
          select: 'versionNumber drawingId filePath',
          populate: { path: 'drawingId', select: 'drawingName categoryName' }
        });

      const mObj = populated.toObject();
      const desig = mObj.authorId ? mObj.authorId.designation || 'Staff' : 'Staff';
      mObj.formattedAuthorName = `${mObj.authorId ? mObj.authorId.name : 'Employee'} (${desig})`;

      emitToProjectRoom(projectId, 'new_message', { message: mObj });
      syncedMessages.push(mObj);
    }

    return sendSuccess(res, 201, `Synced ${syncedMessages.length} offline chat messages successfully.`, {
      syncedMessages,
      count: syncedMessages.length
    });
  } catch (error) {
    console.error('Error syncing offline messages:', error);
    return sendError(res, 500, error.message || 'Failed to sync offline chat messages.');
  }
};

/**
 * PUT /api/projects/:projectId/chat/mark-read
 * Mark caller's last read timestamp for a project
 */
exports.markChatRead = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user ? (req.user._id || req.user.id) : null;

    const access = await verifyTeamAccess(userId, req.user, projectId);
    if (!access.allowed) {
      return sendError(res, access.statusCode, access.message);
    }

    const now = new Date();
    const readStatus = await EmployeeChatReadStatus.findOneAndUpdate(
      { userId, projectId },
      { lastReadMessageAt: now },
      { upsert: true, returnDocument: 'after' }
    );

    return sendSuccess(res, 200, 'Chat marked as read successfully.', { readStatus });
  } catch (error) {
    console.error('Error marking chat as read:', error);
    return sendError(res, 500, error.message || 'Failed to mark chat as read.');
  }
};

/**
 * GET /api/chat/unread-counts
 * Unread message counts across projects for calling employee
 */
exports.getUnreadCounts = async (req, res) => {
  try {
    const userId = req.user ? (req.user._id || req.user.id) : null;
    const roleCode = await getUserRoleCode(req.user);

    let projects = [];
    if (['ADMIN', 'SUPER_ADMIN'].includes(roleCode)) {
      projects = await Project.find({ isActive: true });
    } else {
      projects = await Project.find({
        isActive: true,
        'teamAssignments.userId': userId
      });
    }

    const readStatuses = await EmployeeChatReadStatus.find({ userId });
    const statusMap = {};
    readStatuses.forEach(rs => {
      statusMap[rs.projectId.toString()] = rs.lastReadMessageAt;
    });

    const unreadSummary = [];

    for (const proj of projects) {
      const pId = proj._id.toString();
      const lastRead = statusMap[pId];
      let count = 0;

      if (lastRead) {
        count = await ChatMessage.countDocuments({ projectId: pId, sentAt: { $gt: lastRead } });
      } else {
        count = await ChatMessage.countDocuments({ projectId: pId });
      }

      unreadSummary.push({
        projectId: pId,
        projectName: proj.projectName || proj.name,
        unreadCount: count,
        lastReadMessageAt: lastRead || null
      });
    }

    return sendSuccess(res, 200, 'Employee chat unread counts retrieved successfully.', { unreadSummary });
  } catch (error) {
    console.error('Error fetching chat unread counts:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve unread counts.');
  }
};
