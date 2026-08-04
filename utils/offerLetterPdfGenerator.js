const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

function buildOfferLetterDoc(doc, user, snapshotData) {
  const issueDate = new Date().toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  const joiningDateStr = new Date(snapshotData.joiningDateSnapshot || user.joiningDate || Date.now()).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  const salaryFormatted = Number(snapshotData.baseSalarySnapshot || user.baseSalary || 0).toLocaleString('en-IN');

  // Header / Letterhead
  doc.fillColor('#1E293B')
     .fontSize(22)
     .font('Helvetica-Bold')
     .text('NIRMAN ARCHITECTS', { align: 'center' });
  doc.fontSize(10)
     .font('Helvetica')
     .fillColor('#64748B')
     .text('Architectural Design | Urban Planning | Interior Excellence', { align: 'center' });
  doc.moveDown(1.5);

  // Horizontal Rule
  doc.strokeColor('#0284C7').lineWidth(2).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(1.2);

  // Issue Date & Reference
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#1E293B').text(`Date: ${issueDate}`, { align: 'right' });
  doc.moveDown(1);

  // Recipient Box
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#1E293B').text('LETTER OF OFFER');
  doc.moveDown(0.8);

  doc.font('Helvetica').fontSize(10).fillColor('#334155');
  doc.text(`To,`);
  doc.font('Helvetica-Bold').text(`${user.name || 'Candidate'}`);
  doc.font('Helvetica').text(`Email: ${user.email || 'N/A'}`);
  if (user.phone) doc.text(`Phone: ${user.phone}`);
  doc.moveDown(1.2);

  // Opening Salutation & Body
  doc.fontSize(10).font('Helvetica').fillColor('#1E293B');
  doc.text(`Dear ${user.name || 'Candidate'},`, { indent: 0 });
  doc.moveDown(0.8);

  doc.text(
    `We are pleased to offer you the position of `, { continued: true }
  ).font('Helvetica-Bold').text(`${snapshotData.designationSnapshot || 'Staff'}`, { continued: true })
  .font('Helvetica').text(` in the `, { continued: true })
  .font('Helvetica-Bold').text(`${snapshotData.departmentSnapshot || 'General'} Department`, { continued: true })
  .font('Helvetica').text(` at Nirman Architects.`);

  doc.moveDown(1);

  // Key Employment Terms Table/List
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#0F172A').text('Summary of Terms & Compensation:');
  doc.moveDown(0.5);

  const col1 = 60;
  const col2 = 250;
  let currY = doc.y;

  doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#334155');
  doc.text('Designation:', col1, currY);
  doc.font('Helvetica').text(`${snapshotData.designationSnapshot}`, col2, currY);
  currY += 18;

  doc.font('Helvetica-Bold').text('Department:', col1, currY);
  doc.font('Helvetica').text(`${snapshotData.departmentSnapshot}`, col2, currY);
  currY += 18;

  doc.font('Helvetica-Bold').text('Date of Joining:', col1, currY);
  doc.font('Helvetica').text(`${joiningDateStr}`, col2, currY);
  currY += 18;

  doc.font('Helvetica-Bold').text('Monthly Base Salary:', col1, currY);
  doc.font('Helvetica-Bold').fillColor('#059669').text(`₹${salaryFormatted} /- per month`, col2, currY);
  currY += 24;

  doc.y = currY;
  doc.moveDown(0.5);

  // General Clauses / Terms
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#1E293B').text('Standard Employment Clauses:');
  doc.moveDown(0.4);

  doc.font('Helvetica').fontSize(8.5).fillColor('#475569');
  doc.text('1. Probation Period: You will be on probation for a period of 3 months from your joining date.');
  doc.moveDown(0.3);
  doc.text('2. Working Hours: Official company hours are 9:30 AM to 6:30 PM, Monday through Saturday.');
  doc.moveDown(0.3);
  doc.text('3. Notice Period: Termination by either party requires a 30-day prior written notice.');
  doc.moveDown(0.3);
  doc.text('4. Confidentiality: You agree not to disclose proprietary drawings, designs, or client data.');

  doc.moveDown(2);

  // Signatures
  currY = doc.y;
  doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#1E293B');

  doc.text('For Nirman Architects,', 60, currY);
  doc.text('Employee Acknowledgment,', 340, currY);
  currY += 35;

  doc.font('Helvetica').fontSize(9).fillColor('#64748B');
  doc.text('_______________________', 60, currY);
  doc.text('_______________________', 340, currY);
  currY += 15;

  doc.text('Authorized Signatory', 60, currY);
  doc.text('Signature & Date', 340, currY);

  // Footer
  doc.moveDown(3);
  doc.fontSize(8).font('Helvetica-Oblique').fillColor('#94A3B8')
     .text('Nirman Architects | Headquarters: Corporate Office | Contact: hr@nirmanarchitects.com', 50, doc.y, { align: 'center' });

  doc.end();
}

/**
 * Generates Offer Letter PDF file to disk or resStream.
 */
function generateOfferLetterPDF(user, snapshotData, resStream = null, filePath = null) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });

      let writeStream = null;
      if (filePath) {
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

      buildOfferLetterDoc(doc, user, snapshotData);

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

/**
 * Generates Offer Letter PDF as Buffer.
 */
function generateOfferLetterBuffer(user, snapshotData) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      buildOfferLetterDoc(doc, user, snapshotData);
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generateOfferLetterPDF,
  generateOfferLetterBuffer
};
