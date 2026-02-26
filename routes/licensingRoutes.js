const express = require('express');
const router = express.Router();
const {
  getAllItems,
  getItemById,
  createItem,
  updateItem,
  deleteItem
} = require('../controllers/licensingController');

const { protect, authorize } = require('../middlewares/authMiddleware');

// ===== Licensing Item Routes =====

// Collection routes.
router.route('/')
  .get(getAllItems)
  .post(protect, authorize('admin', 'manager'), createItem);

// Item routes.
router.route('/:id')
  .get(getItemById)
  .put(protect, authorize('admin', 'manager'), updateItem)
  .delete(protect, authorize('admin'), deleteItem);

module.exports = router;