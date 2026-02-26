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
let selectedDefects = [];
let selectedLicensingItems = [];
let map;
let marker;
let selectedCoordinates = null;

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
        const itemsResponse = await apiFetch('/api/licensing-items');
        if (itemsResponse.ok) {
          allLicensingItems = await itemsResponse.json();
          populateLicensingCategories();
        }
      } catch (error) {
        console.warn('Could not fetch licensing items', error);
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
      row.innerHTML = `
        <td class="px-4 py-2">${regulator.label} ${isInfoOnly ? '(לידיעה)' : ''}</td>
        <td class="px-4 py-2 text-center"><input type="checkbox" class="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500" name="reg_approved_${inputNameSuffix}"></td>
        <td class="px-4 py-2 text-center"><input type="checkbox" class="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500" name="reg_rejected_${inputNameSuffix}"></td>
        <td class="px-4 py-2"><input type="text" class="w-full px-2 py-1 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-brand-500" name="reg_notes_${inputNameSuffix}" placeholder="הערות..."></td>
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
}

function addDefect() {
  const select = document.getElementById('defectSelect');
  if (!select.value) {
    return;
  }

  const selectedOption = select.options[select.selectedIndex];
  const defectId = select.value;
  const defectSubject = selectedOption.text;
  const defectDesc = selectedOption.getAttribute('data-description');

  if (selectedDefects.some((defect) => defect.id === defectId)) {
    return;
  }

  selectedDefects.push({ id: defectId, subject: defectSubject, description: defectDesc, notes: '' });
  renderSelectedDefects();
  updateFindingsText();
  select.value = '';
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

document.getElementById('selected-defects-list').addEventListener('click', (event) => {
  if (event.target?.classList.contains('remove-btn')) {
    const id = event.target.getAttribute('data-id');
    removeDefect(id);
  }
});

// ===== Form Submission =====
document.getElementById('inspection-form').addEventListener('submit', async (event) => {
  event.preventDefault();

  const submitBtn = event.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'מעבד נתונים...';

  const currentBusinessId = document.getElementById('businessId').value;
  const ownerRefused = document.getElementById('ownerRefusedSign').checked;

  const regulatorsData = {};
  if (!currentBusinessId) {
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
  }

  const formData = {
    businessId: currentBusinessId,
    findings: document.getElementById('findings').value,
    status: 'fail',
    inspectorSignature: document.getElementById('inspector-signature-pad').toDataURL(),
    ownerSignature: ownerRefused ? 'REFUSED' : document.getElementById('owner-signature-pad').toDataURL(),
    ownerRefusedSign: ownerRefused,
    regulatorsData: Object.keys(regulatorsData).length ? regulatorsData : undefined,
  };

  if (!currentBusinessId) {
    formData.businessData = {
      businessName: document.getElementById('newBusinessName').value,
      address: document.getElementById('newAddress').value,
      ownerName: document.getElementById('newOwnerName').value,
      ownerId: document.getElementById('newOwnerId').value,
      contactPhone: document.getElementById('newContactPhone').value,
      email: document.getElementById('newEmail').value,
      licensingItemId: selectedLicensingItems.length > 0 ? selectedLicensingItems[0].id : null,
      latitude: selectedCoordinates ? selectedCoordinates.lat : null,
      longitude: selectedCoordinates ? selectedCoordinates.lng : null,
    };

    if (!formData.businessData.businessName || selectedLicensingItems.length === 0) {
      alert('יש למלא את כל שדות החובה של העסק (שם עסק, לפחות פריט רישוי אחד וכו\')');
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      return;
    }
  }

  try {
    const response = await fetch('/api/reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(formData),
    });

    const result = await response.json();

    if (!response.ok) {
      alert(`שגיאה: ${result.message || 'אירעה שגיאה ביצירת הדו"ח'}`);
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      return;
    }

    alert('הדו"ח נוצר בהצלחה!');
    window.location.href = 'dashboard.html';
  } catch (error) {
    console.error(error);
    alert('שגיאת תקשורת');
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
loadData();
setTimeout(() => {
  initSignaturePad('inspector-signature-pad');
  initSignaturePad('owner-signature-pad');
}, 100);
