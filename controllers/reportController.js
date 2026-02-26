const Report = require('../models/Report');
const Business = require('../models/Business');
const User = require('../models/User');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { generateReportPDF } = require('../services/pdfService');
const path = require('path');
const fs = require('fs');

// ===== Optional AI Client Initialization =====
// AI integration is enabled only when GEMINI_API_KEY is configured.
const geminiApiKey = (process.env.GEMINI_API_KEY || '').trim();
const isPlaceholderGeminiKey = !geminiApiKey || geminiApiKey === 'your_google_gemini_api_key';
const genAI = !isPlaceholderGeminiKey
  ? new GoogleGenerativeAI(geminiApiKey)
  : null;

const runWithTimeout = async (promise, timeoutMs, timeoutMessage) => {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
};

// ===== Report Endpoints =====
// @desc    Create new inspection report + optional AI analysis + optional PDF generation
// @route   POST /api/reports
// @access  Private (Inspector)
exports.createReport = async (req, res) => {
  try {
    let { businessId, findings, status, businessData } = req.body;
    const inspectorId = req.user.id;

    // Create a new business on the fly when no businessId is provided.
    if (!businessId && businessData) {
      try {
        const newBusiness = await Business.create({
          ...businessData,
          status: 'application_submitted'
        });
        businessId = newBusiness.id;
      } catch (bizError) {
        return res.status(400).json({ message: 'שגיאה ביצירת עסק חדש', error: bizError.message });
      }
    }

    // Ensure target business exists.
    const business = await Business.findByPk(businessId);
    if (!business) {
      return res.status(404).json({ message: 'עסק לא נמצא' });
    }

    // Persist the initial report record.
    const report = await Report.create({
      businessId,
      inspectorId,
      findings,
      status,
      visitDate: new Date()
    });

    // Optionally enrich report with AI risk assessment.
    if (findings && genAI) {
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        
        const prompt = `
          Act as an Israeli municipal safety inspector. 
          Analyze the following inspection findings: "${findings}".
          Return a valid JSON object (no markdown formatting) with the following keys:
          - "riskLevel": One of ["Low", "Medium", "High"]
          - "summary": A brief summary in Hebrew.
          - "recommendations": An array of strings (recommendations in Hebrew).
        `;

        const result = await runWithTimeout(
          model.generateContent(prompt),
          15000,
          'AI analysis timeout'
        );
        const response = await result.response;
        const text = response.text();
        
        // Strip markdown fences if the model wraps JSON in code blocks.
        const jsonStr = text.replace(/```json|```/g, '').trim();
        const aiAssessment = JSON.parse(jsonStr);

        // Persist AI assessment on the report.
        report.aiRiskAssessment = aiAssessment;
        await report.save();
        
      } catch (aiError) {
        console.error('⚠️ AI Analysis failed:', aiError.message);
        // Keep report creation successful even if AI processing fails.
      }
    }

    // Generate PDF output and store file path when possible.
    try {
      // Load complete report context required by PDF template.
      const fullReport = await Report.findByPk(report.id, {
        include: [
          { model: Business },
          { model: User, as: 'inspector' }
        ]
      });

      if (fullReport) {
        const pdfBuffer = await runWithTimeout(
          generateReportPDF({
            report: fullReport,
            business: fullReport.Business,
            inspector: fullReport.inspector
          }),
          25000,
          'PDF generation timeout'
        );

        // Save generated file locally under public/reports.
        const fileName = `report_${report.id}_${Date.now()}.pdf`;
        const reportsDir = path.join(__dirname, '../public/reports');
        
        // Ensure target directory exists.
        if (!fs.existsSync(reportsDir)) {
          fs.mkdirSync(reportsDir, { recursive: true });
        }
        
        const filePath = path.join(reportsDir, fileName);
        fs.writeFileSync(filePath, pdfBuffer);

        // Store relative public path on report record.
        report.pdfPath = `/reports/${fileName}`;
        await report.save();
      }
    } catch (pdfError) {
      console.error('⚠️ PDF Generation failed:', pdfError.message);
      // Keep request successful even when PDF generation fails.
    }

    res.status(201).json({
      message: 'הדו"ח נוצר בהצלחה',
      report
    });

  } catch (error) {
    console.error('Error creating report:', error);
    res.status(500).json({ message: 'שגיאה ביצירת דו"ח', error: error.message });
  }
};

// @desc    Get reports for a specific business
// @route   GET /api/reports/business/:businessId
// @access  Private
exports.getReportsByBusiness = async (req, res) => {
  try {
    const reports = await Report.findAll({
      where: { businessId: req.params.businessId },
      include: [
        { model: User, as: 'inspector', attributes: ['fullName'] }
      ],
      order: [['visitDate', 'DESC']]
    });
    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: 'שגיאת שרת', error: error.message });
  }
};

// @desc    Get all reports for inspection board view
// @route   GET /api/reports
// @access  Private (Inspector/Manager/Admin)
exports.getAllReports = async (req, res) => {
  try {
    const reports = await Report.findAll({
      include: [
        { model: Business, attributes: ['id', 'businessName', 'address'] },
        { model: User, as: 'inspector', attributes: ['fullName'] }
      ],
      order: [['visitDate', 'DESC']]
    });
    res.json(reports);
  } catch (error) {
    console.error('Error fetching all reports:', error);
    res.status(500).json({ message: 'שגיאת שרת בקבלת כל הדו"חות', error: error.message });
  }
};

// @desc    Get report by identifier
// @route   GET /api/reports/:id
// @access  Private
exports.getReportById = async (req, res) => {
  try {
    const report = await Report.findByPk(req.params.id, {
      include: [
        { model: Business, attributes: ['businessName', 'address'] },
        { model: User, as: 'inspector', attributes: ['fullName'] }
      ]
    });

    if (report) {
      res.json(report);
    } else {
      res.status(404).json({ message: 'דו"ח לא נמצא' });
    }
  } catch (error) {
    res.status(500).json({ message: 'שגיאת שרת', error: error.message });
  }
};

// @desc    Update report fields
// @route   PUT /api/reports/:id
// @access  Private (Manager/Inspector)
exports.updateReport = async (req, res) => {
  try {
    const report = await Report.findByPk(req.params.id);
    if (!report) return res.status(404).json({ message: 'דו"ח לא נמצא' });

    await report.update(req.body);
    res.json({ message: 'הדו"ח עודכן בהצלחה', report });
  } catch (error) {
    res.status(500).json({ message: 'שגיאת שרת', error: error.message });
  }
};