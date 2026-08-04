const cron = require('node-cron');
const Lead = require('../models/Lead');
const Notification = require('../models/Notification');

/**
 * Executes the follow-up reminder check.
 * Creates notifications for employees assigned to active leads whose follow-up date is due.
 */
async function runLeadFollowUpCheck() {
  try {
    console.log('[Cron] Checking for due lead follow-ups...');
    
    // Set target date to end of current day
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // Find active leads with follow-up date on or before today
    const dueLeads = await Lead.find({
      nextFollowUpDate: { $lte: endOfToday },
      status: { $nin: ['WON', 'LOST'] }
    }).populate('assignedTo', 'name email');

    let notificationCount = 0;

    for (const lead of dueLeads) {
      if (!lead.assignedTo) continue;

      const userId = lead.assignedTo._id || lead.assignedTo;
      const expectedMessage = `Follow-up due for lead: ${lead.name} (Phone: ${lead.phone})`;

      // Avoid creating duplicate notification if already created today for this lead
      const existingNotif = await Notification.findOne({
        userId,
        type: 'LEAD_FOLLOWUP_DUE',
        message: expectedMessage,
        createdAt: { $gte: startOfToday }
      });

      if (!existingNotif) {
        await Notification.create({
          userId,
          type: 'LEAD_FOLLOWUP_DUE',
          message: expectedMessage,
          isRead: false
        });
        notificationCount++;
      }
    }

    console.log(`[Cron] Lead follow-up check completed. Sent ${notificationCount} new notification(s) for ${dueLeads.length} due lead(s).`);
    return { dueLeadsCount: dueLeads.length, notificationCount };
  } catch (error) {
    console.error('[Cron] Error in runLeadFollowUpCheck:', error);
    throw error;
  }
}

/**
 * Initialize daily scheduled cron job at 09:00 AM ('0 9 * * *')
 */
function initLeadFollowUpCron() {
  cron.schedule('0 9 * * *', async () => {
    await runLeadFollowUpCheck();
  });
  console.log('⏰ Lead Follow-Up Daily Cron Job initialized (09:00 AM daily).');
}

module.exports = {
  initLeadFollowUpCron,
  runLeadFollowUpCheck
};
