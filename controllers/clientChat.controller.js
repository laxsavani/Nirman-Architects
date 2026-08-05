const ChatMessage = require('../models/ChatMessage');
const ClientChatReadStatus = require('../models/ClientChatReadStatus');
const ClientProjectLink = require('../models/ClientProjectLink');
const Project = require('../models/Project');
const { sendSuccess, sendError } = require('../utils/response');
const { emitToProjectRoom } = require('../utils/socket');

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
 * GET /api/client/chat/:projectId?since=
 * Returns chronological chat history for a project, optionally filtered after 'since' timestamp.
 */
exports.getProjectChat = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { since } = req.query;
    const { clientId, contactId } = req.clientContact;

    // Security Isolation Check
    const link = await verifyProjectLink(clientId, projectId);
    if (!link) {
      return sendError(res, 403, 'Access denied. This project is not linked or visible to your Client account.');
    }

    const filter = { projectId };
    if (since) {
      filter.sentAt = { $gt: new Date(since) };
    }

    const rawMessages = await ChatMessage.find(filter)
      .populate('authorId', 'name email phone permissionLevel isPrimaryContact designation')
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

    // Calculate unread count
    const readStatus = await ClientChatReadStatus.findOne({ contactId, projectId });
    const lastRead = readStatus ? readStatus.lastReadMessageAt : null;

    let unreadCount = 0;
    if (lastRead) {
      unreadCount = await ChatMessage.countDocuments({ projectId, sentAt: { $gt: lastRead } });
    } else {
      unreadCount = await ChatMessage.countDocuments({ projectId });
    }

    return sendSuccess(res, 200, 'Project chat history retrieved successfully.', {
      projectId,
      messages,
      unreadCount,
      totalCount: messages.length
    });
  } catch (error) {
    console.error('Error fetching project chat:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve chat history.');
  }
};

/**
 * POST /api/client/chat/:projectId/message
 * Send a chat message (OWNER / MEMBER only). Persists message and broadcasts via Socket.io.
 */
exports.sendMessage = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { messageText, mentionedIds, replyToMessageId } = req.body;
    const { clientId, contactId, permissionLevel } = req.clientContact;

    // Permission Check: OWNER or MEMBER only
    if (['VIEW_ONLY'].includes(permissionLevel)) {
      return sendError(res, 403, 'Access denied. View Only accounts cannot post chat messages.');
    }

    if (!messageText || !messageText.trim()) {
      return sendError(res, 400, 'Message text is required.');
    }

    // Security Isolation Check
    const link = await verifyProjectLink(clientId, projectId);
    if (!link) {
      return sendError(res, 403, 'Access denied. This project is not linked or visible to your Client account.');
    }

    const createdMsg = await ChatMessage.create({
      projectId,
      authorType: 'CLIENT_CONTACT',
      authorId: contactId,
      authorModel: 'ClientContact',
      messageText: messageText.trim(),
      mentionedIds: Array.isArray(mentionedIds) ? mentionedIds : [],
      replyToMessageId: replyToMessageId || null,
      sentAt: new Date()
    });

    const populatedMsg = await ChatMessage.findById(createdMsg._id)
      .populate('authorId', 'name email phone permissionLevel isPrimaryContact')
      .populate('replyToMessageId');

    const mObj = populatedMsg.toObject();
    const roleLabel = mObj.authorId ? mObj.authorId.permissionLevel : 'Contact';
    mObj.formattedAuthorName = `${mObj.authorId ? mObj.authorId.name : 'Client'} (${roleLabel})`;

    // Real-Time Socket.io Broadcast to project room
    emitToProjectRoom(projectId, 'new_message', { message: mObj });

    return sendSuccess(res, 201, 'Message sent successfully.', { message: mObj });
  } catch (error) {
    console.error('Error sending client chat message:', error);
    return sendError(res, 500, error.message || 'Failed to send message.');
  }
};

/**
 * POST /api/client/chat/:projectId/sync
 * Batch sync messages composed while offline.
 */
exports.syncOfflineMessages = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { messages } = req.body;
    const { clientId, contactId, permissionLevel } = req.clientContact;

    if (['VIEW_ONLY'].includes(permissionLevel)) {
      return sendError(res, 403, 'Access denied. View Only accounts cannot sync chat messages.');
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return sendError(res, 400, 'Array of messages is required for offline sync.');
    }

    const link = await verifyProjectLink(clientId, projectId);
    if (!link) {
      return sendError(res, 403, 'Access denied. Project is not linked or visible to your Client account.');
    }

    const syncedMessages = [];

    for (const msg of messages) {
      if (!msg.messageText || !msg.messageText.trim()) continue;

      const sentAt = msg.localComposedAt ? new Date(msg.localComposedAt) : new Date();

      const created = await ChatMessage.create({
        projectId,
        authorType: 'CLIENT_CONTACT',
        authorId: contactId,
        authorModel: 'ClientContact',
        messageText: msg.messageText.trim(),
        mentionedIds: Array.isArray(msg.mentionedIds) ? msg.mentionedIds : [],
        replyToMessageId: msg.replyToMessageId || null,
        isOfflineSync: true,
        localComposedAt: sentAt,
        sentAt
      });

      const populated = await ChatMessage.findById(created._id)
        .populate('authorId', 'name email phone permissionLevel')
        .populate('replyToMessageId');

      const mObj = populated.toObject();
      mObj.formattedAuthorName = `${mObj.authorId ? mObj.authorId.name : 'Client'} (${mObj.authorId ? mObj.authorId.permissionLevel : 'Contact'})`;

      emitToProjectRoom(projectId, 'new_message', { message: mObj });
      syncedMessages.push(mObj);
    }

    return sendSuccess(res, 200, 'Offline messages synced successfully.', {
      syncedCount: syncedMessages.length,
      messages: syncedMessages
    });
  } catch (error) {
    console.error('Error syncing offline chat messages:', error);
    return sendError(res, 500, error.message || 'Failed to sync offline messages.');
  }
};

/**
 * PUT /api/client/chat/:projectId/mark-read
 * Marks chat as read for calling contact and project.
 */
exports.markAsRead = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { clientId, contactId } = req.clientContact;

    const link = await verifyProjectLink(clientId, projectId);
    if (!link) {
      return sendError(res, 403, 'Access denied. Project is not linked or visible to your Client account.');
    }

    const readStatus = await ClientChatReadStatus.findOneAndUpdate(
      { contactId, projectId },
      { lastReadMessageAt: new Date() },
      { upsert: true, new: true }
    );

    return sendSuccess(res, 200, 'Chat marked as read.', {
      projectId,
      lastReadMessageAt: readStatus.lastReadMessageAt
    });
  } catch (error) {
    console.error('Error marking chat as read:', error);
    return sendError(res, 500, error.message || 'Failed to mark chat as read.');
  }
};

/**
 * GET /api/client/chat/unread-counts
 * Returns unread message count per linked project for calling contact.
 */
exports.getUnreadCounts = async (req, res) => {
  try {
    const { clientId, contactId } = req.clientContact;

    const activeLinks = await ClientProjectLink.find({
      clientId,
      isActive: true,
      visibleToClient: true
    }).populate('projectId', 'name status');

    const unreadCounts = [];

    for (const link of activeLinks) {
      if (!link.projectId) continue;

      const pId = link.projectId._id;
      const readStatus = await ClientChatReadStatus.findOne({ contactId, projectId: pId });
      const lastRead = readStatus ? readStatus.lastReadMessageAt : null;

      let count = 0;
      if (lastRead) {
        count = await ChatMessage.countDocuments({ projectId: pId, sentAt: { $gt: lastRead } });
      } else {
        count = await ChatMessage.countDocuments({ projectId: pId });
      }

      unreadCounts.push({
        projectId: pId,
        projectName: link.projectId.name,
        unreadCount: count
      });
    }

    return sendSuccess(res, 200, 'Unread message counts retrieved successfully.', { unreadCounts });
  } catch (error) {
    console.error('Error fetching unread chat counts:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve unread counts.');
  }
};
