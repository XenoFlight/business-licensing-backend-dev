import { requireAuth, renderUserName } from '../../core/auth.js';
import { apiFetch } from '../../core/api.js';
import { bindLogout, renderAdminLink } from '../../core/nav.js';
import { getStatusLabel, normalizeStatus } from '../../core/status.js';
import { initThemeToggle } from '../../core/theme.js';

let allBusinesses = [];
let currentUser = null;

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

  row.innerHTML = `
    <td class="px-6 py-4 text-slate-600">#${business.id}</td>
    <td class="px-6 py-4 font-medium text-slate-900">
      <a href="business-edit.html?id=${business.id}" class="text-brand-700 hover:text-brand-600 hover:underline">${business.businessName || '-'}</a>
    </td>
    <td class="px-6 py-4 text-slate-600">${business.address || '-'}</td>
    <td class="px-6 py-4 text-slate-600">${business.ownerName || '-'}</td>
    <td class="px-6 py-4 text-slate-600 leading-6">${localContacts}</td>
    <td class="px-6 py-4 text-slate-600">${Number.isFinite(business.localStaffCount) ? business.localStaffCount : '-'}</td>
    <td class="px-6 py-4 text-slate-600 leading-6">${trashSummary}</td>
    <td class="px-6 py-4 text-slate-600">${getStatusLabel(normalizedStatus)}</td>
    <td class="px-6 py-4 flex gap-2">
      <a class="text-xs bg-brand-50 text-brand-700 hover:bg-brand-100 px-3 py-1.5 rounded-md transition-colors font-medium" href="business-edit.html?id=${business.id}">עריכת תיק עסק</a>
      <a class="text-xs bg-green-50 text-green-700 hover:bg-green-100 px-3 py-1.5 rounded-md transition-colors font-medium" href="inspection.html?businessId=${business.id}">ביקורת</a>
      <a class="text-xs bg-slate-100 text-slate-700 hover:bg-slate-200 px-3 py-1.5 rounded-md transition-colors font-medium" href="reports-history.html?businessId=${business.id}">היסטוריה</a>
    </td>
  `;

  return row;
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

function applyFilters() {
  const searchText = document.getElementById('search-input').value.toLowerCase();
  const statusFilter = document.getElementById('status-filter').value;
  const trashFilter = document.getElementById('trash-filter').value;
  const trashCareFilter = document.getElementById('trash-care-filter').value;
  const showClosed = document.getElementById('show-closed-checkbox').checked;

  const rows = document.querySelectorAll('#business-table tbody tr[data-row="true"]');

  rows.forEach((row) => {
    const text = row.textContent.toLowerCase();
    const matchesText = text.includes(searchText);
    const rowStatus = row.dataset.status;
    const matchesStatus = !statusFilter || rowStatus === statusFilter;
    const matchesTrash = !trashFilter || row.dataset.hasTrash === trashFilter;
    const matchesTrashCare = !trashCareFilter || row.dataset.trashCareOwner === trashCareFilter;

    const isClosed = row.dataset.closed === 'true';
    const matchesClosed = showClosed || !isClosed;

    row.style.display = (matchesText && matchesStatus && matchesTrash && matchesTrashCare && matchesClosed) ? '' : 'none';
  });
}

function bindFilters() {
  document.getElementById('search-input').addEventListener('input', applyFilters);
  document.getElementById('status-filter').addEventListener('change', applyFilters);
  document.getElementById('trash-filter').addEventListener('change', applyFilters);
  document.getElementById('trash-care-filter').addEventListener('change', applyFilters);
  document.getElementById('show-closed-checkbox').addEventListener('change', applyFilters);
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

    if (allBusinesses.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="px-6 py-8 text-center text-slate-500">לא נמצאו תיקי עסקים במערכת</td></tr>';
      return;
    }

    const { allStatuses } = getFilterData(allBusinesses);
    populateFilters(allStatuses);

    allBusinesses.forEach((business) => {
      tbody.appendChild(createBusinessRow(business));
    });

    applyFilters();
  } catch (error) {
    console.error('Error fetching businesses:', error);
    tbody.innerHTML = '<tr><td colspan="9" class="px-6 py-8 text-center text-red-500">שגיאה בטעינת נתונים</td></tr>';
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
