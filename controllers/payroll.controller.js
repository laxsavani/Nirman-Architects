const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const User = require('../models/User');
const Payroll = require('../models/Payroll');
const { calculateMonthlySalary } = require('../utils/salaryCalculator');
const { generatePayslipPDF } = require('../utils/payslipPdfGenerator');
const { getSalarySlipPath } = require('../utils/storagePathResolver');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Generate Payroll for all active users for a specific month and year.
 * Saves PDFs under /storage/salary/<userId>/<year>/
 */
exports.generateAllPayroll = async (req, res, next) => {
  try {
    const { month, year } = req.body;

    if (!month || !year) {
      return sendError(res, 400, 'month (1-12) and year are required.');
    }

    const targetMonth = Number(month);
    const targetYear = Number(year);

    if (targetMonth < 1 || targetMonth > 12) {
      return sendError(res, 400, 'Invalid month. Must be between 1 and 12.');
    }

    const activeUsers = await User.find({ isActive: true });
    const payrollRecords = [];

    for (const user of activeUsers) {
      if (!user.baseSalary || user.baseSalary <= 0) {
        continue;
      }

      const salaryDetails = await calculateMonthlySalary(user, targetMonth, targetYear);
      const pathInfo = getSalarySlipPath(user._id, targetMonth, targetYear);

      // Save PDF file under /storage/salary/<userId>/<year>/
      await generatePayslipPDF(salaryDetails, user, null, pathInfo.fullPath);

      // Upsert Payroll document with new structured relative path
      const payrollDoc = await Payroll.findOneAndUpdate(
        { userId: user._id, month: targetMonth, year: targetYear },
        {
          ...salaryDetails,
          generatedAt: new Date(),
          pdfPath: pathInfo.relativePath
        },
        { upsert: true, returnDocument: 'after' }
      );

      payrollRecords.push(payrollDoc);
    }

    return sendSuccess(res, 200, `Payroll generated for ${payrollRecords.length} active employee(s). PDFs saved under /storage/salary/<userId>/<year>/.`, {
      month: targetMonth,
      year: targetYear,
      count: payrollRecords.length,
      records: payrollRecords
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Generate Payroll for a single user for a specific month and year.
 * Saves PDF under /storage/salary/<userId>/<year>/
 */
exports.generateSingleUserPayroll = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { month, year } = req.body;

    if (!month || !year) {
      return sendError(res, 400, 'month (1-12) and year are required.');
    }

    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, 404, 'User not found.');
    }

    const targetMonth = Number(month);
    const targetYear = Number(year);

    const salaryDetails = await calculateMonthlySalary(user, targetMonth, targetYear);
    const pathInfo = getSalarySlipPath(user._id, targetMonth, targetYear);

    await generatePayslipPDF(salaryDetails, user, null, pathInfo.fullPath);

    const payrollDoc = await Payroll.findOneAndUpdate(
      { userId: user._id, month: targetMonth, year: targetYear },
      {
        ...salaryDetails,
        generatedAt: new Date(),
        pdfPath: pathInfo.relativePath
      },
      { upsert: true, returnDocument: 'after' }
    );

    return sendSuccess(res, 200, `Payroll generated for user ${user.name}. PDF saved under /storage/salary/${user._id}/${targetYear}/.`, payrollDoc);
  } catch (error) {
    next(error);
  }
};

/**
 * View own payroll record for a month/year.
 */
exports.getMyPayroll = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { month, year } = req.query;

    const query = { userId };
    if (month) query.month = Number(month);
    if (year) query.year = Number(year);

    const payrolls = await Payroll.find(query).sort({ year: -1, month: -1 });
    return sendSuccess(res, 200, 'My payroll history retrieved.', payrolls);
  } catch (error) {
    next(error);
  }
};

/**
 * Self-download own PDF payslip (strictly scoped to req.user.id).
 */
exports.downloadOwnPayslip = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { month, year } = req.query;

    if (!month || !year) {
      return sendError(res, 400, 'month and year are required.');
    }

    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, 404, 'User not found.');
    }

    let payroll = await Payroll.findOne({ userId, month: Number(month), year: Number(year) });
    if (!payroll) {
      const salaryDetails = await calculateMonthlySalary(user, Number(month), Number(year));
      payroll = await Payroll.create({
        ...salaryDetails,
        generatedAt: new Date()
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Payslip_${user.name.replace(/\s+/g, '_')}_${month}_${year}.pdf`);

    await generatePayslipPDF(payroll, user, res, null);
  } catch (error) {
    next(error);
  }
};

/**
 * SuperAdmin/HR: View all employee payroll records.
 */
exports.getAllPayroll = async (req, res, next) => {
  try {
    const { month, year, userId } = req.query;
    const query = {};

    if (month) query.month = Number(month);
    if (year) query.year = Number(year);
    if (userId) query.userId = userId;

    const records = await Payroll.find(query).populate('userId', 'name email department designation').sort({ year: -1, month: -1 });
    return sendSuccess(res, 200, 'All payroll records retrieved.', records);
  } catch (error) {
    next(error);
  }
};

/**
 * SuperAdmin: Download specific employee's payslip PDF.
 */
exports.downloadEmployeePayslip = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { month, year } = req.query;

    if (!month || !year) {
      return sendError(res, 400, 'month and year are required.');
    }

    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, 404, 'User not found.');
    }

    let payroll = await Payroll.findOne({ userId, month: Number(month), year: Number(year) });
    if (!payroll) {
      const salaryDetails = await calculateMonthlySalary(user, Number(month), Number(year));
      payroll = await Payroll.create({
        ...salaryDetails,
        generatedAt: new Date()
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Payslip_${user.name.replace(/\s+/g, '_')}_${month}_${year}.pdf`);

    await generatePayslipPDF(payroll, user, res, null);
  } catch (error) {
    next(error);
  }
};

/**
 * SuperAdmin: Bulk download all employee payslips for a given month as a ZIP file.
 * Pulls files from the new /storage/salary/<userId>/<year>/ structure across all employees.
 */
exports.downloadAllPayslipsZip = async (req, res, next) => {
  try {
    const { month, year } = req.query;

    if (!month || !year) {
      return sendError(res, 400, 'month and year are required.');
    }

    const targetMonth = Number(month);
    const targetYear = Number(year);

    const activeUsers = await User.find({ isActive: true });
    if (!activeUsers || activeUsers.length === 0) {
      return sendError(res, 404, 'No active employees found.');
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=Payslips_${targetMonth}_${targetYear}.zip`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    for (const user of activeUsers) {
      if (!user.baseSalary || user.baseSalary <= 0) continue;

      let payroll = await Payroll.findOne({ userId: user._id, month: targetMonth, year: targetYear });
      if (!payroll) {
        const salaryDetails = await calculateMonthlySalary(user, targetMonth, targetYear);
        payroll = await Payroll.create({
          ...salaryDetails,
          generatedAt: new Date()
        });
      }

      const pathInfo = getSalarySlipPath(user._id, targetMonth, targetYear);
      await generatePayslipPDF(payroll, user, null, pathInfo.fullPath);

      if (fs.existsSync(pathInfo.fullPath)) {
        const cleanName = (user.name || 'Employee').replace(/[^a-zA-Z0-9]/g, '_');
        archive.file(pathInfo.fullPath, { name: `Payslip_${cleanName}_${targetMonth}_${targetYear}.pdf` });
      }
    }

    await archive.finalize();
  } catch (error) {
    next(error);
  }
};
