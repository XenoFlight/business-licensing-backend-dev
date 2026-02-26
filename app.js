const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const authRoutes = require('./routes/authRoutes');
const licensingRoutes = require('./routes/licensingRoutes');
const businessRoutes = require('./routes/businessRoutes');
const defectRoutes = require('./routes/defectRoutes');
const adminRoutes = require('./routes/adminRoutes');
const calendarRoutes = require('./routes/calendarRoutes');
const reportRoutes = require('./routes/reportRoutes');

// ===== App Initialization =====
const app = express();

// ===== Network Proxy Configuration =====
// Trust the first proxy in front of the app (required for many hosted environments).
app.set('trust proxy', 1);

// ===== Security and Request Logging =====
// Helmet CSP allows required third-party browser resources used by frontend pages.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://unpkg.com", "https://cdn.tailwindcss.com", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
      "img-src": ["'self'", "data:", "https://*.openstreetmap.org", "https://unpkg.com"],
      "style-src": ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
      "script-src-attr": ["'self'", "'unsafe-inline'"],
      "connect-src": ["'self'", "https://nominatim.openstreetmap.org", "https:*"], // Allow fetching from any HTTPS source for iCal
    },
  },
}));
app.use(cors());
app.use(morgan('dev'));

// ===== Request Body Parsing =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== Static Asset Hosting =====
// Serve static frontend files from the public directory.
app.use(express.static(path.join(__dirname, 'public')));

// ===== Health Check Route =====
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'מערכת רישוי עסקים - השרת פעיל',
    englishMessage: 'Business Licensing System - Server is Active',
    timestamp: new Date()
  });
});

// ===== API Route Mounts =====
app.use('/api/auth', authRoutes);
app.use('/api/licensing-items', licensingRoutes);
app.use('/api/businesses', businessRoutes);
app.use('/api/defects', defectRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/reports', reportRoutes);

// ===== Fallback 404 Handler =====
// Return a JSON response for unknown routes.
app.use((req, res, next) => {
  res.status(404).json({
    error: 'הנתיב המבוקש לא נמצא',
    englishError: 'Not Found'
  });
});

module.exports = app;