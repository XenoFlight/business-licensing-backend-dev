import { requireAuth, renderUserName } from '../../core/auth.js';
import { apiFetch } from '../../core/api.js';
import { bindLogout, renderAdminLink } from '../../core/nav.js';
import { getStatusLabel, normalizeStatus } from '../../core/status.js';
import { initThemeToggle } from '../../core/theme.js';

let allBusinesses = [];
let currentUser = null;
let queryStatusFilters = [];

function syncFiltersToQuery() {
  const params = new URLSearchParams();

  const searchValue = (document.getElementById('search-input')?.value || '').trim();
  const statusValue = document.getElementById('status-filter')?.value || '';
  const trashValue = document.getElementById('trash-filter')?.value || '';
  const trashCareValue = document.getElementById('trash-care-filter')?.value || '';
  const showClosed = document.getElementById('show-closed-checkbox')?.checked || false;

  if (searchValue) {
    params.set('q', searchValue);
  }

  if (statusValue) {
    params.set('status', statusValue);
  } else if (queryStatusFilters.length > 1) {
    params.set('statuses', queryStatusFilters.join(','));
  }

  if (trashValue) {
    params.set('trash', trashValue);
  }

  if (trashCareValue) {
    params.set('trashCare', trashCareValue);
  }

  if (showClosed) {
    params.set('showClosed', '1');
  }

  const queryString = params.toString();
  const nextUrl = `${window.location.pathname}${queryString ? `?${queryString}` : ''}`;
  window.history.replaceState(null, '', nextUrl);
}

function escapeHtml(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function statusBadgeClass(status) {
  const map = {
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    under_review: 'bg-amber-50 text-amber-700 border-amber-200',
    application_submitted: 'bg-blue-50 text-blue-700 border-blue-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
    closed: 'bg-slate-200 text-slate-700 border-slate-300',
  };

  return map[status] || 'bg-slate-100 text-slate-700 border-slate-200';
}

function trashCareOwnerLabel(value) {
  const map = {
    municipality: 'המועצה',
    business: 'בעל העסק',
    shared: 'משותף',
    unknown: 'לא צוין',
  };

  return map[value] || 'לא צוין';
}

function createBusinessRow(business) {
  const row = document.createElement('tr');
  row.className = 'hover:bg-slate-50 transition-colors';
  row.dataset.row = 'true';

  const normalizedStatus = normalizeStatus(business.status) || 'application_submitted';
  row.dataset.status = normalizedStatus;
  row.dataset.closed = String(normalizedStatus === 'closed');
  row.dataset.hasTrash = business.hasTrashCans === true ? 'with' : business.hasTrashCans === false ? 'without' : 'unknown';
  row.dataset.trashCareOwner = business.trashCareOwner || 'unknown';

  const localContacts = [
    business.localManagerName ? `מנהל: ${business.localManagerName}${business.localManagerPhone ? ` (${business.localManagerPhone})` : ''}` : null,
    business.localContactName ? `איש קשר: ${business.localContactName}${business.localContactPhone ? ` (${business.localContactPhone})` : ''}` : null,
  ].filter(Boolean).join('<br>') || '-';

  const trashSummary = business.hasTrashCans === true
    ? `${business.trashCanType || 'לא צוין סוג'}${Number.isFinite(business.trashCanCount) ? ` (${business.trashCanCount})` : ''}<br><span class="text-xs">טיפול: ${trashCareOwnerLabel(business.trashCareOwner || 'unknown')}</span>${business.wastePickupSchedule ? `<br><span class="text-xs">פינוי: ${business.wastePickupSchedule}</span>` : ''}`
    : business.hasTrashCans === false
      ? 'אין פחים'
      : 'לא צוין';

  const safeBusinessName = escapeHtml(business.businessName || '-');
  const safeAddress = escapeHtml(business.address || '-');
  const safeOwnerName = escapeHtml(business.ownerName || '-');
  const safeLocalContacts = localContacts === '-' ? '-' : escapeHtml(localContacts).replaceAll('&lt;br&gt;', '<br>');
  const safeTrashSummary = escapeHtml(trashSummary).replaceAll('&lt;br&gt;', '<br>');
  const safeStatusLabel = escapeHtml(getStatusLabel(normalizedStatus));

  row.innerHTML = `
    <td class="px-6 py-4 text-slate-600 font-medium">#${business.id}</td>
    <td class="px-6 py-4 font-medium text-slate-900">
      <a href="business-edit.html?id=${business.id}" class="text-brand-700 hover:text-brand-600 hover:underline">${safeBusinessName}</a>
    </td>
    <td class="px-6 py-4 text-slate-600">${safeAddress}</td>
    <td class="px-6 py-4 text-slate-600">${safeOwnerName}</td>
    <td class="px-6 py-4 text-slate-600 leading-6">${safeLocalContacts}</td>
    <td class="px-6 py-4 text-slate-600">${Number.isFinite(business.localStaffCount) ? business.localStaffCount : '-'}</td>
    <td class="px-6 py-4 text-slate-600 leading-6">${safeTrashSummary}</td>
    <td class="px-6 py-4">
      <span class="inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-semibold ${statusBadgeClass(normalizedStatus)}">${safeStatusLabel}</span>
    </td>
    <td class="px-6 py-4">
      <div class="flex gap-2 flex-wrap">
        <a class="text-xs bg-brand-50 text-brand-700 hover:bg-brand-100 px-3 py-1.5 rounded-md transition-colors font-medium" href="business-edit.html?id=${business.id}">עריכת תיק עסק</a>
        <a class="text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3 py-1.5 rounded-md transition-colors font-medium" href="inspection.html?businessId=${business.id}">ביקורת</a>
        <a class="text-xs bg-slate-100 text-slate-700 hover:bg-slate-200 px-3 py-1.5 rounded-md transition-colors font-medium" href="reports-history.html?businessId=${business.id}">היסטוריה</a>
      </div>
    </td>
  `;

  return row;
}

function updateSummaryCards(totalCount, visibleCount, closedCount, withTrashCount) {
  const totalElement = document.getElementById('total-businesses-count');
  const visibleElement = document.getElementById('visible-businesses-count');
  const closedElement = document.getElementById('closed-businesses-count');
  const trashElement = document.getElementById('trash-businesses-count');
  const resultsLabel = document.getElementById('results-label');

  if (totalElement) {
    totalElement.textContent = String(totalCount);
  }

  if (visibleElement) {
    visibleElement.textContent = String(visibleCount);
  }

  if (closedElement) {
    closedElement.textContent = String(closedCount);
  }

  if (trashElement) {
    trashElement.textContent = String(withTrashCount);
  }

  if (resultsLabel) {
    resultsLabel.textContent = `מציג ${visibleCount} מתוך ${totalCount}`;
  }
}

function updateFilterEmptyState(visibleCount, totalCount) {
  const emptyState = document.getElementById('filter-empty-state');
  if (!emptyState) {
    return;
  }

  emptyState.classList.toggle('hidden', !(totalCount > 0 && visibleCount === 0));
}

function updateActiveFilterIndicator(isActive) {
  const indicator = document.getElementById('businesses-active-filter-indicator');
  if (!indicator) {
    return;
  }

  indicator.classList.toggle('hidden', !isActive);
}

function getFilterData(businesses) {
  const allStatuses = new Set();

  businesses.forEach((business) => {
    const normalizedStatus = normalizeStatus(business.status);
    if (normalizedStatus) {
      allStatuses.add(normalizedStatus);
    }
  });

  return { allStatuses };
}

function populateFilters(allStatuses) {
  const statusSelect = document.getElementById('status-filter');

  statusSelect.innerHTML = '<option value="">כל הסטטוסים</option>';

  Array.from(allStatuses).sort().forEach((status) => {
    const option = document.createElement('option');
    option.value = status;
    option.textContent = getStatusLabel(status);
    statusSelect.appendChild(option);
  });
}

function applyInitialFiltersFromQuery() {
  const params = new URLSearchParams(window.location.search);

  const statusParam = normalizeStatus(params.get('status'));
  const statusesParamRaw = (params.get('statuses') || '').trim();
  const searchParam = (params.get('q') || '').trim();
  const trashParam = (params.get('trash') || '').trim();
  const trashCareParam = (params.get('trashCare') || '').trim();
  const showClosedParam = (params.get('showClosed') || '').trim().toLowerCase();

  const statusSelect = document.getElementById('status-filter');
  const searchInput = document.getElementById('search-input');
  const trashSelect = document.getElementById('trash-filter');
  const trashCareSelect = document.getElementById('trash-care-filter');
  const showClosedCheckbox = document.getElementById('show-closed-checkbox');

  const statusesParam = statusesParamRaw
    ? statusesParamRaw
      .split(',')
      .map((value) => normalizeStatus(value))
      .filter(Boolean)
    : [];

  queryStatusFilters = Array.from(new Set(statusesParam));

  if (statusParam && statusSelect && Array.from(statusSelect.options).some((option) => option.value === statusParam)) {
    statusSelect.value = statusParam;
    queryStatusFilters = [];
  } else if (queryStatusFilters.length === 1 && statusSelect && Array.from(statusSelect.options).some((option) => option.value === queryStatusFilters[0])) {
    statusSelect.value = queryStatusFilters[0];
    queryStatusFilters = [];
  }

  if (searchParam && searchInput) {
    searchInput.value = searchParam;
  }

  if (trashParam && trashSelect && Array.from(trashSelect.options).some((option) => option.value === trashParam)) {
    trashSelect.value = trashParam;
  }

  if (trashCareParam && trashCareSelect && Array.from(trashCareSelect.options).some((option) => option.value === trashCareParam)) {
    trashCareSelect.value = trashCareParam;
  }

  if (showClosedCheckbox) {
    showClosedCheckbox.checked = showClosedParam === '1' || showClosedParam === 'true';
  }
}

function applyFilters() {
  const searchText = document.getElementById('search-input').value.toLowerCase();
  const statusFilter = document.getElementById('status-filter').value;
  const trashFilter = document.getElementById('trash-filter').value;
  const trashCareFilter = document.getElementById('trash-care-filter').value;
  const showClosed = document.getElementById('show-closed-checkbox').checked;

  const rows = document.querySelectorAll('#business-table tbody tr[data-row="true"]');
  let visibleCount = 0;

  rows.forEach((row) => {
    const text = row.textContent.toLowerCase();
    const matchesText = text.includes(searchText);
    const rowStatus = row.dataset.status;
    const statusFilters = statusFilter ? [statusFilter] : queryStatusFilters;
    const matchesStatus = statusFilters.length === 0 || statusFilters.includes(rowStatus);
    const matchesTrash = !trashFilter || row.dataset.hasTrash === trashFilter;
    const matchesTrashCare = !trashCareFilter || row.dataset.trashCareOwner === trashCareFilter;

    const isClosed = row.dataset.closed === 'true';
    const matchesClosed = showClosed || !isClosed;

    const isVisible = matchesText && matchesStatus && matchesTrash && matchesTrashCare && matchesClosed;
    row.style.display = isVisible ? '' : 'none';
    if (isVisible) {
      visibleCount += 1;
    }
  });

  const totalCount = allBusinesses.length;
  const closedCount = allBusinesses.filter((business) => normalizeStatus(business.status) === 'closed').length;
  const withTrashCount = allBusinesses.filter((business) => business.hasTrashCans === true).length;
  const hasActiveFilter = Boolean(searchText || statusFilter || trashFilter || trashCareFilter || showClosed || queryStatusFilters.length > 0);

  updateSummaryCards(totalCount, visibleCount, closedCount, withTrashCount);
  updateFilterEmptyState(visibleCount, totalCount);
  updateActiveFilterIndicator(hasActiveFilter);
  syncFiltersToQuery();
}

function bindFilters() {
  document.getElementById('search-input').addEventListener('input', applyFilters);
  document.getElementById('status-filter').addEventListener('change', () => {
    queryStatusFilters = [];
    applyFilters();
  });
  document.getElementById('trash-filter').addEventListener('change', applyFilters);
  document.getElementById('trash-care-filter').addEventListener('change', applyFilters);
  document.getElementById('show-closed-checkbox').addEventListener('change', applyFilters);

  const clearButton = document.getElementById('clear-filters-btn');
  clearButton?.addEventListener('click', () => {
    queryStatusFilters = [];
    document.getElementById('search-input').value = '';
    document.getElementById('status-filter').value = '';
    document.getElementById('trash-filter').value = '';
    document.getElementById('trash-care-filter').value = '';
    document.getElementById('show-closed-checkbox').checked = false;
    applyFilters();
  });
}

function bindCreateAction() {
  const addButton = document.getElementById('add-business-btn');

  addButton?.addEventListener('click', () => {
    window.location.href = 'business-create.html';
  });
}

async function fetchBusinesses() {
  const tbody = document.querySelector('#business-table tbody');

  try {
    const response = await apiFetch('/api/businesses');

    if (!response.ok) {
      throw new Error('Failed to fetch businesses');
    }

    const businesses = await response.json();
    allBusinesses = Array.isArray(businesses) ? businesses : [];

    tbody.innerHTML = '';
    updateSummaryCards(allBusinesses.length, allBusinesses.length, allBusinesses.filter((business) => normalizeStatus(business.status) === 'closed').length, allBusinesses.filter((business) => business.hasTrashCans === true).length);

    if (allBusinesses.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="px-6 py-8 text-center text-slate-500">לא נמצאו תיקי עסקים במערכת</td></tr>';
      updateFilterEmptyState(0, 0);
      return;
    }

    const { allStatuses } = getFilterData(allBusinesses);
    populateFilters(allStatuses);
    applyInitialFiltersFromQuery();

    allBusinesses.forEach((business) => {
      tbody.appendChild(createBusinessRow(business));
    });

    applyFilters();
  } catch (error) {
    console.error('Error fetching businesses:', error);
    tbody.innerHTML = '<tr><td colspan="9" class="px-6 py-8 text-center text-red-500">שגיאה בטעינת נתונים</td></tr>';
    updateSummaryCards(0, 0, 0, 0);
    updateFilterEmptyState(0, 0);
  }
}

function initBusinessesPage() {
  requireAuth();

  currentUser = renderUserName('user-name');
  initThemeToggle(currentUser);
  renderAdminLink(currentUser, 'admin-link-placeholder');
  bindLogout('logout-button');

  bindFilters();
  bindCreateAction();
  fetchBusinesses();
}

initBusinessesPage();
