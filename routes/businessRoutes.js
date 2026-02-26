const express = require('express');
const router = express.Router();
const {
  getAllBusinesses,
  getBusinessById,
  createBusiness,
  updateBusiness,
  deleteBusiness,
  getBusinessReports,
  updateBusinessStatus,
  updateBusinessLocation
} = require('../controllers/businessController');
const { protect, authorize } = require('../middlewares/authMiddleware');

// ===== Business Routes =====

router.route('/')
  .get(protect, getAllBusinesses)
  .post(protect, authorize('manager', 'inspector', 'admin'), createBusiness);

// Business-level actions.
router.get('/:id/reports', protect, getBusinessReports);
router.patch('/:id/status', protect, authorize('manager', 'inspector', 'admin'), updateBusinessStatus);
router.patch('/:id/location', protect, authorize('manager', 'inspector', 'admin'), updateBusinessLocation);

router.route('/:id')
  .get(protect, getBusinessById)
  .put(protect, authorize('manager', 'admin'), updateBusiness)
  .delete(protect, authorize('admin'), deleteBusiness);

module.exports = router;