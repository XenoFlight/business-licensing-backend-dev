const express = require('express');
const router = express.Router();
const { getICalEvents } = require('../controllers/calendarController');
const { protect } = require('../middlewares/authMiddleware');

// ===== Calendar Routes =====
// POST /api/calendar/ical: Fetch and parse events from an iCal URL.
router.post('/ical', protect, getICalEvents);

module.exports = router;
