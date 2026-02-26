import { requireAuth, renderUserName } from '../../core/auth.js';
import { apiFetch } from '../../core/api.js';
import { bindLogout, renderAdminLink } from '../../core/nav.js';

// ===== Reports History Page =====
// Loads and renders inspection history for a selected business.

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

  tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-red-500">${message}</td></tr>`;
}

function renderEmptyRow() {
  const tbody = document.querySelector('#reports-table tbody');
  if (!tbody) {
    return;
  }

  tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-slate-500">לא נמצאו ביקורות קודמות לעסק זה.</td></tr>';
}

// ===== Table Rows Rendering =====
function renderReportsRows(reports) {
  const tbody = document.querySelector('#reports-table tbody');
  if (!tbody) {
    return;
  }

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

// ===== Page Bootstrap =====
function initPage() {
  requireAuth();

  const user = renderUserName('user-name');
  renderAdminLink(user, 'admin-link-placeholder');
  bindLogout('logout-button');

  const businessId = getBusinessId();
  if (!businessId) {
    alert('שגיאה: לא נבחר עסק.');
    window.location.href = 'dashboard.html';
    return;
  }

  loadReports(businessId);
}

initPage();
