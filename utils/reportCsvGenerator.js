const fs = require('fs');
const path = require('path');

function escapeCsvCell(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Generates a clean CSV file for any ERP Module 8 report.
 */
function generateReportCSV(title, scopeInfo = {}, summaryCards = [], headers = [], rows = [], targetFilePath) {
  return new Promise((resolve, reject) => {
    try {
      const dir = path.dirname(targetFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const lines = [];
      lines.push(escapeCsvCell(`NIRMAN ARCHITECTS - ${title.toUpperCase()}`));
      lines.push(escapeCsvCell(`Generated: ${new Date().toISOString()}`));
      lines.push('');

      if (Object.keys(scopeInfo).length > 0) {
        lines.push(escapeCsvCell('REPORT SCOPE'));
        for (const [k, v] of Object.entries(scopeInfo)) {
          if (v !== undefined && v !== null) {
            lines.push(`${escapeCsvCell(k)},${escapeCsvCell(v)}`);
          }
        }
        lines.push('');
      }

      if (summaryCards.length > 0) {
        lines.push(`${escapeCsvCell('METRIC')},${escapeCsvCell('VALUE')}`);
        summaryCards.forEach(c => {
          lines.push(`${escapeCsvCell(c.label)},${escapeCsvCell(c.value)}`);
        });
        lines.push('');
      }

      if (headers.length > 0) {
        lines.push(headers.map(escapeCsvCell).join(','));
        rows.forEach(r => {
          lines.push(r.map(escapeCsvCell).join(','));
        });
      }

      fs.writeFileSync(targetFilePath, lines.join('\n'), 'utf8');
      resolve(targetFilePath);
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { generateReportCSV };
