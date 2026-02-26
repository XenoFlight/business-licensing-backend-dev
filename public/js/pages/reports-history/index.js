import { requireAuth, renderUserName } from '../../core/auth.js';
import { apiFetch } from '../../core/api.js';
import { bindLogout, renderAdminLink } from '../../core/nav.js';
import { initThemeToggle } from '../../core/theme.js';

// ===== Reports History Page =====
// Loads and renders inspection history for a selected business.
let cachedReports = [];

function openEditModal(report) {
  const modal = document.getElementById('edit-report-modal');
  const reportIdInput = document.getElementById('edit-report-id');
  const statusInput = document.getElementById('edit-report-status');
  const findingsInput = document.getElementById('edit-report-findings');

  if (!modal || !reportIdInput || !statusInput || !findingsInput) {
    return;
  }

  reportIdInput.value = String(report.id || '');
  statusInput.value = report.status || 'pass';
  findingsInput.value = report.findings || '';

  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeEditModal() {
  const modal = document.getElementById('edit-report-modal');
  const form = document.getElementById('edit-report-form');

  if (!modal || !form) {
    return;
  }

  form.reset();
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

// ===== Query and Status Helpers =====
function getBusinessId() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('businessId');
}

function getStatusInfo(status) {
  const statusMap = {
    pass: { text: 'עבר', className: 'text-green-600 font-bold' },
    fail: { text: 'נכשל', className: 'text-red-600 font-bold' },
    conditional_pass: { text: 'עבר בתנאי', className: 'text-amber-500 font-bold' },
  };

  return statusMap[status] || { text: status || '-', className: '' };
}

// ===== Table State Rendering =====
function renderErrorRow(message) {
  const tbody = document.querySelector('#reports-table tbody');
  if (!tbody) {
    return;
  }

  tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-red-500">${message}</td></tr>`;
}

function renderEmptyRow() {
  const tbody = document.querySelector('#reports-table tbody');
  if (!tbody) {
    return;
  }

  tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-slate-500">לא נמצאו ביקורות קודמות לעסק זה.</td></tr>';
}

// ===== Table Rows Rendering =====
function renderReportsRows(reports) {
  const tbody = document.querySelector('#reports-table tbody');
  if (!tbody) {
    return;
  }

  cachedReports = reports;
  tbody.innerHTML = '';

  reports.forEach((report) => {
    const statusInfo = getStatusInfo(report.status);
    const row = document.createElement('tr');
    row.className = 'hover:bg-slate-50 transition-colors';

    const findings = typeof report.findings === 'string' ? report.findings : '';
    const findingsPreview = `${findings.substring(0, 50)}${findings.length > 50 ? '...' : ''}`;
    const inspectorName = report.inspector?.fullName || 'לא ידוע';
    const visitDate = new Date(report.visitDate).toLocaleDateString('he-IL', {
      hour: '2-digit',
      minute: '2-digit',
    });

    row.innerHTML = `
      <td class="px-6 py-4 text-slate-900">${visitDate}</td>
      <td class="px-6 py-4 text-slate-600">${inspectorName}</td>
      <td class="px-6 py-4 ${statusInfo.className}">${statusInfo.text}</td>
      <td class="px-6 py-4 text-slate-600">${findingsPreview || '-'}</td>
      <td class="px-6 py-4">${report.pdfPath ? `<a href="${report.pdfPath}" target="_blank" rel="noopener noreferrer" class="text-brand-600 hover:underline">צפה בדו"ח</a>` : '-'}</td>
      <td class="px-6 py-4">
        <button type="button" data-report-id="${report.id}" class="edit-report-button text-brand-600 hover:text-brand-700 hover:underline font-medium">עריכה</button>
      </td>
    `;

    tbody.appendChild(row);
  });
}

// ===== Data Loading =====
async function loadBusinessTitle(businessId) {
  const titleElement = document.getElementById('business-title');
  if (!titleElement) {
    return;
  }

  const bizResponse = await apiFetch(`/api/businesses/${businessId}`);
  if (!bizResponse.ok) {
    return;
  }

  const business = await bizResponse.json();
  titleElement.textContent = `היסטוריית דו"חות: ${business.businessName}`;
}

async function loadReports(businessId) {
  try {
    await loadBusinessTitle(businessId);

    const reportsResponse = await apiFetch(`/api/reports/business/${businessId}`);
    if (!reportsResponse.ok) {
      throw new Error('Failed to fetch reports');
    }

    const reports = await reportsResponse.json();

    if (!Array.isArray(reports) || reports.length === 0) {
      renderEmptyRow();
      return;
    }

    renderReportsRows(reports);
  } catch (error) {
    console.error('Failed loading reports history:', error);
    renderErrorRow('שגיאה בטעינת הנתונים.');
  }
}

async function updateReport(reportId, payload) {
  const updateResponse = await apiFetch(`/api/reports/${reportId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!updateResponse.ok) {
    throw new Error('Failed to update report');
  }

  return updateResponse.json();
}

function bindEditActions(businessId) {
  const tbody = document.querySelector('#reports-table tbody');
  const closeButton = document.getElementById('edit-modal-close');
  const cancelButton = document.getElementById('edit-modal-cancel');
  const modal = document.getElementById('edit-report-modal');
  const form = document.getElementById('edit-report-form');
  const saveButton = document.getElementById('edit-modal-save');

  if (tbody) {
    tbody.addEventListener('click', (event) => {
      const targetButton = event.target.closest('.edit-report-button');
      if (!targetButton) {
        return;
      }

      const reportId = Number(targetButton.getAttribute('data-report-id'));
      const selectedReport = cachedReports.find((report) => Number(report.id) === reportId);
      if (!selectedReport) {
        return;
      }

      openEditModal(selectedReport);
    });
  }

  [closeButton, cancelButton].forEach((button) => {
    if (!button) {
      return;
    }

    button.addEventListener('click', closeEditModal);
  });

  if (modal) {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        closeEditModal();
      }
    });
  }

  if (!form || !saveButton) {
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const reportId = document.getElementById('edit-report-id')?.value;
    const status = document.getElementById('edit-report-status')?.value;
    const findings = document.getElementById('edit-report-findings')?.value?.trim();

    if (!reportId || !status || !findings) {
      alert('יש למלא את כל השדות לפני שמירה.');
      return;
    }

    const originalLabel = saveButton.textContent;
    saveButton.disabled = true;
    saveButton.textContent = 'שומר...';

    try {
      await updateReport(reportId, { status, findings });
      closeEditModal();
      await loadReports(businessId);
      alert('הדו"ח עודכן בהצלחה.');
    } catch (error) {
      console.error('Failed to update report:', error);
      alert('שמירת הדו"ח נכשלה. נסה שוב.');
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = originalLabel;
    }
  });
}

// ===== Page Bootstrap =====
function initPage() {
  requireAuth();

  const user = renderUserName('user-name');
  initThemeToggle(user);
  renderAdminLink(user, 'admin-link-placeholder');
  bindLogout('logout-button');

  const businessId = getBusinessId();
  if (!businessId) {
    alert('שגיאה: לא נבחר עסק.');
    window.location.href = 'dashboard.html';
    return;
  }

  bindEditActions(businessId);
  loadReports(businessId);
}

initPage();
