import { requireAuth, renderUserName } from '../../core/auth.js';
import { apiFetch } from '../../core/api.js';
import { bindLogout, renderAdminLink } from '../../core/nav.js';
import { BUSINESS_STATUS_OPTIONS, getStatusLabel, normalizeStatus } from '../../core/status.js';

// ===== Business Details Page State =====
let activeBusinessId = null;
let locationMap = null;
let locationMarker = null;
let selectedLocation = null;

// ===== Display Helpers =====
function getAddressText(business) {
  return business.address
    || `${business.street || ''} ${business.houseNumber || ''}, ${business.businessArea || ''}`.replace(/^ , /, '').replace(/, $/, '')
    || '-';
}

function getQueryParams() {
  const urlParams = new URLSearchParams(window.location.search);
  return {
    businessId: urlParams.get('id'),
    businessName: urlParams.get('name'),
  };
}

// ===== Location Map UI =====
function setLocationFeedback(message, type = 'info') {
  const feedbackElement = document.getElementById('location-feedback');
  if (!feedbackElement) {
    return;
  }

  feedbackElement.textContent = message;
  feedbackElement.className = 'text-sm mb-3';

  if (type === 'error') {
    feedbackElement.classList.add('text-red-600');
    return;
  }

  if (type === 'success') {
    feedbackElement.classList.add('text-emerald-600');
    return;
  }

  feedbackElement.classList.add('text-slate-500');
}

function renderCoordinates(latlng) {
  const coordinatesElement = document.getElementById('coordinates-value');
  if (!coordinatesElement) {
    return;
  }

  if (!latlng) {
    coordinatesElement.textContent = '-';
    return;
  }

  coordinatesElement.textContent = `${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}`;
}

function setMarker(latlng) {
  if (!locationMap) {
    return;
  }

  if (locationMarker) {
    locationMarker.setLatLng(latlng);
  } else {
    locationMarker = L.marker(latlng).addTo(locationMap);
  }

  selectedLocation = { lat: latlng.lat, lng: latlng.lng };
  renderCoordinates(selectedLocation);
}

function initLocationMap(record) {
  const mapElement = document.getElementById('business-location-map');
  if (!mapElement || locationMap) {
    return;
  }

  const hasCoordinates = typeof record.latitude === 'number' && typeof record.longitude === 'number';
  const initialCenter = hasCoordinates ? [record.latitude, record.longitude] : [31.6, 34.8];
  const initialZoom = hasCoordinates ? 16 : 11;

  locationMap = L.map('business-location-map').setView(initialCenter, initialZoom);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(locationMap);

  locationMap.on('click', (event) => {
    setMarker(event.latlng);
    setLocationFeedback('המיקום עודכן על המפה. לחץ "שמור מיקום" לשמירה במערכת.', 'info');
  });

  if (hasCoordinates) {
    setMarker({ lat: record.latitude, lng: record.longitude });
    setLocationFeedback('נטען מיקום קיים של העסק. ניתן ללחוץ על המפה כדי לעדכן.', 'info');
  } else {
    renderCoordinates(null);
    setLocationFeedback('לא הוגדר מיקום לעסק. לחץ על המפה כדי להציב נעיצה.', 'info');
  }
}

// ===== Location Persistence =====
async function saveBusinessLocation() {
  if (!activeBusinessId) {
    setLocationFeedback('לא ניתן לשמור מיקום: מזהה העסק חסר.', 'error');
    return;
  }

  if (!selectedLocation) {
    setLocationFeedback('יש לבחור נקודה על המפה לפני השמירה.', 'error');
    return;
  }

  const saveButton = document.getElementById('save-location-btn');
  const originalText = saveButton.textContent;

  saveButton.disabled = true;
  saveButton.textContent = 'שומר...';

  try {
    const response = await apiFetch(`/api/businesses/${activeBusinessId}/location`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        latitude: selectedLocation.lat,
        longitude: selectedLocation.lng,
      }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setLocationFeedback(payload.message || 'שמירת המיקום נכשלה.', 'error');
      return;
    }

    setLocationFeedback('המיקום נשמר בהצלחה.', 'success');
  } catch (error) {
    console.error('Error saving location:', error);
    setLocationFeedback('שגיאת תקשורת בשמירת המיקום.', 'error');
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = originalText;
  }
}

// ===== Status Updates =====
async function updateBusinessStatus(id, newStatus) {
  if (!confirm('האם אתה בטוח שברצונך לשנות את סטטוס העסק?')) {
    await loadBusinessDetails();
    return;
  }

  try {
    const response = await apiFetch(`/api/businesses/${id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: newStatus }),
    });

    if (!response.ok) {
      throw new Error('Failed to update status');
    }
  } catch (error) {
    console.error('Error updating status:', error);
    alert('שגיאה בעדכון הסטטוס');
    await loadBusinessDetails();
  }
}

function createStatusSelect(record) {
  const select = document.createElement('select');
  select.className = 'px-2 py-1 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-brand-500';

  const options = [...BUSINESS_STATUS_OPTIONS];
  const normalizedCurrentStatus = normalizeStatus(record.status) || 'application_submitted';

  if (!options.includes(normalizedCurrentStatus)) {
    options.push(normalizedCurrentStatus);
  }

  options.forEach((status) => {
    const option = document.createElement('option');
    option.value = status;
    option.textContent = getStatusLabel(status);
    option.selected = status === normalizedCurrentStatus;
    select.appendChild(option);
  });

  select.addEventListener('change', async (event) => {
    await updateBusinessStatus(record.id, event.target.value);
  });

  return select;
}

// ===== Table Rendering =====
function renderRows(records) {
  const tbody = document.getElementById('files-tbody');
  tbody.innerHTML = '';

  records.forEach((record) => {
    const row = document.createElement('tr');
    row.className = 'hover:bg-slate-50 transition-colors';

    row.innerHTML = `
      <td class="px-6 py-4 text-slate-900 font-medium">${record.fileNumber || '-'}</td>
      <td class="px-6 py-4 text-slate-600">${record.occupationItem || '-'}</td>
      <td class="px-6 py-4" data-col="status"></td>
      <td class="px-6 py-4 text-slate-600">${record.openingDate || '-'}</td>
      <td class="px-6 py-4 text-slate-600">${record.expirationDate || '-'}</td>
      <td class="px-6 py-4 text-slate-600">${record.businessDescription || '-'}</td>
      <td class="px-6 py-4 flex gap-2">
        <a class="text-xs bg-brand-50 text-brand-700 hover:bg-brand-100 px-3 py-1.5 rounded-md transition-colors font-medium" href="business-details.html?id=${record.id}">צפייה בתיק</a>
        <a class="text-xs bg-green-50 text-green-700 hover:bg-green-100 px-3 py-1.5 rounded-md transition-colors font-medium" href="inspection.html?businessId=${record.id}">ביקורת</a>
        <a class="text-xs bg-slate-100 text-slate-700 hover:bg-slate-200 px-3 py-1.5 rounded-md transition-colors font-medium" href="reports-history.html?businessId=${record.id}">היסטוריה</a>
      </td>
    `;

    const statusCell = row.querySelector('[data-col="status"]');
    statusCell.appendChild(createStatusSelect(record));

    tbody.appendChild(row);
  });
}

// ===== Header Rendering =====
function renderBusinessHeader(record) {
  activeBusinessId = record.id;
  document.getElementById('page-title').textContent = `פרטי עסק: ${record.businessName || '-'}`;
  document.getElementById('biz-name').textContent = record.businessName || '-';
  document.getElementById('biz-owner').textContent = record.ownerName || record.businessOwner || '-';
  document.getElementById('biz-address').textContent = getAddressText(record);

  initLocationMap(record);
}

// ===== Data Loading =====
async function loadBusinessDetails() {
  const loading = document.getElementById('loading');
  const content = document.getElementById('content');
  const { businessId, businessName } = getQueryParams();

  if (!businessId && !businessName) {
    loading.textContent = 'שגיאה: לא נבחר עסק';
    return;
  }

  try {
    const endpoint = businessId
      ? `/api/businesses/${encodeURIComponent(businessId)}`
      : `/api/businesses?name=${encodeURIComponent(businessName)}`;

    const response = await apiFetch(endpoint);

    if (!response.ok) {
      throw new Error('Failed to fetch business details');
    }

    const data = await response.json();
    const records = Array.isArray(data) ? data : [data];

    if (records.length === 0) {
      loading.textContent = 'לא נמצאו נתונים עבור עסק זה';
      return;
    }

    renderBusinessHeader(records[0]);
    renderRows(records);

    loading.style.display = 'none';
    content.style.display = 'block';

    if (locationMap) {
      setTimeout(() => locationMap.invalidateSize(), 50);
    }
  } catch (error) {
    console.error('Error loading business details:', error);
    loading.textContent = 'שגיאה בטעינת הנתונים';
  }
}

// ===== Page Bootstrap =====
function initBusinessDetailsPage() {
  requireAuth();

  const user = renderUserName('user-name');
  renderAdminLink(user, 'admin-link-placeholder');
  bindLogout('logout-button');

  const saveLocationButton = document.getElementById('save-location-btn');
  if (saveLocationButton) {
    saveLocationButton.addEventListener('click', saveBusinessLocation);
  }

  loadBusinessDetails();
}

initBusinessDetailsPage();
