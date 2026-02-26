const express = require('express');
const router = express.Router();
const { getAllDefects, getDefectById } = require('../controllers/defectController');
const { protect } = require('../middlewares/authMiddleware');

// ===== Defect Catalog Routes =====

router.route('/')
  .get(protect, getAllDefects);

router.route('/:id')
  .get(protect, getDefectById);

module.exports = router;