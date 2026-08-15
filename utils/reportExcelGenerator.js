const fs = require('fs');
const path = require('path');

/**
 * Generates an Excel-compatible spreadsheet file for any ERP Module 8 report.
 * @param {string} title Report Title
 * @param {object} scopeInfo Object containing scope metadata
 * @param {Array<{ label: string, value: any }>} summaryCards Array of key-value summary tiles
 * @param {Array<string>} headers Column headers
 * @param {Array<Array<any>>} rows Data rows
 * @param {string} targetFilePath Output file path inside /storage/reports/
 */
function generateReportExcel(title, scopeInfo = {}, summaryCards = [], headers = [], rows = [], targetFilePath) {
  return new Promise((resolve, reject) => {
    try {
      const dir = path.dirname(targetFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      let content = `<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n`;
      content += `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n`;
      content += ` xmlns:o="urn:schemas-microsoft-com:office:office"\n`;
      content += ` xmlns:x="urn:schemas-microsoft-com:office:excel"\n`;
      content += ` xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n`;
      content += `<Styles>\n`;
      content += ` <Style ss:ID="HeaderStyle"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#0F172A" ss:Pattern="Solid"/></Style>\n`;
      content += ` <Style ss:ID="TitleStyle"><Font ss:Bold="1" ss:Size="14" ss:Color="#2563EB"/></Style>\n`;
      content += ` <Style ss:ID="BoldStyle"><Font ss:Bold="1"/></Style>\n`;
      content += `</Styles>\n`;
      content += `<Worksheet ss:Name="Report">\n<Table>\n`;

      // Title
      content += `<Row><Cell ss:StyleID="TitleStyle"><Data ss:Type="String">NIRMAN ARCHITECTS - ${title.toUpperCase()}</Data></Cell></Row>\n`;
      content += `<Row><Cell><Data ss:Type="String">Generated: ${new Date().toISOString()}</Data></Cell></Row>\n`;
      content += `<Row></Row>\n`;

      // Scope Summary
      if (Object.keys(scopeInfo).length > 0) {
        content += `<Row><Cell ss:StyleID="BoldStyle"><Data ss:Type="String">REPORT SCOPE</Data></Cell></Row>\n`;
        for (const [k, v] of Object.entries(scopeInfo)) {
          if (v !== undefined && v !== null) {
            content += `<Row><Cell><Data ss:Type="String">${k}</Data></Cell><Cell><Data ss:Type="String">${v}</Data></Cell></Row>\n`;
          }
        }
        content += `<Row></Row>\n`;
      }

      // Summary Cards
      if (summaryCards.length > 0) {
        content += `<Row><Cell ss:StyleID="BoldStyle"><Data ss:Type="String">METRIC</Data></Cell><Cell ss:StyleID="BoldStyle"><Data ss:Type="String">VALUE</Data></Cell></Row>\n`;
        summaryCards.forEach(c => {
          content += `<Row><Cell><Data ss:Type="String">${c.label}</Data></Cell><Cell><Data ss:Type="String">${c.value}</Data></Cell></Row>\n`;
        });
        content += `<Row></Row>\n`;
      }

      // Data Table
      if (headers.length > 0) {
        content += `<Row>\n`;
        headers.forEach(h => {
          content += `<Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">${String(h)}</Data></Cell>\n`;
        });
        content += `</Row>\n`;

        rows.forEach(r => {
          content += `<Row>\n`;
          r.forEach(val => {
            const strVal = val !== null && val !== undefined ? String(val) : '';
            const dataType = typeof val === 'number' ? 'Number' : 'String';
            content += `<Cell><Data ss:Type="${dataType}">${strVal.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Data></Cell>\n`;
          });
          content += `</Row>\n`;
        });
      }

      content += `</Table>\n</Worksheet>\n</Workbook>`;

      fs.writeFileSync(targetFilePath, content, 'utf8');
      resolve(targetFilePath);
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { generateReportExcel };
