import { requireAuth, renderUserName } from '../../core/auth.js';
import { apiFetch } from '../../core/api.js';
import { bindLogout, renderAdminLink } from '../../core/nav.js';
import { getStatusLabel, normalizeStatus } from '../../core/status.js';

// ===== Businesses List Helpers =====
function getAddressText(business) {
  return business.address
    || `${business.street || ''} ${business.houseNumber || ''}, ${business.businessArea || ''}`.replace(/^ , /, '').replace(/, $/, '')
    || '-';
}

function isFullyClosed(statusesArray) {
  if (!Array.isArray(statusesArray) || statusesArray.length === 0) {
    return false;
  }

  return statusesArray.every((status) => normalizeStatus(status) === 'closed');
}

// ===== Row Rendering =====
function createBusinessRow(group) {
  const row = document.createElement('tr');
  row.className = 'hover:bg-slate-50 transition-colors';
  row.dataset.row = 'true';

  const itemsDisplay = Array.from(group.items).join(', ');
  const statusesArray = Array.from(group.statuses)
    .map((status) => normalizeStatus(status))
    .filter(Boolean);

  row.dataset.statuses = JSON.stringify(statusesArray);
  row.dataset.area = group.area;
  row.dataset.closed = String(isFullyClosed(statusesArray));

  row.innerHTML = `
    <td class="px-6 py-4 font-medium text-slate-900">${group.name}</td>
    <td class="px-6 py-4 text-slate-600">${group.address}</td>
    <td class="px-6 py-4 text-slate-600">${group.owner}</td>
    <td class="px-6 py-4 text-slate-600">${itemsDisplay}</td>
    <td class="px-6 py-4 flex gap-2">
      <a class="text-xs bg-brand-50 text-brand-700 hover:bg-brand-100 px-3 py-1.5 rounded-md transition-colors font-medium" href="business-details.html?id=${group.mainId}">פרטים</a>
      <a class="text-xs bg-green-50 text-green-700 hover:bg-green-100 px-3 py-1.5 rounded-md transition-colors font-medium" href="inspection.html?businessId=${group.mainId}">ביקורת</a>
      <a class="text-xs bg-slate-100 text-slate-700 hover:bg-slate-200 px-3 py-1.5 rounded-md transition-colors font-medium" href="reports-history.html?businessId=${group.mainId}">היסטוריה</a>
    </td>
  `;

  return row;
}

// ===== Grouping and Filter Data =====
function groupBusinesses(businesses) {
  const groupedBusinesses = {};
  const allStatuses = new Set();
  const allAreas = new Set();

  businesses.forEach((business) => {
    const name = business.businessName || 'ללא שם';

    if (!groupedBusinesses[name]) {
      groupedBusinesses[name] = {
        name,
        address: getAddressText(business),
        owner: business.ownerName || business.businessOwner || '',
        items: new Set(),
        mainId: business.id,
        statuses: new Set(),
        area: business.businessArea || '',
      };
    }

    const item = (business.LicensingItem && business.LicensingItem.name)
      ? business.LicensingItem.name
      : (business.occupationItem || '-');
    groupedBusinesses[name].items.add(item);

    const normalizedStatus = normalizeStatus(business.status);
    if (normalizedStatus) {
      groupedBusinesses[name].statuses.add(normalizedStatus);
      allStatuses.add(normalizedStatus);
    }

    if (business.businessArea) {
      allAreas.add(business.businessArea);
    }
  });

  return { groupedBusinesses, allStatuses, allAreas };
}

// ===== Filter UI =====
function populateFilters(allStatuses, allAreas) {
  const statusSelect = document.getElementById('status-filter');
  const areaSelect = document.getElementById('area-filter');

  statusSelect.innerHTML = '<option value="">כל הסטטוסים</option>';
  areaSelect.innerHTML = '<option value="">כל האזורים</option>';

  Array.from(allStatuses).sort().forEach((status) => {
    const option = document.createElement('option');
    option.value = status;
    option.textContent = getStatusLabel(status);
    statusSelect.appendChild(option);
  });

  Array.from(allAreas).sort().forEach((area) => {
    const option = document.createElement('option');
    option.value = area;
    option.textContent = area;
    areaSelect.appendChild(option);
  });
}

function applyFilters() {
  const searchText = document.getElementById('search-input').value.toLowerCase();
  const statusFilter = document.getElementById('status-filter').value;
  const areaFilter = document.getElementById('area-filter').value;
  const showClosed = document.getElementById('show-closed-checkbox').checked;

  const rows = document.querySelectorAll('#business-table tbody tr[data-row="true"]');

  rows.forEach((row) => {
    const text = row.textContent.toLowerCase();
    const matchesText = text.includes(searchText);

    const rowStatuses = JSON.parse(row.dataset.statuses || '[]');
    const matchesStatus = !statusFilter || rowStatuses.includes(statusFilter);

    const rowArea = row.dataset.area;
    const matchesArea = !areaFilter || rowArea === areaFilter;

    const isClosed = row.dataset.closed === 'true';
    const matchesClosed = showClosed || !isClosed;

    row.style.display = (matchesText && matchesStatus && matchesArea && matchesClosed) ? '' : 'none';
  });
}

// ===== Filter Event Binding =====
function bindFilters() {
  document.getElementById('search-input').addEventListener('input', applyFilters);
  document.getElementById('status-filter').addEventListener('change', applyFilters);
  document.getElementById('area-filter').addEventListener('change', applyFilters);
  document.getElementById('show-closed-checkbox').addEventListener('change', applyFilters);
}

// ===== Data Loading =====
async function fetchBusinesses() {
  const tbody = document.querySelector('#business-table tbody');

  try {
    const response = await apiFetch('/api/businesses');

    if (!response.ok) {
      throw new Error('Failed to fetch businesses');
    }

    const businesses = await response.json();

    tbody.innerHTML = '';

    if (!Array.isArray(businesses) || businesses.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-slate-500">לא נמצאו עסקים במערכת</td></tr>';
      return;
    }

    const { groupedBusinesses, allStatuses, allAreas } = groupBusinesses(businesses);
    populateFilters(allStatuses, allAreas);

    Object.values(groupedBusinesses).forEach((group) => {
      tbody.appendChild(createBusinessRow(group));
    });
  } catch (error) {
    console.error('Error fetching businesses:', error);
    tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-red-500">שגיאה בטעינת נתונים</td></tr>';
  }
}

// ===== Page Bootstrap =====
function initBusinessesPage() {
  requireAuth();

  const user = renderUserName('user-name');
  renderAdminLink(user, 'admin-link-placeholder');
  bindLogout('logout-button');

  bindFilters();
  fetchBusinesses();
}

initBusinessesPage();
