const express = require('express');
const router = express.Router();
const {
  createReport,
  getReportsByBusiness,
  getReportById,
  updateReport,
  getAllReports
} = require('../controllers/reportController');
const { protect, authorize } = require('../middlewares/authMiddleware');

// ===== Inspection Report Routes =====

router.route('/')
  .post(protect, authorize('inspector', 'manager', 'admin'), createReport)
  .get(protect, authorize('inspector', 'manager', 'admin'), getAllReports);

// Report history by business.
router.route('/business/:businessId')
  .get(protect, getReportsByBusiness);

// Single report operations.
router.route('/:id')
  .get(protect, getReportById)
  .put(protect, authorize('inspector', 'manager', 'admin'), updateReport);

module.exports = router;