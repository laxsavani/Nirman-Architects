const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Generates a clean PDF document for any ERP Module 8 report type.
 * @param {string} title Report Title (e.g. "PROJECT DASHBOARD & ANALYTICS REPORT")
 * @param {object} scopeInfo Object containing scope metadata (e.g. { project: 'Alpha', dateRange: '...' })
 * @param {Array<{ label: string, value: any }>} summaryCards Array of key-value summary tiles
 * @param {Array<string>} headers Column headers for data table
 * @param {Array<Array<any>>} rows Rows of data
 * @param {string} targetFilePath Output file path inside /storage/reports/
 */
function generateReportPDF(title, scopeInfo = {}, summaryCards = [], headers = [], rows = [], targetFilePath) {
  return new Promise((resolve, reject) => {
    try {
      const dir = path.dirname(targetFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const writeStream = fs.createWriteStream(targetFilePath);

      doc.pipe(writeStream);

      // Header Banner
      doc.fillColor('#0F172A')
         .fontSize(18)
         .font('Helvetica-Bold')
         .text('NIRMAN ARCHITECTS', { align: 'center' });
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .fillColor('#2563EB')
         .text(title.toUpperCase(), { align: 'center' });

      const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      doc.fontSize(9)
         .font('Helvetica')
         .fillColor('#64748B')
         .text(`Generated on: ${dateStr}`, { align: 'center' });

      doc.moveDown(1);
      doc.strokeColor('#CBD5E1').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(1);

      // Scope Metadata Box
      if (Object.keys(scopeInfo).length > 0) {
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#0F172A').text('REPORT SCOPE & PARAMETERS');
        doc.font('Helvetica').fontSize(9).fillColor('#334155');
        for (const [key, val] of Object.entries(scopeInfo)) {
          if (val !== undefined && val !== null) {
            doc.text(`${key}: ${val}`);
          }
        }
        doc.moveDown(1);
      }

      // Summary Cards
      if (summaryCards.length > 0) {
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#0F172A').text('KEY METRICS SUMMARY');
        doc.font('Helvetica').fontSize(9).fillColor('#334155');
        summaryCards.forEach(card => {
          doc.text(`• ${card.label}: ${card.value}`);
        });
        doc.moveDown(1);
      }

      // Data Table
      if (headers.length > 0 && rows.length > 0) {
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#0F172A').text('DETAILED RECORDS');
        doc.moveDown(0.5);

        // Render table header
        const colWidth = Math.floor(515 / headers.length);
        let startX = 40;
        let startY = doc.y;

        doc.rect(startX, startY, 515, 20).fill('#F1F5F9');
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#0F172A');

        headers.forEach((h, idx) => {
          doc.text(String(h), startX + (idx * colWidth) + 5, startY + 5, {
            width: colWidth - 10,
            ellipsis: true
          });
        });

        startY += 22;
        doc.font('Helvetica').fontSize(8).fillColor('#334155');

        // Render rows
        rows.slice(0, 100).forEach((row, rIdx) => {
          if (startY > 750) {
            doc.addPage();
            startY = 40;
          }
          if (rIdx % 2 === 1) {
            doc.rect(startX, startY, 515, 18).fill('#F8FAFC');
          }
          doc.fillColor('#334155');

          row.forEach((cell, cIdx) => {
            const strVal = cell !== null && cell !== undefined ? String(cell) : '-';
            doc.text(strVal, startX + (cIdx * colWidth) + 5, startY + 4, {
              width: colWidth - 10,
              ellipsis: true
            });
          });
          startY += 18;
        });
      } else if (headers.length > 0) {
        doc.fontSize(9).font('Helvetica-Oblique').fillColor('#64748B').text('No detailed records available for the selected period/scope.');
      }

      // Footer
      doc.fontSize(8)
         .font('Helvetica')
         .fillColor('#94A3B8')
         .text('Nirman Architects Integrated ERP & CRM System — Confidential', 40, 800, { align: 'center' });

      doc.end();

      writeStream.on('finish', () => resolve(targetFilePath));
      writeStream.on('error', (err) => reject(err));
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { generateReportPDF };
