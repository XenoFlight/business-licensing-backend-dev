import { requireAuth, renderUserName } from '../../core/auth.js';
import { apiFetch } from '../../core/api.js';
import { bindLogout, renderAdminLink } from '../../core/nav.js';
import { BUSINESS_STATUS_OPTIONS, getStatusLabel, normalizeStatus } from '../../core/status.js';
import { initThemeToggle } from '../../core/theme.js';

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

let allLicensingItems = [];
let selectedLicensingItems = [];
let regulatorApprovals = {};

function getBusinessIdFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('id');
}

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
  const feedback = document.getElementById('edit-feedback');
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

function fillForm(business) {
  document.getElementById('business-name').value = business?.businessName || '';
  document.getElementById('business-owner').value = business?.ownerName || '';
  document.getElementById('business-owner-id').value = business?.ownerId || '';
  document.getElementById('business-address').value = business?.address || '';
  document.getElementById('business-phone').value = business?.contactPhone || '';
  document.getElementById('business-email').value = business?.email || '';
  document.getElementById('business-license-number').value = business?.licenseNumber || '';
  document.getElementById('business-status').value = normalizeStatus(business?.status) || 'application_submitted';

  document.getElementById('local-staff-count').value = Number.isFinite(business?.localStaffCount) ? business.localStaffCount : '';
  document.getElementById('local-manager-name').value = business?.localManagerName || '';
  document.getElementById('local-manager-phone').value = business?.localManagerPhone || '';
  document.getElementById('local-contact-name').value = business?.localContactName || '';
  document.getElementById('local-contact-phone').value = business?.localContactPhone || '';
  document.getElementById('emergency-contact-name').value = business?.emergencyContactName || '';
  document.getElementById('emergency-contact-phone').value = business?.emergencyContactPhone || '';

  document.getElementById('has-trash-cans').value = business?.hasTrashCans === true ? 'true' : business?.hasTrashCans === false ? 'false' : '';
  document.getElementById('trash-can-type').value = business?.trashCanType || '';
  document.getElementById('trash-can-count').value = Number.isFinite(business?.trashCanCount) ? business.trashCanCount : '';
  document.getElementById('trash-care-owner').value = business?.trashCareOwner || 'unknown';
  document.getElementById('waste-pickup-schedule').value = business?.wastePickupSchedule || '';
  document.getElementById('local-staff-notes').value = business?.localStaffNotes || '';

  const licensingIds = Array.isArray(business?.licensingItemIds)
    ? business.licensingItemIds
    : (business?.licensingItemId ? [business.licensingItemId] : []);

  if (licensingIds.length > 0) {
    selectedLicensingItems = licensingIds
      .map((id) => allLicensingItems.find((item) => item.id === id))
      .filter(Boolean);
  } else {
    selectedLicensingItems = [];
  }

  regulatorApprovals = (business?.regulatorApprovals && typeof business.regulatorApprovals === 'object' && !Array.isArray(business.regulatorApprovals))
    ? business.regulatorApprovals
    : {};

  renderSelectedItems();
  showRegulatorsTable();
}

function populateLicensingCategories() {
  const categorySelect = document.getElementById('licensing-category');
  if (!categorySelect) {
    return;
  }

  const categories = new Set();
  allLicensingItems.forEach((item) => {
    const group = String(item.itemNumber || '').split('.')[0];
    if (group) {
      categories.add(group);
    }
  });

  Array.from(categories)
    .sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10))
    .forEach((category) => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = `${category} - ${categoryNames[category] || 'כללי'}`;
      categorySelect.appendChild(option);
    });
}

function filterLicensingItems() {
  const category = document.getElementById('licensing-category')?.value;
  const itemSelect = document.getElementById('licensing-item-select');
  if (!itemSelect) {
    return;
  }

  itemSelect.innerHTML = '<option value="">בחר פריט רישוי...</option>';
  if (!category) {
    itemSelect.disabled = true;
    return;
  }

  const filteredItems = allLicensingItems.filter((item) => String(item.itemNumber || '').startsWith(`${category}.`));
  filteredItems.forEach((item) => {
    const option = document.createElement('option');
    option.value = String(item.id);
    option.textContent = `${item.itemNumber} - ${item.name}`;
    itemSelect.appendChild(option);
  });

  itemSelect.disabled = false;
}

function addLicensingItem() {
  const select = document.getElementById('licensing-item-select');
  if (!select?.value) {
    return;
  }

  const itemId = select.value;
  if (selectedLicensingItems.some((item) => String(item.id) === itemId)) {
    return;
  }

  const item = allLicensingItems.find((entry) => String(entry.id) === itemId);
  if (item) {
    selectedLicensingItems.push(item);
    renderSelectedItems();
    showRegulatorsTable();
  }

  select.value = '';
}

function removeLicensingItem(id) {
  if (!confirm('האם להסיר פריט רישוי זה?')) {
    return;
  }

  selectedLicensingItems = selectedLicensingItems.filter((item) => String(item.id) !== String(id));

  Object.keys(regulatorApprovals).forEach((key) => {
    if (key.endsWith(`_${id}`)) {
      delete regulatorApprovals[key];
    }
  });

  renderSelectedItems();
  showRegulatorsTable();
}

function getRegulatorApprovalEntry(regulatorKey, itemId) {
  return regulatorApprovals[`${regulatorKey}_${itemId}`] || null;
}

function setRegulatorApprovalEntry(regulatorKey, itemId, patch) {
  const storageKey = `${regulatorKey}_${itemId}`;
  const current = regulatorApprovals[storageKey] || { itemId, approved: false, rejected: false, notes: '' };
  const next = { ...current, ...patch, itemId };

  if (!next.approved && !next.rejected && !String(next.notes || '').trim()) {
    delete regulatorApprovals[storageKey];
    return;
  }

  regulatorApprovals[storageKey] = next;
}

function updateRegulatorCheckbox(regulatorKey, itemId, fieldName, isChecked) {
  const oppositeField = fieldName === 'approved' ? 'rejected' : 'approved';
  const patch = {
    [fieldName]: Boolean(isChecked),
  };

  if (isChecked) {
    patch[oppositeField] = false;
  }

  setRegulatorApprovalEntry(regulatorKey, itemId, patch);

  const oppositeCheckbox = document.querySelector(`input[data-regulator-key="${regulatorKey}"][data-item-id="${itemId}"][data-field="${oppositeField}"]`);
  if (isChecked && oppositeCheckbox) {
    oppositeCheckbox.checked = false;
  }
}

function updateRegulatorNotes(regulatorKey, itemId, notesValue) {
  setRegulatorApprovalEntry(regulatorKey, itemId, { notes: String(notesValue || '') });
}

function renderSelectedItems() {
  const container = document.getElementById('selected-items-container');
  const list = document.getElementById('selected-items-list');
  if (!container || !list) {
    return;
  }

  list.innerHTML = '';
  if (selectedLicensingItems.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  selectedLicensingItems.forEach((item) => {
    const div = document.createElement('div');
    div.className = 'bg-white border border-slate-200 rounded-lg px-3 py-2 flex items-center justify-between gap-2';
    div.innerHTML = `
      <span><strong>${item.itemNumber}</strong> - ${item.name}</span>
      <button type="button" class="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600 transition-colors" onclick="removeLicensingItem('${item.id}')">הסר</button>
    `;
    list.appendChild(div);
  });
}

function showRegulatorsTable() {
  const section = document.getElementById('regulators-section');
  if (!section) {
    return;
  }

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
    itemContainer.className = 'mb-6';
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
      const state = getRegulatorApprovalEntry(regulator.key, item.id) || {};
      const inputNameSuffix = `${regulator.key}_${item.id}`;
      const row = document.createElement('tr');
      row.className = requirementLevel === 2 ? 'bg-blue-50' : 'bg-white';
      row.innerHTML = `
        <td class="px-4 py-2">${regulator.label} ${requirementLevel === 2 ? '(לידיעה)' : ''}</td>
        <td class="px-4 py-2 text-center"><input type="checkbox" class="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500" name="reg_approved_${inputNameSuffix}" data-regulator-key="${regulator.key}" data-item-id="${item.id}" data-field="approved" ${state.approved ? 'checked' : ''}></td>
        <td class="px-4 py-2 text-center"><input type="checkbox" class="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500" name="reg_rejected_${inputNameSuffix}" data-regulator-key="${regulator.key}" data-item-id="${item.id}" data-field="rejected" ${state.rejected ? 'checked' : ''}></td>
        <td class="px-4 py-2"><input type="text" class="w-full px-2 py-1 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-brand-500" name="reg_notes_${inputNameSuffix}" value="${String(state.notes || '').replace(/"/g, '&quot;')}" placeholder="הערות..." data-regulator-key="${regulator.key}" data-item-id="${item.id}" data-field="notes"></td>
      `;
      tbody.appendChild(row);
    });

    if (hasRequirements) {
      itemContainer.appendChild(table);
    } else {
      itemContainer.innerHTML += '<p class="text-sm text-slate-500">אין גורמי אישור נדרשים לפריט זה.</p>';
    }

    section.appendChild(itemContainer);
  });

  section.style.display = 'block';
}

function collectRegulatorApprovalsForSelectedItems() {
  const selectedIds = new Set(selectedLicensingItems.map((item) => item.id));
  const result = {};

  Object.entries(regulatorApprovals).forEach(([key, value]) => {
    const parsedItemId = Number.parseInt(String(value?.itemId), 10);
    if (!Number.isInteger(parsedItemId) || !selectedIds.has(parsedItemId)) {
      return;
    }

    const approved = Boolean(value?.approved);
    const rejected = Boolean(value?.rejected);
    const notes = String(value?.notes || '').trim();
    if (!approved && !rejected && !notes) {
      return;
    }

    result[key] = {
      itemId: parsedItemId,
      approved,
      rejected,
      notes,
    };
  });

  return Object.keys(result).length > 0 ? result : null;
}

function buildPayload() {
  const staffCount = Number.parseInt(document.getElementById('local-staff-count').value, 10);
  const trashCount = Number.parseInt(document.getElementById('trash-can-count').value, 10);

  return {
    businessName: document.getElementById('business-name').value.trim(),
    ownerName: document.getElementById('business-owner').value.trim() || null,
    ownerId: document.getElementById('business-owner-id').value.trim() || null,
    address: document.getElementById('business-address').value.trim() || null,
    contactPhone: document.getElementById('business-phone').value.trim() || null,
    email: document.getElementById('business-email').value.trim() || null,
    licenseNumber: document.getElementById('business-license-number').value.trim() || null,
    status: document.getElementById('business-status').value,
    licensingItemId: selectedLicensingItems.length > 0 ? selectedLicensingItems[0].id : null,
    licensingItemIds: selectedLicensingItems.map((item) => item.id),
    regulatorApprovals: collectRegulatorApprovalsForSelectedItems(),
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

async function loadBusiness() {
  const businessId = getBusinessIdFromUrl();
  if (!businessId) {
    setFeedback('לא התקבל מזהה תיק לעדכון.', 'error');
    return;
  }

  try {
    const [businessResponse, itemsResponse] = await Promise.all([
      apiFetch(`/api/businesses/${businessId}`),
      apiFetch('/api/licensing-items'),
    ]);

    if (!businessResponse.ok) {
      throw new Error('טעינת תיק העסק נכשלה');
    }

    if (itemsResponse.ok) {
      allLicensingItems = await itemsResponse.json();
      populateLicensingCategories();
    }

    const business = await businessResponse.json();
    fillForm(business);
    setFeedback('הנתונים נטענו בהצלחה. ניתן לעדכן ולשמור.', 'success');
  } catch (error) {
    console.error('Failed loading business for edit:', error);
    setFeedback('שגיאה בטעינת תיק העסק.', 'error');
  }
}

async function saveBusiness(event) {
  event.preventDefault();

  const businessId = getBusinessIdFromUrl();
  if (!businessId) {
    setFeedback('לא התקבל מזהה תיק לעדכון.', 'error');
    return;
  }

  const saveButton = document.getElementById('save-btn');
  const originalText = saveButton.textContent;
  saveButton.disabled = true;
  saveButton.textContent = 'שומר...';

  try {
    const response = await apiFetch(`/api/businesses/${businessId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildPayload()),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.message || result.error || 'שמירת תיק העסק נכשלה');
    }

    setFeedback('תיק העסק עודכן בהצלחה.', 'success');
  } catch (error) {
    console.error('Failed updating business:', error);
    setFeedback(error.message || 'שגיאה בשמירת תיק העסק.', 'error');
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

  const form = document.getElementById('business-edit-form');
  form?.addEventListener('submit', saveBusiness);

  const regulatorsSection = document.getElementById('regulators-section');
  regulatorsSection?.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    const regulatorKey = target.getAttribute('data-regulator-key');
    const itemId = Number.parseInt(target.getAttribute('data-item-id') || '', 10);
    const fieldName = target.getAttribute('data-field');

    if (!regulatorKey || !Number.isInteger(itemId) || !fieldName) {
      return;
    }

    if (fieldName === 'approved' || fieldName === 'rejected') {
      updateRegulatorCheckbox(regulatorKey, itemId, fieldName, target.checked);
      return;
    }

    if (fieldName === 'notes') {
      updateRegulatorNotes(regulatorKey, itemId, target.value);
    }
  });

  regulatorsSection?.addEventListener('input', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    const regulatorKey = target.getAttribute('data-regulator-key');
    const itemId = Number.parseInt(target.getAttribute('data-item-id') || '', 10);
    const fieldName = target.getAttribute('data-field');
    if (!regulatorKey || !Number.isInteger(itemId) || fieldName !== 'notes') {
      return;
    }

    updateRegulatorNotes(regulatorKey, itemId, target.value);
  });

  loadBusiness();
}

window.filterLicensingItems = filterLicensingItems;
window.addLicensingItem = addLicensingItem;
window.removeLicensingItem = removeLicensingItem;

initPage();
