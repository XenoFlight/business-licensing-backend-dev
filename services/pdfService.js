const puppeteer = require('puppeteer');

/**
 * Build printable HTML for inspection report PDF generation.
 * @param {object} reportData Report context (report, business, inspector).
 * @returns {string} Rendered HTML string.
 */
const createReportHTML = (reportData) => {
  const { report, business, inspector } = reportData;

  // Format visit date in local Israeli timezone/locale.
  const visitDate = new Date(report.visitDate).toLocaleString('he-IL', {
    timeZone: 'Asia/Jerusalem',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Visual mapping for report status labels in generated template.
  const statusMap = {
    pass: { text: 'עבר', color: 'green' },
    fail: { text: 'נכשל', color: 'red' },
    conditional_pass: { text: 'עבר בתנאי', color: 'orange' }
  };
  const reportStatus = statusMap[report.status] || { text: report.status, color: 'black' };

  // Render optional AI analysis section when available.
  let aiSection = '';
  if (report.aiRiskAssessment) {
    const { riskLevel, summary, recommendations } = report.aiRiskAssessment;
    const recommendationsList = recommendations.map(rec => `<li>${rec}</li>`).join('');
    aiSection = `
      <div class="section">
        <h2>הערכת סיכונים (AI)</h2>
        <p><strong>רמת סיכון:</strong> ${riskLevel || 'לא צוין'}</p>
        <p><strong>סיכום:</strong> ${summary || 'לא צוין'}</p>
        <p><strong>המלצות:</strong></p>
        <ul>${recommendationsList}</ul>
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html lang="he" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>דו"ח ביקורת עסק - ${business.businessName}</title>
      <style>
        body {
          /* Arial is used as a safe Hebrew-compatible fallback font. */
          font-family: 'Arial', sans-serif;
          direction: rtl;
          text-align: right;
          margin: 40px;
          font-size: 12px;
          line-height: 1.6;
          color: #333;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #333;
          padding-bottom: 10px;
          margin-bottom: 20px;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
        }
        .details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          margin-bottom: 20px;
        }
        .details-grid div {
          background-color: #f9f9f9;
          padding: 10px;
          border: 1px solid #eee;
          border-radius: 5px;
        }
        .details-grid strong {
          display: block;
          margin-bottom: 5px;
          color: #555;
        }
        .section {
          margin-top: 25px;
          padding-top: 15px;
          border-top: 1px solid #eee;
        }
        h2 {
          font-size: 18px;
          color: #333;
          border-bottom: 1px solid #ddd;
          padding-bottom: 5px;
        }
        .findings {
          white-space: pre-wrap; /* Preserve line breaks from user-entered findings text. */
          background-color: #fdfdfd;
          border: 1px solid #ddd;
          padding: 15px;
          border-radius: 5px;
          font-size: 13px;
        }
        .status {
          font-weight: bold;
          font-size: 16px;
          color: ${reportStatus.color};
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>דו"ח ביקורת עסק</h1>
        <p>מועצה אזורית יואב</p>
      </div>

      <div class="details-grid">
        <div>
          <strong>פרטי הדו"ח</strong>
          מספר דו"ח: ${report.id}<br>
          תאריך ביקורת: ${visitDate}<br>
          שם המפקח: ${inspector.fullName}
        </div>
        <div>
          <strong>פרטי העסק</strong>
          שם העסק: ${business.businessName}<br>
          כתובת: ${business.address}<br>
          שם הבעלים: ${business.ownerName}
        </div>
      </div>

      <div class="section">
        <h2>ממצאי הביקורת</h2>
        <div class="findings">${report.findings}</div>
      </div>

      <div class="section">
        <h2>תוצאת הביקורת</h2>
        <p class="status">${reportStatus.text}</p>
      </div>

      ${aiSection}

    </body>
    </html>
  `;
};

/**
 * Generate PDF buffer from report data.
 * @param {object} reportData Report context (report, business, inspector).
 * @returns {Promise<Buffer>} PDF file contents.
 */
const generateReportPDF = async (reportData) => {
  let browser;
  try {
    // Use sandbox flags for typical hosted Linux environments.
    const browserArgs = process.env.NODE_ENV === 'production' 
      ? ['--no-sandbox', '--disable-setuid-sandbox'] 
      : [];

    browser = await puppeteer.launch({
      headless: true,
      args: browserArgs
    });

    const page = await browser.newPage();
    const htmlContent = createReportHTML(reportData);

    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '40px',
        right: '40px',
        bottom: '60px',
        left: '40px'
      },
      displayHeaderFooter: true,
      footerTemplate: `
        <div style="font-family: Arial, sans-serif; font-size: 9px; width: 100%; text-align: center; padding: 0 20px;">
          מסמך זה הופק באופן ממוחשב | עמוד <span class="pageNumber"></span> מתוך <span class="totalPages"></span>
        </div>
      `,
      headerTemplate: '<div></div>'
    });

    return pdfBuffer;
  } catch (error) {
    console.error('❌ Error generating PDF:', error);
    throw new Error('Failed to generate PDF report.');
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

module.exports = { generateReportPDF };