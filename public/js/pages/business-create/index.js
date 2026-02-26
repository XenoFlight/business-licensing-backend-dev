import { requireAuth, renderUserName } from '../../core/auth.js';
import { apiFetch } from '../../core/api.js';
import { bindLogout, renderAdminLink } from '../../core/nav.js';
import { BUSINESS_STATUS_OPTIONS, getStatusLabel } from '../../core/status.js';
import { initThemeToggle } from '../../core/theme.js';

function parseBooleanInput(value) {
  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return null;
}

function setFeedback(message, type = 'info') {
  const feedback = document.getElementById('create-feedback');
  if (!feedback) {
    return;
  }

  feedback.textContent = message;
  feedback.className = 'text-sm mb-4';

  if (type === 'error') {
    feedback.classList.add('text-red-600');
    return;
  }

  if (type === 'success') {
    feedback.classList.add('text-emerald-600');
    return;
  }

  feedback.classList.add('text-slate-500');
}

function setStatusOptions() {
  const statusSelect = document.getElementById('business-status');
  if (!statusSelect) {
    return;
  }

  statusSelect.innerHTML = '';
  BUSINESS_STATUS_OPTIONS.forEach((statusCode) => {
    const option = document.createElement('option');
    option.value = statusCode;
    option.textContent = getStatusLabel(statusCode);
    statusSelect.appendChild(option);
  });
}

function buildPayload() {
  const staffCount = Number.parseInt(document.getElementById('local-staff-count').value, 10);
  const trashCount = Number.parseInt(document.getElementById('trash-can-count').value, 10);

  return {
    businessName: document.getElementById('business-name').value.trim(),
    ownerName: document.getElementById('business-owner').value.trim() || null,
    address: document.getElementById('business-address').value.trim() || null,
    contactPhone: document.getElementById('business-phone').value.trim() || null,
    email: document.getElementById('business-email').value.trim() || null,
    licenseNumber: document.getElementById('business-license-number').value.trim() || null,
    status: document.getElementById('business-status').value,
    localStaffCount: Number.isNaN(staffCount) ? null : staffCount,
    localManagerName: document.getElementById('local-manager-name').value.trim() || null,
    localManagerPhone: document.getElementById('local-manager-phone').value.trim() || null,
    localContactName: document.getElementById('local-contact-name').value.trim() || null,
    localContactPhone: document.getElementById('local-contact-phone').value.trim() || null,
    emergencyContactName: document.getElementById('emergency-contact-name').value.trim() || null,
    emergencyContactPhone: document.getElementById('emergency-contact-phone').value.trim() || null,
    hasTrashCans: parseBooleanInput(document.getElementById('has-trash-cans').value),
    trashCanType: document.getElementById('trash-can-type').value.trim() || null,
    trashCanCount: Number.isNaN(trashCount) ? null : trashCount,
    trashCareOwner: document.getElementById('trash-care-owner').value || 'unknown',
    wastePickupSchedule: document.getElementById('waste-pickup-schedule').value.trim() || null,
    localStaffNotes: document.getElementById('local-staff-notes').value.trim() || null,
  };
}

async function createBusiness(event) {
  event.preventDefault();

  const saveButton = document.getElementById('save-btn');
  const originalText = saveButton.textContent;
  saveButton.disabled = true;
  saveButton.textContent = 'יוצר...';

  try {
    const response = await apiFetch('/api/businesses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildPayload()),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.message || result.error || 'יצירת תיק נכשלה');
    }

    setFeedback('התיק נוצר בהצלחה. מעביר לניהול תיקי עסקים...', 'success');
    setTimeout(() => {
      window.location.href = 'businesses.html';
    }, 700);
  } catch (error) {
    console.error('Failed creating business:', error);
    setFeedback(error.message || 'שגיאה ביצירת תיק עסק.', 'error');
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = originalText;
  }
}

function initPage() {
  requireAuth();

  const user = renderUserName('user-name');
  initThemeToggle(user);
  renderAdminLink(user, 'admin-link-placeholder');
  bindLogout('logout-button');

  setStatusOptions();

  const form = document.getElementById('business-create-form');
  form?.addEventListener('submit', createBusiness);
}

initPage();
