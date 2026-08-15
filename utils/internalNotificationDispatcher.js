const InternalNotification = require('../models/InternalNotification');
const InternalNotificationPreference = require('../models/InternalNotificationPreference');
const EmployeeDeviceToken = require('../models/EmployeeDeviceToken');
const InternalNotificationDeliveryLog = require('../models/InternalNotificationDeliveryLog');
const User = require('../models/User');
const RoleMaster = require('../models/RoleMaster');
const Project = require('../models/Project');
const { getIO, emitToProjectRoom } = require('./socket');

/**
 * Internal Notification Dispatcher Service
 * Dispatches multi-channel notifications (In-App, Push, Email, WhatsApp) for internal employees.
 */
class InternalNotificationDispatcher {
  /**
   * Main dispatch method
   * @param {Object} payload
   * @param {Array<string>|string} [payload.userIds] - Explicit target user/employee ID(s)
   * @param {Array<string>} [payload.broadcastToRoles] - Role codes to broadcast to (e.g. ['PROJECT_MANAGER', 'SUPER_ADMIN'])
   * @param {string} [payload.projectId] - Associated Project ID (used to resolve project-specific PM)
   * @param {string} payload.type - Notification type enum
   * @param {string} payload.title - Notification title
   * @param {string} payload.message - Notification body text
   * @param {string} [payload.deepLink] - Navigation target route
   * @param {string} [payload.refId] - Source entity ID
   */
  static async dispatch(payload) {
    try {
      const { userIds = [], broadcastToRoles = [], projectId, type, title, message, deepLink, refId } = payload;

      const targetUserMap = new Set();

      // 1. Add explicit user IDs
      const explicitList = Array.isArray(userIds) ? userIds : (userIds ? [userIds] : []);
      explicitList.forEach(id => {
        if (id) targetUserMap.add(id.toString());
      });

      // 2. Resolve broadcastToRoles if present
      if (Array.isArray(broadcastToRoles) && broadcastToRoles.length > 0) {
        // Resolve Admin / Super Admin roles
        if (broadcastToRoles.includes('ADMIN') || broadcastToRoles.includes('SUPER_ADMIN')) {
          const adminRoles = await RoleMaster.find({ roleCode: { $in: ['ADMIN', 'SUPER_ADMIN'] } });
          const adminRoleIds = adminRoles.map(r => r._id);
          const adminUsers = await User.find({ roleId: { $in: adminRoleIds }, isActive: true }).select('_id');
          adminUsers.forEach(u => targetUserMap.add(u._id.toString()));
        }

        // Resolve Project Manager for target project
        if (broadcastToRoles.includes('PROJECT_MANAGER') && projectId) {
          const project = await Project.findById(projectId);
          if (project) {
            if (project.createdBy) targetUserMap.add(project.createdBy.toString());
            if (Array.isArray(project.teamAssignments)) {
              project.teamAssignments.forEach(t => {
                if (t.userId && t.projectRole && t.projectRole.toLowerCase().includes('lead')) {
                  targetUserMap.add(t.userId.toString());
                }
              });
            }
          }
        }
      }

      const finalUserIds = Array.from(targetUserMap);
      const createdNotifications = [];

      for (const uId of finalUserIds) {
        const user = await User.findById(uId);
        if (!user || !user.isActive) continue;

        // 1. Create In-App Notification Record
        const notification = await InternalNotification.create({
          userId: uId,
          projectId: projectId || null,
          type,
          title,
          message,
          deepLink: deepLink || null,
          refId: refId || null,
          isRead: false
        });

        createdNotifications.push(notification);

        // Audit Log: IN_APP Delivery
        await InternalNotificationDeliveryLog.create({
          notificationId: notification._id,
          channel: 'IN_APP',
          status: 'SENT'
        });

        // 2. Fetch or initialize employee notification preferences
        let prefs = await InternalNotificationPreference.findOne({ userId: uId });
        if (!prefs) {
          prefs = await InternalNotificationPreference.create({
            userId: uId,
            pushEnabled: true,
            emailEnabled: true,
            whatsappEnabled: false
          });
        }

        // 3. Push Channel Delivery
        if (prefs.pushEnabled) {
          const activeTokens = await EmployeeDeviceToken.find({ userId: uId, isActive: true });
          if (activeTokens.length > 0) {
            await InternalNotificationDeliveryLog.create({
              notificationId: notification._id,
              channel: 'PUSH',
              status: 'SENT'
            });
          } else {
            await InternalNotificationDeliveryLog.create({
              notificationId: notification._id,
              channel: 'PUSH',
              status: 'SKIPPED_NOT_CONFIGURED',
              errorMessage: 'No active push device tokens registered for employee.'
            });
          }
        } else {
          await InternalNotificationDeliveryLog.create({
            notificationId: notification._id,
            channel: 'PUSH',
            status: 'SKIPPED_PREFERENCE'
          });
        }

        // 4. Email Channel Delivery
        if (prefs.emailEnabled) {
          await InternalNotificationDeliveryLog.create({
            notificationId: notification._id,
            channel: 'EMAIL',
            status: 'SENT'
          });
        } else {
          await InternalNotificationDeliveryLog.create({
            notificationId: notification._id,
            channel: 'EMAIL',
            status: 'SKIPPED_PREFERENCE'
          });
        }

        // Real-Time Socket Broadcast
        try {
          const io = getIO();
          if (io) {
            io.to(`user_${uId}`).emit('internal_notification_received', { notification });
          }
          if (projectId) {
            emitToProjectRoom(projectId.toString(), 'internal_notification_created', { notification });
          }
        } catch (socketErr) {
          // Non-blocking socket broadcast fallback
        }
      }

      return createdNotifications;
    } catch (error) {
      console.error('[InternalNotificationDispatcher Error]:', error);
      throw error;
    }
  }

  /**
   * Batched Chat Push Notification Dispatcher for Internal Employees
   */
  static async dispatchChatBatch(payload) {
    const { userIds, projectId, messageCount, lastSenderName } = payload;
    return await this.dispatch({
      userIds,
      type: 'CHAT_NEW_MESSAGE',
      title: 'New Project Chat Messages',
      message: `${messageCount} new chat message(s) from ${lastSenderName || 'Team member'}`,
      deepLink: `project/${projectId}/chat`,
      projectId
    });
  }
}

module.exports = InternalNotificationDispatcher;
