const cron = require('node-cron');
const User = require('../models/User');
const Payroll = require('../models/Payroll');
const { calculateMonthlySalary } = require('../utils/salaryCalculator');
const { generatePayslipPDF } = require('../utils/payslipPdfGenerator');
const { getSalaryStorageDir } = require('../utils/storage');
const path = require('path');

/**
 * Monthly Auto Payroll Generation Cron Job
 * Runs on the 1st of every month at midnight ('0 0 1 * *') for the previous month.
 * Saves PDFs under storage/salary/ directory.
 */
function initPayrollGenerationCron() {
  cron.schedule('0 0 1 * *', async () => {
    try {
      console.log('[Cron] Starting automatic monthly payroll generation...');
      const now = new Date();
      let targetMonth = now.getMonth(); // Previous month
      let targetYear = now.getFullYear();

      if (targetMonth === 0) {
        targetMonth = 12;
        targetYear -= 1;
      }

      const activeUsers = await User.find({ isActive: true });
      let generatedCount = 0;
      const salaryDir = getSalaryStorageDir();

      for (const user of activeUsers) {
        if (!user.baseSalary || user.baseSalary <= 0) continue;

        const salaryDetails = await calculateMonthlySalary(user, targetMonth, targetYear);
        const pdfFileName = `payslip_${user._id}_${targetYear}_${targetMonth}.pdf`;
        const pdfPath = path.join(salaryDir, pdfFileName);

        await generatePayslipPDF(salaryDetails, user, null, pdfPath);

        await Payroll.findOneAndUpdate(
          { userId: user._id, month: targetMonth, year: targetYear },
          {
            ...salaryDetails,
            generatedAt: new Date(),
            pdfPath: pdfFileName
          },
          { upsert: true, returnDocument: 'after' }
        );

        generatedCount++;
      }

      console.log(`[Cron] Auto-generated payroll for ${generatedCount} user(s) for month ${targetMonth}/${targetYear} saved under storage/salary/.`);
    } catch (err) {
      console.error('[Cron] Error in payrollGenerationCron:', err);
    }
  });
}

module.exports = initPayrollGenerationCron;
