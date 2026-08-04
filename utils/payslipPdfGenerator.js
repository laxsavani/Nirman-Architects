const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Generates a PDF Payslip for a given payroll record and user details.
 * Can write to a file path or pipe to an HTTP response stream.
 */
function generatePayslipPDF(payroll, user, resStream = null, filePath = null) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });

      let writeStream;
      if (filePath) {
        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        writeStream = fs.createWriteStream(filePath);
        doc.pipe(writeStream);
      }

      if (resStream) {
        doc.pipe(resStream);
      }

      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const monthStr = monthNames[payroll.month - 1] || payroll.month;

      // Header
      doc.fillColor('#1E293B')
         .fontSize(22)
         .font('Helvetica-Bold')
         .text('NIRMAN ARCHITECTS', { align: 'center' });
      doc.fontSize(12)
         .font('Helvetica')
         .fillColor('#64748B')
         .text('PAYSLIP FOR THE MONTH OF ' + monthStr.toUpperCase() + ' ' + payroll.year, { align: 'center' });
      doc.moveDown(1.5);

      // Horizontal Divider
      doc.strokeColor('#E2E8F0').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(1);

      // Employee Information Box
      const startY = doc.y;
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1E293B').text('EMPLOYEE DETAILS', 50, startY);
      doc.moveDown(0.5);

      doc.font('Helvetica').fontSize(9).fillColor('#334155');
      doc.text(`Employee Name: ${user.name || 'N/A'}`);
      doc.text(`Email: ${user.email || 'N/A'}`);
      doc.text(`Department: ${user.department || 'General'}`);
      doc.text(`Designation: ${user.designation || 'Staff'}`);

      doc.moveDown(1);
      doc.strokeColor('#E2E8F0').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(1);

      // Attendance & Salary Summary Table
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1E293B').text('ATTENDANCE & LEAVE BREAKDOWN', 50);
      doc.moveDown(0.5);

      doc.font('Helvetica').fontSize(9).fillColor('#334155');
      const col1 = 50;
      const col2 = 300;

      let tableY = doc.y;
      doc.text(`Days in Month: ${payroll.daysInMonth}`, col1, tableY);
      doc.text(`Present Days: ${payroll.presentDays}`, col2, tableY);
      tableY += 16;

      doc.text(`Paid Leave Days: ${payroll.paidLeaveDays}`, col1, tableY);
      doc.text(`Unpaid Leave Days: ${payroll.unpaidLeaveDays}`, col2, tableY);
      tableY += 16;

      doc.text(`Absent Days: ${payroll.absentDays}`, col1, tableY);
      doc.text(`Per Day Rate: ₹${payroll.perDaySalary.toFixed(2)}`, col2, tableY);
      tableY += 24;

      doc.y = tableY;
      doc.strokeColor('#E2E8F0').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(1);

      // Financial Calculation
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1E293B').text('FINANCIAL SUMMARY', 50);
      doc.moveDown(0.5);

      tableY = doc.y;
      doc.font('Helvetica').fontSize(10).fillColor('#334155');

      doc.text('Base Salary:', col1, tableY);
      doc.text(`₹${payroll.baseSalary.toFixed(2)}`, col2, tableY, { align: 'right', width: 200 });
      tableY += 18;

      doc.text('Total Deductions (Unpaid/Absent):', col1, tableY);
      doc.fillColor('#EF4444').text(`- ₹${payroll.totalDeduction.toFixed(2)}`, col2, tableY, { align: 'right', width: 200 });
      tableY += 24;

      doc.y = tableY;
      doc.strokeColor('#CBD5E1').lineWidth(1.5).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.8);

      // Net Salary Box
      tableY = doc.y;
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#0F172A');
      doc.text('NET SALARY PAYABLE:', col1, tableY);
      doc.fillColor('#10B981').text(`₹${payroll.netSalary.toFixed(2)}`, col2, tableY, { align: 'right', width: 200 });

      doc.moveDown(3);
      doc.fontSize(8).font('Helvetica-Oblique').fillColor('#94A3B8')
         .text('This is a computer-generated payslip and does not require a physical signature.', 50, doc.y, { align: 'center' });

      doc.end();

      if (writeStream) {
        writeStream.on('finish', () => resolve(filePath));
        writeStream.on('error', (err) => reject(err));
      } else {
        resolve(true);
      }
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generatePayslipPDF };
