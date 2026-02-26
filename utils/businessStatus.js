// ===== Canonical Business Status Definitions =====
const CANONICAL_STATUS_CODES = [
  'application_submitted',
  'pending_review',
  'renewal_in_progress',
  'approved',
  'temporarily_permitted',
  'rejected',
  'closed',
];

// Human-readable labels used by UI/API responses.
const STATUS_LABELS_HE = {
  application_submitted: 'הוגשה בקשה',
  pending_review: 'בטיפול',
  renewal_in_progress: 'בתהליך חידוש',
  approved: 'רישיון בתוקף',
  temporarily_permitted: 'היתר זמני',
  rejected: 'נדחה',
  closed: 'סגור',
};

// Legacy and Hebrew source values mapped to canonical internal codes.
const LEGACY_TO_CANONICAL = {
  in_process: 'pending_review',
  active: 'approved',
  expired: 'renewal_in_progress',
  revoked: 'rejected',
  closed: 'closed',
  application_submitted: 'application_submitted',

  'פעיל': 'approved',
  'רישיון': 'approved',
  'רישיון בתוקף': 'approved',
  'רישיון זמני': 'temporarily_permitted',
  'רישוין תקופתי': 'approved',
  'היתר זמני': 'temporarily_permitted',
  'בטיפול': 'pending_review',
  'בהמתנה': 'pending_review',
  'בתהליך חידוש': 'renewal_in_progress',
  'חידוש': 'renewal_in_progress',
  'נדחה': 'rejected',
  'סגור': 'closed',
  'לא הוגשה בקשה': 'application_submitted',
  'בקשה מקוונת': 'application_submitted',
  'לידיעה': 'pending_review',
  'לצמיתות': 'approved',
  'תיק פיקוח': 'pending_review',
};

// Normalize free-text status into one of the canonical status codes.
function normalizeBusinessStatus(status) {
  if (typeof status !== 'string') {
    return null;
  }

  const trimmed = status.trim();
  if (!trimmed) {
    return null;
  }

  if (CANONICAL_STATUS_CODES.includes(trimmed)) {
    return trimmed;
  }

  if (LEGACY_TO_CANONICAL[trimmed]) {
    return LEGACY_TO_CANONICAL[trimmed];
  }

  const partialKey = Object.keys(LEGACY_TO_CANONICAL).find((key) => trimmed.includes(key));
  return partialKey ? LEGACY_TO_CANONICAL[partialKey] : null;
}

// Resolve display label for canonical status values.
function getBusinessStatusLabel(statusCode) {
  return STATUS_LABELS_HE[statusCode] || statusCode;
}

module.exports = {
  CANONICAL_STATUS_CODES,
  STATUS_LABELS_HE,
  normalizeBusinessStatus,
  getBusinessStatusLabel,
};
