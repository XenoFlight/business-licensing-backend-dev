import { requireAuth, renderUserName } from '../../core/auth.js';
import { apiFetch } from '../../core/api.js';
import { bindLogout, renderAdminLink } from '../../core/nav.js';
import { initThemeToggle } from '../../core/theme.js';

let allReports = [];

function getQueryParams() {
  return new URLSearchParams(window.location.search);
}

function syncFiltersToQuery() {
  const params = getQueryParams();
  const query = (document.getElementById('archive-search')?.value || '').trim();
  const status = (document.getElementById('archive-status-filter')?.value || '').trim();

  params.delete('q');
  params.delete('status');

  if (query) {
    params.set('q', query);
  }

  if (status) {
    params.set('status', status);
  }

  const nextQuery = params.toString();
  const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`;
  window.history.replaceState(null, '', nextUrl);
}

function applyFiltersFromQuery() {
  const params = getQueryParams();
  const query = (params.get('q') || '').trim();
  const status = (params.get('status') || '').trim();

  const searchInput = document.getElementById('archive-search');
  const statusInput = document.getElementById('archive-status-filter');

  if (query && searchInput) {
    searchInput.value = query;
  }

  if (status && statusInput && Array.from(statusInput.options).some((option) => option.value === status)) {
    statusInput.value = status;
  }
}

function updateResultsLabel(visibleCount, totalCount) {
  const label = document.getElementById('archive-results-label');
  if (!label) {
    return;
  }

  label.textContent = `מציג ${visibleCount} מתוך ${totalCount}`;
}

function updateActiveFilterIndicator(isActive) {
  const indicator = document.getElementById('archive-active-filter-indicator');
  if (!indicator) {
    return;
  }

  indicator.classList.toggle('hidden', !isActive);
}

function getStatusInfo(status) {
  const statusMap = {
    pass: { text: 'עבר', className: 'text-green-600 font-bold' },
    fail: { text: 'נכשל', className: 'text-red-600 font-bold' },
    conditional_pass: { text: 'עבר בתנאי', className: 'text-amber-500 font-bold' },
  };

  return statusMap[status] || { text: status || '-', className: '' };
}

function getFilteredReports() {
  const query = (document.getElementById('archive-search')?.value || '').trim().toLowerCase();
  const statusFilter = document.getElementById('archive-status-filter')?.value || '';

  return allReports.filter((report) => {
    if (statusFilter && report.status !== statusFilter) {
      return false;
    }

    if (!query) {
      return true;
    }

    const haystack = [
      report.Business?.businessName || '',
      report.inspector?.fullName || '',
      report.findings || '',
      report.Business?.address || '',
    ].join(' ').toLowerCase();

    return haystack.includes(query);
  });
}

function renderRows() {
  const tbody = document.querySelector('#archive-table tbody');
  if (!tbody) {
    return;
  }

  const query = (document.getElementById('archive-search')?.value || '').trim();
  const statusFilter = (document.getElementById('archive-status-filter')?.value || '').trim();
  const hasActiveFilter = Boolean(query || statusFilter);

  const reports = getFilteredReports();
  updateResultsLabel(reports.length, allReports.length);
  updateActiveFilterIndicator(hasActiveFilter);
  syncFiltersToQuery();

  if (reports.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-8 text-center text-slate-500">לא נמצאו דו"חות.</td></tr>';
    return;
  }

  tbody.innerHTML = reports.map((report) => {
    const statusInfo = getStatusInfo(report.status);
    const visitDate = report.visitDate
      ? new Date(report.visitDate).toLocaleDateString('he-IL', { hour: '2-digit', minute: '2-digit' })
      : '-';

    const findings = typeof report.findings === 'string' ? report.findings : '';
    const findingsPreview = `${findings.substring(0, 70)}${findings.length > 70 ? '...' : ''}`;

    return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="px-6 py-4">${visitDate}</td>
        <td class="px-6 py-4">${report.Business?.businessName || '-'}</td>
        <td class="px-6 py-4">${report.inspector?.fullName || '-'}</td>
        <td class="px-6 py-4 ${statusInfo.className}">${statusInfo.text}</td>
        <td class="px-6 py-4 text-slate-600">${findingsPreview || '-'}</td>
        <td class="px-6 py-4">${report.pdfPath ? `<a href="${report.pdfPath}" target="_blank" rel="noopener noreferrer" class="text-brand-600 hover:underline">צפה</a>` : '-'}</td>
        <td class="px-6 py-4">
          <a href="reports-history.html?businessId=${encodeURIComponent(report.businessId)}" class="text-brand-600 hover:text-brand-700 hover:underline font-medium">לדו"חות עסק</a>
        </td>
      </tr>
    `;
  }).join('');
}

async function loadReports() {
  const tbody = document.querySelector('#archive-table tbody');
  try {
    const response = await apiFetch('/api/reports');
    if (!response.ok) {
      throw new Error('Failed loading reports');
    }

    allReports = await response.json();
    renderRows();
  } catch (error) {
    console.error('Failed loading archive reports', error);
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-8 text-center text-red-500">שגיאה בטעינת הארכיון.</td></tr>';
    }
  }
}

function bindFilters() {
  document.getElementById('archive-search')?.addEventListener('input', renderRows);
  document.getElementById('archive-status-filter')?.addEventListener('change', renderRows);

  const clearButton = document.getElementById('archive-clear-filters');
  clearButton?.addEventListener('click', () => {
    const searchInput = document.getElementById('archive-search');
    const statusInput = document.getElementById('archive-status-filter');

    if (searchInput) {
      searchInput.value = '';
    }

    if (statusInput) {
      statusInput.value = '';
    }

    renderRows();
  });
}

function initPage() {
  requireAuth();

  const user = renderUserName('user-name');
  initThemeToggle(user);
  renderAdminLink(user, 'admin-link-placeholder');
  bindLogout('logout-button');

  applyFiltersFromQuery();
  bindFilters();
  loadReports();
}

initPage();
