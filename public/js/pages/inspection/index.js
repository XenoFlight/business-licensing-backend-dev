import { requireAuth, renderUserName } from '../../core/auth.js';
import { apiFetch } from '../../core/api.js';
import { bindLogout, renderAdminLink } from '../../core/nav.js';
import { initThemeToggle } from '../../core/theme.js';

// ===== Inspection Page =====
// Supports inspections for existing businesses or ad-hoc new business creation.

const token = requireAuth();
const user = renderUserName('user-name');
initThemeToggle(user);
renderAdminLink(user, 'admin-link-placeholder');
bindLogout('logout-button');

// ===== URL and Initial Screen Mode =====
const urlParams = new URLSearchParams(window.location.search);
const businessId = urlParams.get('businessId');
const reportsHistoryButton = document.getElementById('open-reports-history-btn');

if (businessId) {
  document.getElementById('businessId').value = businessId;
  document.getElementById('business-info').style.display = 'block';
  if (reportsHistoryButton) {
    reportsHistoryButton.href = `reports-history.html?businessId=${encodeURIComponent(businessId)}`;
    reportsHistoryButton.classList.remove('hidden');
  }
} else {
  document.getElementById('new-business-form').style.display = 'grid';
  document.querySelector('title').textContent = 'ביקורת לעסק חדש | מערכת רישוי עסקים';
}

// ===== Runtime State =====
let allLicensingItems = [];
let allDefects = [];
let existingBusinessCards = [];
let selectedDefects = [];
let selectedLicensingItems = [];
let selectedRegulatorsData = {};
let map;
let marker;
let selectedCoordinates = null;
const inspectionStatusEl = document.getElementById('inspection-status');
const syncQueueIndicatorEl = document.getElementById('sync-queue-indicator');
const saveLocalDraftBtn = document.getElementById('save-local-draft-btn');
const clearLocalDraftBtn = document.getElementById('clear-local-draft-btn');
const storageUserKey = user?.id || user?.email || user?.fullName || 'anonymous';
const draftStorageKey = `inspection:draft:${storageUserKey}:${businessId || 'new'}`;
const syncQueueStorageKey = `inspection:queue:${storageUserKey}`;
let syncInProgress = false;
const clearExistingMatchBtn = document.getElementById('clear-existing-match-btn');

const categoryNames = {
  1: 'בריאות, רוקחות, קוסמטיקה',
  2: 'דלק ואנרגיה',
  3: 'חקלאות, בעלי חיים',
  4: 'מזון',
  5: 'מים ופסולת',
  6: 'מסחר ושונות',
  7: 'עינוג ציבורי, נופש וספורט',
  8: 'רכב ותעבורה',
  9: 'נשק',
  10: 'תעשייה, מלאכה, כימיה ומחצבים',
};

function normalizeLookupValue(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeOwnerIdValue(value) {
  return String(value || '').trim().toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

function normalizeBusinessNameValue(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/['"׳״]/g, '')
    .replace(/\s+/g, ' ');
}

function setExistingBusinessInfoCard(record) {
  const infoContainer = document.getElementById('business-info');
  if (!infoContainer || businessId) {
    return;
  }

  if (!record) {
    infoContainer.style.display = 'none';
    infoContainer.innerHTML = '';
    clearExistingMatchBtn?.classList.add('hidden');
    return;
  }

  const licensingIds = Array.isArray(record?.licensingItemIds)
    ? record.licensingItemIds
    : (record?.licensingItemId ? [record.licensingItemId] : []);
  const licensingCount = licensingIds.length;
  const licensingSummary = licensingCount > 0
    ? `<strong>פריטי רישוי מהתיק:</strong> נטענו ${licensingCount}`
    : '<strong>פריטי רישוי מהתיק:</strong> לא נמצאו';

  infoContainer.innerHTML = `
    <strong>נמצא תיק עסק קיים:</strong><br>
    <strong>שם העסק:</strong> ${record.businessName || '-'}<br>
    <strong>כתובת:</strong> ${record.address || '-'}<br>
    <strong>בעלים:</strong> ${record.ownerName || '-'}<br>
    ${licensingSummary}
  `;
  infoContainer.style.display = 'block';
  clearExistingMatchBtn?.classList.remove('hidden');
}

function populateExistingBusinessSuggestions() {
  const businessNameList = document.getElementById('business-name-suggestions');
  const ownerIdList = document.getElementById('owner-id-suggestions');

  if (!businessNameList || !ownerIdList) {
    return;
  }

  businessNameList.innerHTML = '';
  ownerIdList.innerHTML = '';

  const usedNames = new Set();
  const usedOwnerIds = new Set();

  existingBusinessCards.forEach((record) => {
    const name = String(record.businessName || '').trim();
    const ownerId = String(record.ownerId || '').trim();

    if (name && !usedNames.has(name)) {
      const option = document.createElement('option');
      option.value = name;
      option.label = ownerId ? `ת.ז/ח.פ ${ownerId}` : '';
      businessNameList.appendChild(option);
      usedNames.add(name);
    }

    if (ownerId && !usedOwnerIds.has(ownerId)) {
      const option = document.createElement('option');
      option.value = ownerId;
      option.label = name || '';
      ownerIdList.appendChild(option);
      usedOwnerIds.add(ownerId);
    }
  });
}

function applyExistingBusinessMatch(record) {
  if (!record) {
    return;
  }

  document.getElementById('businessId').value = String(record.id);
  document.getElementById('newBusinessName').value = record.businessName || '';
  document.getElementById('newAddress').value = record.address || record.businessArea || '';
  document.getElementById('newOwnerName').value = record.ownerName || record.businessOwner || '';
  document.getElementById('newOwnerId').value = record.ownerId || '';
  document.getElementById('newContactPhone').value = record.contactPhone || record.phone || record.mobile || '';
  document.getElementById('newEmail').value = record.email || '';

  if (typeof record.latitude === 'number' && typeof record.longitude === 'number') {
    selectedCoordinates = { lat: record.latitude, lng: record.longitude };
    if (map) {
      placeMarkerAndPanTo({ lat: record.latitude, lng: record.longitude });
    }
  }

  const licensingIds = Array.isArray(record?.licensingItemIds)
    ? record.licensingItemIds
    : (record?.licensingItemId ? [record.licensingItemId] : []);

  selectedLicensingItems = licensingIds
    .map((id) => allLicensingItems.find((item) => item.id === id))
    .filter(Boolean);

  selectedRegulatorsData = (record?.regulatorApprovals && typeof record.regulatorApprovals === 'object' && !Array.isArray(record.regulatorApprovals))
    ? record.regulatorApprovals
    : {};

  renderSelectedItems();
  showRegulatorsTable();

  setExistingBusinessInfoCard(record);
  const loadedLicensingCount = selectedLicensingItems.length;
  const licensingStatusText = loadedLicensingCount > 0
    ? `נטענו ${loadedLicensingCount} פריטי רישוי מהתיק.`
    : 'לא נמצאו פריטי רישוי בתיק.';
  showInspectionStatus(`זוהה תיק עסק קיים. הביקורת תשויך אוטומטית לתיק זה. ${licensingStatusText}`, 'info');
}

function clearExistingBusinessMatch() {
  document.getElementById('businessId').value = '';
  selectedLicensingItems = [];
  selectedRegulatorsData = {};
  renderSelectedItems();
  showRegulatorsTable();
  setExistingBusinessInfoCard(null);
}

function resetNewBusinessFormFields() {
  document.getElementById('newBusinessName').value = '';
  document.getElementById('newAddress').value = '';
  document.getElementById('newOwnerName').value = '';
  document.getElementById('newOwnerId').value = '';
  document.getElementById('newContactPhone').value = '';
  document.getElementById('newEmail').value = '';
  selectedCoordinates = null;
}

function resolveBusinessRecordForAutofill() {
  const inputName = normalizeBusinessNameValue(document.getElementById('newBusinessName')?.value);
  const inputOwnerId = normalizeOwnerIdValue(document.getElementById('newOwnerId')?.value);

  if (!inputName && !inputOwnerId) {
    return null;
  }

  const normalizedRecords = existingBusinessCards.map((record) => ({
    record,
    normalizedName: normalizeBusinessNameValue(record.businessName),
    normalizedOwnerId: normalizeOwnerIdValue(record.ownerId),
  }));

  if (inputOwnerId && inputOwnerId.length >= 3) {
    const ownerExact = normalizedRecords.find((entry) => entry.normalizedOwnerId && entry.normalizedOwnerId === inputOwnerId);
    if (ownerExact) {
      return ownerExact.record;
    }

    const ownerPrefix = normalizedRecords.find((entry) => entry.normalizedOwnerId && entry.normalizedOwnerId.startsWith(inputOwnerId));
    if (ownerPrefix) {
      return ownerPrefix.record;
    }
  }

  if (inputName && inputName.length >= 2) {
    const nameExact = normalizedRecords.find((entry) => entry.normalizedName && entry.normalizedName === inputName);
    if (nameExact) {
      return nameExact.record;
    }

    const namePrefixMatches = normalizedRecords.filter((entry) => entry.normalizedName && entry.normalizedName.startsWith(inputName));
    if (namePrefixMatches.length === 1) {
      return namePrefixMatches[0].record;
    }

    const nameContainsMatches = normalizedRecords.filter((entry) => entry.normalizedName && entry.normalizedName.includes(inputName));
    if (nameContainsMatches.length === 1) {
      return nameContainsMatches[0].record;
    }
  }

  return null;
}

function handleBusinessAutocompleteMatch() {
  if (businessId) {
    return;
  }

  const matched = resolveBusinessRecordForAutofill();
  if (!matched) {
    clearExistingBusinessMatch();
    return;
  }

  applyExistingBusinessMatch(matched);
}

function bindExistingBusinessAutocomplete() {
  if (businessId) {
    return;
  }

  const businessNameInput = document.getElementById('newBusinessName');
  const ownerIdInput = document.getElementById('newOwnerId');

  [businessNameInput, ownerIdInput].forEach((inputElement) => {
    if (!inputElement) {
      return;
    }

    inputElement.addEventListener('input', handleBusinessAutocompleteMatch);
    inputElement.addEventListener('change', handleBusinessAutocompleteMatch);
    inputElement.addEventListener('blur', handleBusinessAutocompleteMatch);
  });
}

// ===== Map Modal and Geocoding =====
function openMapModal() {
  const modal = document.getElementById('mapModal');
  modal.classList.remove('hidden');

  if (!map) {
    initMap();
  } else {
    setTimeout(() => map.invalidateSize(), 300);
  }
}

function closeMapModal() {
  document.getElementById('mapModal').classList.add('hidden');
}

function initMap() {
  const defaultCenter = [31.6, 34.8];
  map = L.map('map').setView(defaultCenter, 11);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  map.on('click', (event) => {
    placeMarkerAndPanTo(event.latlng);
    geocodeLatLng(event.latlng);
  });
}

function placeMarkerAndPanTo(latLng) {
  if (marker) {
    marker.setLatLng(latLng);
  } else {
    marker = L.marker(latLng).addTo(map);
  }

  map.panTo(latLng);
  selectedCoordinates = { lat: latLng.lat, lng: latLng.lng };
}

function geocodeLatLng(latLng) {
  fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latLng.lat}&lon=${latLng.lng}&accept-language=he`)
    .then((response) => response.json())
    .then((data) => {
      if (data?.display_name) {
        document.getElementById('newAddress').value = data.display_name;
      }
    })
    .catch((error) => console.warn('Reverse geocoding failed', error));
}

function geocodeAddress() {
  const address = document.getElementById('newAddress').value;

  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&accept-language=he`)
    .then((response) => response.json())
    .then((data) => {
      if (Array.isArray(data) && data.length > 0) {
        const latLng = new L.LatLng(data[0].lat, data[0].lon);
        placeMarkerAndPanTo(latLng);
      }
    })
    .catch((error) => console.warn('Geocoding failed', error));
}

  // ===== Initial Data Loading =====
async function loadData() {
  try {
    if (businessId) {
      const bizResponse = await apiFetch(`/api/businesses/${businessId}`);
      if (!bizResponse.ok) {
        throw new Error('Failed to fetch business');
      }

      const business = await bizResponse.json();
      document.getElementById('business-info').innerHTML = `
        <strong>שם העסק:</strong> ${business.businessName}<br>
        <strong>כתובת:</strong> ${business.address}<br>
        <strong>בעלים:</strong> ${business.ownerName}
      `;
    } else {
      try {
        const [itemsResponse, businessesResponse] = await Promise.all([
          apiFetch('/api/licensing-items'),
          apiFetch('/api/businesses'),
        ]);

        if (itemsResponse.ok) {
          allLicensingItems = await itemsResponse.json();
          populateLicensingCategories();
        }

        if (businessesResponse.ok) {
          const businessesPayload = await businessesResponse.json();
          existingBusinessCards = Array.isArray(businessesPayload) ? businessesPayload : [];
          populateExistingBusinessSuggestions();
          handleBusinessAutocompleteMatch();
        }
      } catch (error) {
        console.warn('Could not fetch bootstrap data for new inspection', error);
      }
    }

    const defectsResponse = await apiFetch('/api/defects');
    if (!defectsResponse.ok) {
      throw new Error('Failed to fetch defects');
    }

    allDefects = await defectsResponse.json();
    populateDefectCategories();
  } catch (error) {
    console.error(error);
    alert('שגיאה בטעינת הנתונים. אנא נסה שנית.');
  }
}

// ===== Licensing Item Selection =====
function populateLicensingCategories() {
  const categories = new Set();
  allLicensingItems.forEach((item) => {
    const group = item.itemNumber.split('.')[0];
    categories.add(group);
  });

  const catSelect = document.getElementById('licensingCategory');
  Array.from(categories)
    .sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10))
    .forEach((cat) => {
      const option = document.createElement('option');
      option.value = cat.trim();
      option.textContent = `${cat} - ${categoryNames[cat] || 'כללי'}`;
      catSelect.appendChild(option);
    });
}

function filterLicensingItems() {
  const category = document.getElementById('licensingCategory').value;
  const itemSelect = document.getElementById('newLicensingItemId');
  itemSelect.innerHTML = '<option value="">בחר פריט רישוי...</option>';

  if (!category) {
    itemSelect.disabled = true;
    return;
  }

  const filteredItems = allLicensingItems.filter((item) => item.itemNumber.trim().startsWith(`${category}.`));
  filteredItems.forEach((item) => {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = `${item.itemNumber} - ${item.name}`;
    itemSelect.appendChild(option);
  });

  itemSelect.disabled = false;
}

function addLicensingItem() {
  const select = document.getElementById('newLicensingItemId');
  if (!select.value) {
    return;
  }

  const itemId = select.value;
  if (selectedLicensingItems.some((item) => item.id.toString() === itemId)) {
    return;
  }

  const item = allLicensingItems.find((entry) => entry.id.toString() === itemId);
  if (item) {
    selectedLicensingItems.push(item);
    renderSelectedItems();
    showRegulatorsTable();
  }

  select.value = '';
}

function removeLicensingItem(id) {
  if (!confirm('האם אתה בטוח שברצונך להסיר פריט זה?')) {
    return;
  }

  selectedLicensingItems = selectedLicensingItems.filter((item) => item.id.toString() !== id.toString());

  Object.keys(selectedRegulatorsData).forEach((key) => {
    if (key.endsWith(`_${id}`)) {
      delete selectedRegulatorsData[key];
    }
  });

  renderSelectedItems();
  showRegulatorsTable();
}

function renderSelectedItems() {
  const container = document.getElementById('selected-items-container');
  const list = document.getElementById('selected-items-list');
  list.innerHTML = '';

  if (selectedLicensingItems.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  selectedLicensingItems.forEach((item) => {
    const div = document.createElement('div');
    div.className = 'dynamic-item';
    div.innerHTML = `
      <div class="flex justify-between items-center">
        <span><strong>${item.itemNumber}</strong> - ${item.name}</span>
        <button type="button" class="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600 transition-colors" onclick="removeLicensingItem('${item.id}')">הסר</button>
      </div>
    `;
    list.appendChild(div);
  });
}

function showRegulatorsTable() {
  const section = document.getElementById('regulators-section');
  section.innerHTML = '';

  if (selectedLicensingItems.length === 0) {
    section.style.display = 'none';
    return;
  }

  const regulators = [
    { key: 'needsPoliceApproval', label: 'משטרת ישראל' },
    { key: 'needsFireDeptApproval', label: 'כבאות והצלה' },
    { key: 'needsHealthMinistryApproval', label: 'משרד הבריאות' },
    { key: 'needsEnvironmentalProtectionApproval', label: 'איכות הסביבה' },
    { key: 'needsAgricultureMinistryApproval', label: 'משרד החקלאות' },
    { key: 'needsLaborMinistryApproval', label: 'משרד העבודה' },
  ];

  selectedLicensingItems.forEach((item) => {
    const itemContainer = document.createElement('div');
    itemContainer.style.marginBottom = '1.5rem';
    itemContainer.innerHTML = `<h4 class="font-bold text-slate-800 mb-2">גורמי אישור עבור פריט: ${item.itemNumber} - ${item.name}</h4>`;

    const table = document.createElement('table');
    table.className = 'w-full text-sm text-right border border-slate-200 rounded-lg overflow-hidden';
    table.innerHTML = `
      <thead class="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
        <tr>
          <th class="px-4 py-2">גורם מאשר</th>
          <th class="px-4 py-2 text-center">אושר</th>
          <th class="px-4 py-2 text-center">לא אושר</th>
          <th class="px-4 py-2">הערות</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100"></tbody>
    `;

    const tbody = table.querySelector('tbody');
    let hasRequirements = false;

    regulators.forEach((regulator) => {
      const requirementLevel = item[regulator.key];
      if (!requirementLevel) {
        return;
      }

      hasRequirements = true;
      const isInfoOnly = requirementLevel === 2;
      const row = document.createElement('tr');
      row.className = isInfoOnly ? 'bg-blue-50' : 'bg-white';

      const inputNameSuffix = `${regulator.key}_${item.id}`;
      const existingRegulatorData = selectedRegulatorsData[inputNameSuffix] || null;
      const safeNotes = String(existingRegulatorData?.notes || '').replace(/"/g, '&quot;');
      row.innerHTML = `
        <td class="px-4 py-2">${regulator.label} ${isInfoOnly ? '(לידיעה)' : ''}</td>
        <td class="px-4 py-2 text-center"><input type="checkbox" class="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500" name="reg_approved_${inputNameSuffix}" ${existingRegulatorData?.approved ? 'checked' : ''}></td>
        <td class="px-4 py-2 text-center"><input type="checkbox" class="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500" name="reg_rejected_${inputNameSuffix}" ${existingRegulatorData?.rejected ? 'checked' : ''}></td>
        <td class="px-4 py-2"><input type="text" class="w-full px-2 py-1 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-brand-500" name="reg_notes_${inputNameSuffix}" placeholder="הערות..." value="${safeNotes}"></td>
      `;
      tbody.appendChild(row);
    });

    if (hasRequirements) {
      itemContainer.appendChild(table);
      section.appendChild(itemContainer);
    } else {
      itemContainer.innerHTML += '<p class="text-sm text-slate-500">אין גורמי אישור נדרשים לפריט זה.</p>';
      section.appendChild(itemContainer);
    }
  });

  section.style.display = 'block';
}

// ===== Defect Selection =====
function populateDefectCategories() {
  const categories = new Set(allDefects.map((defect) => defect.category));
  const catSelect = document.getElementById('defectCategory');

  Array.from(categories)
    .sort()
    .forEach((category) => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      catSelect.appendChild(option);
    });
}

function filterDefects() {
  const category = document.getElementById('defectCategory').value;
  const defectSelect = document.getElementById('defectSelect');
  defectSelect.innerHTML = '<option value="">בחר ליקוי...</option>';

  if (!category) {
    defectSelect.disabled = true;
    return;
  }

  const filtered = allDefects.filter((defect) => defect.category === category);
  filtered.forEach((defect) => {
    const option = document.createElement('option');
    option.value = defect.id;
    option.textContent = defect.subject;
    option.setAttribute('data-description', defect.description);
    defectSelect.appendChild(option);
  });

  defectSelect.disabled = false;
  if (filtered.length > 0) {
    defectSelect.selectedIndex = 1;
    defectSelect.focus();
  }
}

function addDefect() {
  const select = document.getElementById('defectSelect');
  if (!select.value) {
    showInspectionStatus('יש לבחור ליקוי מהרשימה לפני הוספה.', 'error');
    return;
  }

  const selectedOption = select.options[select.selectedIndex];
  const defectId = select.value;
  const defectSubject = selectedOption.text;
  const defectDesc = selectedOption.getAttribute('data-description');

  if (selectedDefects.some((defect) => defect.id === defectId)) {
    showInspectionStatus('הליקוי כבר נוסף לרשימה.', 'warning');
    return;
  }

  selectedDefects.push({ id: defectId, subject: defectSubject, description: defectDesc, notes: '' });
  renderSelectedDefects();
  updateFindingsText();
  select.value = '';
  showInspectionStatus('הליקוי נוסף בהצלחה.', 'success');
}

function updateFindingsText() {
  const findings = document.getElementById('findings');
  if (selectedDefects.length === 0) {
    findings.value = '';
    return;
  }

  findings.value = selectedDefects
    .map((defect) => {
      const noteText = defect.notes ? `\n  הערות: ${defect.notes}` : '';
      return `- ${defect.subject}: ${defect.description}${noteText}`;
    })
    .join('\n\n');
}

function removeDefect(id) {
  if (!confirm('האם אתה בטוח שברצונך להסיר ליקוי זה?')) {
    return;
  }

  selectedDefects = selectedDefects.filter((defect) => defect.id !== id.toString());
  renderSelectedDefects();
  updateFindingsText();
}

function updateDefectNotes(id, value) {
  const defect = selectedDefects.find((entry) => entry.id === id.toString());
  if (!defect) {
    return;
  }

  defect.notes = value;
  updateFindingsText();
}

function showInspectionStatus(message, type = 'info') {
  if (!inspectionStatusEl) {
    return;
  }

  const typeClassMap = {
    success: 'border-green-200 bg-green-50 text-green-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    error: 'border-red-200 bg-red-50 text-red-800',
    info: 'border-slate-200 bg-slate-50 text-slate-700',
  };

  inspectionStatusEl.className = `w-full rounded-lg border px-4 py-3 text-sm ${typeClassMap[type] || typeClassMap.info}`;
  inspectionStatusEl.textContent = message;
  inspectionStatusEl.classList.remove('hidden');
}

function clearInspectionStatus() {
  if (!inspectionStatusEl) {
    return;
  }

  inspectionStatusEl.classList.add('hidden');
  inspectionStatusEl.textContent = '';
}

function readJsonFromLocalStorage(key, fallbackValue) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return fallbackValue;
    }

    return JSON.parse(raw);
  } catch (error) {
    console.warn('Failed to parse local storage item', key, error);
    return fallbackValue;
  }
}

function getSyncQueue() {
  const queue = readJsonFromLocalStorage(syncQueueStorageKey, []);
  return Array.isArray(queue) ? queue : [];
}

function setSyncQueue(queue) {
  localStorage.setItem(syncQueueStorageKey, JSON.stringify(queue));
  renderSyncQueueIndicator();
}

function renderSyncQueueIndicator() {
  if (!syncQueueIndicatorEl) {
    return;
  }

  const queue = getSyncQueue();
  if (queue.length === 0) {
    syncQueueIndicatorEl.textContent = 'אין דו"חות ממתינים לסנכרון.';
    return;
  }

  syncQueueIndicatorEl.textContent = `יש ${queue.length} דו"חות ממתינים לסנכרון אוטומטי כאשר החיבור יחזור.`;
}

function isTemporaryServerError(statusCode) {
  return statusCode === 429 || statusCode === 502 || statusCode === 503 || statusCode === 504;
}

async function postReportPayload(formData) {
  const response = await fetch('/api/reports', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(formData),
  });

  let result = null;
  try {
    result = await response.json();
  } catch (error) {
    result = null;
  }

  return { response, result };
}

function collectRegulatorsData(currentBusinessId) {
  if (currentBusinessId) {
    return undefined;
  }

  const regulatorsData = {};
  const regulators = [
    'needsPoliceApproval',
    'needsFireDeptApproval',
    'needsHealthMinistryApproval',
    'needsEnvironmentalProtectionApproval',
    'needsAgricultureMinistryApproval',
    'needsLaborMinistryApproval',
  ];

  selectedLicensingItems.forEach((item) => {
    regulators.forEach((key) => {
      const inputNameSuffix = `${key}_${item.id}`;
      const approved = document.querySelector(`input[name="reg_approved_${inputNameSuffix}"]`)?.checked;
      const rejected = document.querySelector(`input[name="reg_rejected_${inputNameSuffix}"]`)?.checked;
      const notes = document.querySelector(`input[name="reg_notes_${inputNameSuffix}"]`)?.value;

      if (approved || rejected || notes) {
        regulatorsData[`${key}_${item.id}`] = { itemId: item.id, approved, rejected, notes };
      }
    });
  });

  return Object.keys(regulatorsData).length ? regulatorsData : undefined;
}

function getCanvasDataUrl(canvasId) {
  if (isCanvasBlank(canvasId)) {
    return null;
  }

  return document.getElementById(canvasId).toDataURL();
}

function buildBusinessDataForSubmission() {
  return {
    businessName: document.getElementById('newBusinessName').value,
    address: document.getElementById('newAddress').value,
    ownerName: document.getElementById('newOwnerName').value,
    ownerId: document.getElementById('newOwnerId').value,
    contactPhone: document.getElementById('newContactPhone').value,
    email: document.getElementById('newEmail').value,
    licensingItemId: selectedLicensingItems.length > 0 ? selectedLicensingItems[0].id : null,
    licensingItemIds: selectedLicensingItems.map((item) => item.id),
    regulatorApprovals: collectRegulatorsData(null),
    latitude: selectedCoordinates ? selectedCoordinates.lat : null,
    longitude: selectedCoordinates ? selectedCoordinates.lng : null,
  };
}

function buildReportFormData() {
  const currentBusinessId = document.getElementById('businessId').value;
  const ownerRefused = document.getElementById('ownerRefusedSign').checked;

  const formData = {
    businessId: currentBusinessId,
    findings: document.getElementById('findings').value,
    status: selectedDefects.length > 0 ? 'fail' : 'pass',
    inspectorSignature: document.getElementById('inspector-signature-pad').toDataURL(),
    ownerSignature: ownerRefused ? 'REFUSED' : document.getElementById('owner-signature-pad').toDataURL(),
    ownerRefusedSign: ownerRefused,
    regulatorsData: collectRegulatorsData(currentBusinessId),
  };

  if (!currentBusinessId) {
    formData.businessData = buildBusinessDataForSubmission();
  }

  return { formData, currentBusinessId, ownerRefused };
}

function clearLocalDraft() {
  localStorage.removeItem(draftStorageKey);
}

function saveLocalDraft(options = {}) {
  const { includeSignatures = false } = options;
  const ownerRefused = document.getElementById('ownerRefusedSign').checked;
  const draftPayload = {
    savedAt: new Date().toISOString(),
    businessId: document.getElementById('businessId').value,
    findings: document.getElementById('findings').value,
    ownerRefusedSign: ownerRefused,
    selectedCoordinates,
    selectedDefects,
    selectedLicensingItemIds: selectedLicensingItems.map((item) => item.id),
    newBusinessData: businessId
      ? null
      : {
          businessName: document.getElementById('newBusinessName').value,
          address: document.getElementById('newAddress').value,
          ownerName: document.getElementById('newOwnerName').value,
          ownerId: document.getElementById('newOwnerId').value,
          contactPhone: document.getElementById('newContactPhone').value,
          email: document.getElementById('newEmail').value,
        },
    regulatorsData: collectRegulatorsData(document.getElementById('businessId').value),
    inspectorSignature: includeSignatures ? getCanvasDataUrl('inspector-signature-pad') : null,
    ownerSignature: ownerRefused ? 'REFUSED' : (includeSignatures ? getCanvasDataUrl('owner-signature-pad') : null),
  };

  localStorage.setItem(draftStorageKey, JSON.stringify(draftPayload));
}

function drawSignatureFromDataUrl(canvasId, signatureDataUrl) {
  if (!signatureDataUrl || signatureDataUrl === 'REFUSED') {
    return;
  }

  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext('2d');
  const image = new Image();
  image.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.clientWidth, canvas.clientHeight);
  };
  image.src = signatureDataUrl;
}

function restoreLocalDraft() {
  const draft = readJsonFromLocalStorage(draftStorageKey, null);
  if (!draft) {
    return;
  }

  if (!confirm('נמצאה טיוטה מקומית. האם לטעון אותה?')) {
    return;
  }

  if (typeof draft.findings === 'string') {
    document.getElementById('findings').value = draft.findings;
  }

  document.getElementById('ownerRefusedSign').checked = Boolean(draft.ownerRefusedSign);
  toggleOwnerSignature();

  if (!businessId && draft.newBusinessData) {
    document.getElementById('newBusinessName').value = draft.newBusinessData.businessName || '';
    document.getElementById('newAddress').value = draft.newBusinessData.address || '';
    document.getElementById('newOwnerName').value = draft.newBusinessData.ownerName || '';
    document.getElementById('newOwnerId').value = draft.newBusinessData.ownerId || '';
    document.getElementById('newContactPhone').value = draft.newBusinessData.contactPhone || '';
    document.getElementById('newEmail').value = draft.newBusinessData.email || '';
  }

  selectedCoordinates = draft.selectedCoordinates || null;
  selectedDefects = Array.isArray(draft.selectedDefects) ? draft.selectedDefects : [];
  renderSelectedDefects();

  const licensingIds = Array.isArray(draft.selectedLicensingItemIds) ? draft.selectedLicensingItemIds : [];
  if (!businessId && licensingIds.length > 0) {
    selectedLicensingItems = allLicensingItems.filter((item) => licensingIds.includes(item.id));
    renderSelectedItems();
    showRegulatorsTable();

    Object.entries(draft.regulatorsData || {}).forEach(([, data]) => {
      const itemId = data.itemId;
      const regulatorKeys = [
        'needsPoliceApproval',
        'needsFireDeptApproval',
        'needsHealthMinistryApproval',
        'needsEnvironmentalProtectionApproval',
        'needsAgricultureMinistryApproval',
        'needsLaborMinistryApproval',
      ];

      regulatorKeys.forEach((key) => {
        const record = draft.regulatorsData[`${key}_${itemId}`];
        if (!record) {
          return;
        }

        const suffix = `${key}_${itemId}`;
        const approvedInput = document.querySelector(`input[name="reg_approved_${suffix}"]`);
        const rejectedInput = document.querySelector(`input[name="reg_rejected_${suffix}"]`);
        const notesInput = document.querySelector(`input[name="reg_notes_${suffix}"]`);
        if (approvedInput) approvedInput.checked = Boolean(record.approved);
        if (rejectedInput) rejectedInput.checked = Boolean(record.rejected);
        if (notesInput) notesInput.value = record.notes || '';
      });
    });
  }

  drawSignatureFromDataUrl('inspector-signature-pad', draft.inspectorSignature);
  if (!draft.ownerRefusedSign) {
    drawSignatureFromDataUrl('owner-signature-pad', draft.ownerSignature);
  }

  showInspectionStatus('הטיוטה המקומית נטענה בהצלחה.', 'success');
}

function queueReportForSync(formData) {
  const queue = getSyncQueue();
  queue.push({
    id: `queued-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    queuedAt: new Date().toISOString(),
    formData,
  });
  setSyncQueue(queue);
  clearLocalDraft();
}

async function syncQueuedReports() {
  if (syncInProgress || !navigator.onLine) {
    renderSyncQueueIndicator();
    return;
  }

  const queue = getSyncQueue();
  if (queue.length === 0) {
    renderSyncQueueIndicator();
    return;
  }

  syncInProgress = true;
  showInspectionStatus(`מסנכרן ${queue.length} דו"חות ששמורים מקומית...`, 'info');

  const remaining = [];
  let syncedCount = 0;

  for (const queuedItem of queue) {
    try {
      const { response } = await postReportPayload(queuedItem.formData);
      if (response.ok) {
        syncedCount += 1;
        continue;
      }

      if (isTemporaryServerError(response.status)) {
        remaining.push(queuedItem);
      }
    } catch (error) {
      remaining.push(queuedItem);
    }
  }

  setSyncQueue(remaining);
  syncInProgress = false;

  if (remaining.length === 0) {
    showInspectionStatus(`הסנכרון הסתיים בהצלחה (${syncedCount} דו"חות).`, 'success');
    return;
  }

  showInspectionStatus(`סונכרנו ${syncedCount} דו"חות. נותרו ${remaining.length} לסנכרון חוזר.`, 'warning');
}

function isCanvasBlank(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    return true;
  }

  const context = canvas.getContext('2d');
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] !== 0) {
      return false;
    }
  }

  return true;
}

function validateNewBusinessPayload(businessData) {
  if (!businessData.businessName?.trim()) {
    return 'יש להזין שם עסק.';
  }

  if (!businessData.address?.trim()) {
    return 'יש להזין כתובת עסק.';
  }

  if (!businessData.ownerName?.trim()) {
    return 'יש להזין שם בעל העסק.';
  }

  if (!businessData.contactPhone?.trim()) {
    return 'יש להזין טלפון ליצירת קשר.';
  }

  if (selectedLicensingItems.length === 0) {
    return 'יש להוסיף לפחות פריט רישוי אחד.';
  }

  return null;
}

function validateInspectionPayload({ currentBusinessId, ownerRefused }) {
  const findingsText = document.getElementById('findings').value.trim();

  if (!findingsText && selectedDefects.length === 0) {
    return 'יש להזין ממצאים או להוסיף לפחות ליקוי אחד.';
  }

  if (isCanvasBlank('inspector-signature-pad')) {
    return 'יש לחתום חתימת מפקח לפני שמירה.';
  }

  if (!ownerRefused && isCanvasBlank('owner-signature-pad')) {
    return 'יש לחתום חתימת בעל העסק או לסמן סירוב חתימה.';
  }

  if (!currentBusinessId) {
    const businessData = {
      businessName: document.getElementById('newBusinessName').value,
      address: document.getElementById('newAddress').value,
      ownerName: document.getElementById('newOwnerName').value,
      contactPhone: document.getElementById('newContactPhone').value,
    };

    return validateNewBusinessPayload(businessData);
  }

  return null;
}

function renderSelectedDefects() {
  const container = document.getElementById('selected-defects-container');
  const list = document.getElementById('selected-defects-list');
  list.innerHTML = '';

  if (selectedDefects.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  selectedDefects.forEach((defect) => {
    const div = document.createElement('div');
    div.className = 'dynamic-item';
    div.innerHTML = `
      <div class="font-bold mb-1 text-slate-800">${defect.subject}: ${defect.description}</div>
      <textarea class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm mb-2 min-h-[60px]" placeholder="הוסף הערות חופשיות לליקוי זה..." oninput="updateDefectNotes('${defect.id}', this.value)">${defect.notes || ''}</textarea>
      <div class="text-left">
        <button type="button" class="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600 transition-colors remove-btn" data-id="${defect.id}">הסר</button>
      </div>
    `;
    list.appendChild(div);
  });
}

// ===== Signature Pad Helpers =====
function initSignaturePad(canvasId) {
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext('2d');
  let isDrawing = false;

  function resizeCanvas() {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.clientWidth * ratio;
    canvas.height = canvas.clientHeight * ratio;
    ctx.scale(ratio, ratio);
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  function startPosition(event) {
    isDrawing = true;
    draw(event);
  }

  function endPosition() {
    isDrawing = false;
    ctx.beginPath();
  }

  function draw(event) {
    if (!isDrawing) {
      return;
    }

    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX || event.touches[0].clientX) - rect.left;
    const y = (event.clientY || event.touches[0].clientY) - rect.top;

    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  canvas.addEventListener('mousedown', startPosition);
  canvas.addEventListener('mouseup', endPosition);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('touchstart', startPosition);
  canvas.addEventListener('touchend', endPosition);
  canvas.addEventListener('touchmove', draw);
}

function clearSignature(canvasId) {
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function toggleOwnerSignature() {
  const isRefused = document.getElementById('ownerRefusedSign').checked;
  const canvas = document.getElementById('owner-signature-pad');
  const button = document.getElementById('clearOwnerSignBtn');

  if (isRefused) {
    canvas.style.display = 'none';
    button.style.display = 'none';
    return;
  }

  canvas.style.display = 'block';
  button.style.display = 'inline-block';
  initSignaturePad('owner-signature-pad');
}

// ===== DOM Event Binding =====
document.getElementById('clearInspectorSignBtn').addEventListener('click', () => clearSignature('inspector-signature-pad'));
document.getElementById('clearOwnerSignBtn').addEventListener('click', () => clearSignature('owner-signature-pad'));
document.getElementById('ownerRefusedSign').addEventListener('change', toggleOwnerSignature);
document.getElementById('ownerRefusedSign').addEventListener('change', saveLocalDraft);
document.getElementById('defectSelect').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    addDefect();
  }
});
document.getElementById('findings').addEventListener('input', clearInspectionStatus);
bindExistingBusinessAutocomplete();
document.getElementById('inspection-form').addEventListener('input', () => {
  saveLocalDraft();
});

if (clearExistingMatchBtn) {
  clearExistingMatchBtn.addEventListener('click', () => {
    clearExistingBusinessMatch();
    resetNewBusinessFormFields();
    showInspectionStatus('השיוך לעסק קיים הוסר. ניתן להמשיך ביצירת עסק חדש.', 'info');
    saveLocalDraft();
  });
}

if (saveLocalDraftBtn) {
  saveLocalDraftBtn.addEventListener('click', () => {
    saveLocalDraft({ includeSignatures: true });
    showInspectionStatus('הטיוטה נשמרה מקומית במחשב זה.', 'success');
  });
}

if (clearLocalDraftBtn) {
  clearLocalDraftBtn.addEventListener('click', () => {
    clearLocalDraft();
    showInspectionStatus('הטיוטה המקומית נמחקה.', 'info');
  });
}

window.addEventListener('online', () => {
  showInspectionStatus('החיבור חזר. מתחיל סנכרון דו"חות מקומיים...', 'info');
  syncQueuedReports();
});

window.addEventListener('offline', () => {
  showInspectionStatus('אין חיבור לרשת. ניתן להמשיך לעבוד ולשמור מקומית.', 'warning');
});

document.getElementById('selected-defects-list').addEventListener('click', (event) => {
  if (event.target?.classList.contains('remove-btn')) {
    const id = event.target.getAttribute('data-id');
    removeDefect(id);
  }
});

// ===== Form Submission =====
document.getElementById('inspection-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  clearInspectionStatus();

  const submitBtn = event.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'מעבד נתונים...';

  const { formData, currentBusinessId, ownerRefused } = buildReportFormData();
  const validationError = validateInspectionPayload({ currentBusinessId, ownerRefused });

  if (validationError) {
    showInspectionStatus(validationError, 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
    return;
  }

  if (!currentBusinessId) {
    const businessValidationError = validateNewBusinessPayload(formData.businessData);
    if (businessValidationError) {
      showInspectionStatus(businessValidationError, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      return;
    }
  }

  try {
    if (!navigator.onLine) {
      queueReportForSync(formData);
      showInspectionStatus('אין חיבור. הדו"ח נשמר מקומית ויסונכרן אוטומטית כשהרשת תחזור.', 'warning');
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      return;
    }

    showInspectionStatus('שומר דו"ח ומפיק קובץ PDF...', 'info');
    const { response, result } = await postReportPayload(formData);

    if (!response.ok) {
      if (isTemporaryServerError(response.status)) {
        queueReportForSync(formData);
        showInspectionStatus('השרת לא זמין כרגע. הדו"ח נשמר מקומית ויסונכרן אוטומטית.', 'warning');
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        return;
      }

      showInspectionStatus(`שגיאה: ${result.message || 'אירעה שגיאה ביצירת הדו"ח'}`, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      return;
    }

    showInspectionStatus('הדו"ח נוצר בהצלחה. מעביר ללוח הבקרה...', 'success');
    clearLocalDraft();
    window.location.href = 'dashboard.html';
  } catch (error) {
    console.error(error);
    queueReportForSync(formData);
    showInspectionStatus('שגיאת תקשורת. הדו"ח נשמר מקומית ויסונכרן אוטומטית.', 'warning');
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
});

// ===== Global Exports for Inline HTML Handlers =====
window.openMapModal = openMapModal;
window.closeMapModal = closeMapModal;
window.geocodeAddress = geocodeAddress;
window.filterLicensingItems = filterLicensingItems;
window.addLicensingItem = addLicensingItem;
window.removeLicensingItem = removeLicensingItem;
window.filterDefects = filterDefects;
window.addDefect = addDefect;
window.updateDefectNotes = updateDefectNotes;

// ===== Page Initialization =====
async function initInspectionPage() {
  await loadData();

  setTimeout(() => {
    initSignaturePad('inspector-signature-pad');
    initSignaturePad('owner-signature-pad');
    restoreLocalDraft();
    renderSyncQueueIndicator();
    syncQueuedReports();
  }, 100);
}

initInspectionPage();
