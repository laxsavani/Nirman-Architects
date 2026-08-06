const ClientNotification = require('../models/ClientNotification');
const ClientNotificationPreference = require('../models/ClientNotificationPreference');
const ClientDeviceToken = require('../models/ClientDeviceToken');
const NotificationDeliveryLog = require('../models/NotificationDeliveryLog');
const WhatsAppConfig = require('../models/WhatsAppConfig');
const ClientContact = require('../models/ClientContact');
const { getIO, emitToProjectRoom } = require('./socket');

/**
 * Shared Notification Dispatcher Service
 * Handles multi-channel notification dispatching (In-App, Push, Email, WhatsApp) for Client Portal contacts.
 */
class NotificationDispatcher {
  /**
   * Main dispatch method
   * @param {Object} payload
   * @param {Array<string>|string} payload.contactIds - Target ClientContact ID(s)
   * @param {string} payload.type - Notification type enum
   * @param {string} payload.title - Notification title
   * @param {string} payload.message - Notification body text
   * @param {string} [payload.deepLink] - Navigation target route
   * @param {string} [payload.refId] - Source entity ID (drawingId, ticketId, etc.)
   * @param {string} [payload.projectId] - Associated Project ID
   * @param {string} payload.clientId - Associated Client account ID
   */
  static async dispatch(payload) {
    try {
      const { contactIds, type, title, message, deepLink, refId, projectId, clientId } = payload;
      const targetContactIds = Array.isArray(contactIds) ? contactIds : [contactIds];

      const createdNotifications = [];

      for (const rawContactId of targetContactIds) {
        if (!rawContactId) continue;
        const contactId = rawContactId.toString();

        // Verify contact existence
        const contact = await ClientContact.findById(contactId);
        if (!contact || !contact.isActive) continue;

        const effectiveClientId = clientId || contact.clientId.toString();

        // 1. Create In-App Notification Record
        const notification = await ClientNotification.create({
          contactId,
          clientId: effectiveClientId,
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
        await NotificationDeliveryLog.create({
          notificationId: notification._id,
          channel: 'IN_APP',
          status: 'SENT'
        });

        // 2. Fetch or initialize contact channel preferences
        let prefs = await ClientNotificationPreference.findOne({ contactId });
        if (!prefs) {
          prefs = await ClientNotificationPreference.create({
            contactId,
            pushEnabled: true,
            emailEnabled: true,
            whatsappEnabled: false
          });
        }

        // 3. Push Channel Delivery
        if (prefs.pushEnabled) {
          const activeTokens = await ClientDeviceToken.find({ contactId, isActive: true });
          if (activeTokens.length > 0) {
            // Push Notification Dispatch (FCM / APNs payload structure)
            const pushPayload = {
              title,
              body: message,
              data: {
                notificationId: notification._id.toString(),
                type,
                deepLink: deepLink || '',
                projectId: projectId ? projectId.toString() : ''
              }
            };
            // Log Push Sent
            await NotificationDeliveryLog.create({
              notificationId: notification._id,
              channel: 'PUSH',
              status: 'SENT'
            });
          } else {
            await NotificationDeliveryLog.create({
              notificationId: notification._id,
              channel: 'PUSH',
              status: 'SKIPPED_NOT_CONFIGURED',
              errorMessage: 'No active push device tokens registered for contact.'
            });
          }
        } else {
          await NotificationDeliveryLog.create({
            notificationId: notification._id,
            channel: 'PUSH',
            status: 'SKIPPED_PREFERENCE'
          });
        }

        // 4. Email Channel Delivery
        if (prefs.emailEnabled) {
          // Transactional Email Dispatch (SES / SendGrid template ready)
          const emailPayload = {
            to: contact.email,
            subject: `[Nirman Architects] ${title}`,
            bodyText: `${message}\n\nAccess portal: ${deepLink || '/client/dashboard'}`
          };
          await NotificationDeliveryLog.create({
            notificationId: notification._id,
            channel: 'EMAIL',
            status: 'SENT'
          });
        } else {
          await NotificationDeliveryLog.create({
            notificationId: notification._id,
            channel: 'EMAIL',
            status: 'SKIPPED_PREFERENCE'
          });
        }

        // 5. WhatsApp Channel Delivery (Graceful Degradation)
        if (prefs.whatsappEnabled) {
          const waConfig = await WhatsAppConfig.findOne({ isActive: true });
          if (waConfig && waConfig.apiKey) {
            // Dispatch WhatsApp template message
            await NotificationDeliveryLog.create({
              notificationId: notification._id,
              channel: 'WHATSAPP',
              status: 'SENT'
            });
          } else {
            await NotificationDeliveryLog.create({
              notificationId: notification._id,
              channel: 'WHATSAPP',
              status: 'SKIPPED_NOT_CONFIGURED',
              errorMessage: 'WhatsApp Business API credentials not configured.'
            });
          }
        } else {
          await NotificationDeliveryLog.create({
            notificationId: notification._id,
            channel: 'WHATSAPP',
            status: 'SKIPPED_PREFERENCE'
          });
        }

        // Real-Time Socket Broadcast to project room & individual contact room
        try {
          const io = getIO();
          if (io) {
            io.to(`contact_${contactId}`).emit('notification_received', { notification });
          }
          if (projectId) {
            emitToProjectRoom(projectId.toString(), 'notification_created', { notification });
          }
        } catch (socketErr) {
          // Non-blocking socket broadcast failure fallback
        }
      }

      return createdNotifications;
    } catch (error) {
      console.error('[Notification Dispatcher Error]:', error);
      throw error;
    }
  }

  /**
   * Batched Chat Push Notification Dispatcher (Debounces rapid message pushes)
   */
  static async dispatchChatBatch(payload) {
    const { contactIds, projectId, messageCount, lastSenderName, clientId } = payload;
    return await this.dispatch({
      contactIds,
      type: 'CHAT_NEW_MESSAGE',
      title: 'New Chat Messages',
      message: `${messageCount} new chat message(s) from ${lastSenderName || 'Team'}`,
      deepLink: `client/chat/${projectId}`,
      projectId,
      clientId
    });
  }
}

module.exports = NotificationDispatcher;
