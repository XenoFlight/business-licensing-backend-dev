import { requireAuth, renderUserName } from '../../core/auth.js';
import { apiFetch } from '../../core/api.js';
import { bindLogout, renderAdminLink } from '../../core/nav.js';
import { initThemeToggle } from '../../core/theme.js';

// ===== Reports History Page =====
// Loads and renders inspection history for a selected business.
let cachedReports = [];
let currentBusinessName = '';
let currentUser = null;

function getQueryParams() {
  return new URLSearchParams(window.location.search);
}

function syncFiltersToQuery() {
  const params = getQueryParams();
  const businessId = getBusinessId();

  params.delete('status');
  params.delete('from');
  params.delete('to');
  params.delete('q');

  if (businessId) {
    params.set('businessId', businessId);
  }

  const statusValue = (document.getElementById('reports-status-filter')?.value || '').trim();
  const fromValue = (document.getElementById('reports-date-from')?.value || '').trim();
  const toValue = (document.getElementById('reports-date-to')?.value || '').trim();
  const searchValue = (document.getElementById('reports-search')?.value || '').trim();

  if (statusValue) {
    params.set('status', statusValue);
  }

  if (fromValue) {
    params.set('from', fromValue);
  }

  if (toValue) {
    params.set('to', toValue);
  }

  if (searchValue) {
    params.set('q', searchValue);
  }

  const query = params.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}`;
  window.history.replaceState(null, '', nextUrl);
}

function updateResultsLabel(visibleCount, totalCount) {
  const label = document.getElementById('reports-results-label');
  if (!label) {
    return;
  }

  label.textContent = `מציג ${visibleCount} מתוך ${totalCount}`;
}

function updateActiveFilterIndicator(isActive) {
  const indicator = document.getElementById('reports-active-filter-indicator');
  if (!indicator) {
    return;
  }

  indicator.classList.toggle('hidden', !isActive);
}

function filterReports(reports) {
  const statusFilter = (document.getElementById('reports-status-filter')?.value || '').trim();
  const dateFromFilter = (document.getElementById('reports-date-from')?.value || '').trim();
  const dateToFilter = (document.getElementById('reports-date-to')?.value || '').trim();
  const searchFilter = (document.getElementById('reports-search')?.value || '').trim().toLowerCase();

  return reports.filter((report) => {
    const reportStatus = String(report.status || '').trim();
    const matchesStatus = !statusFilter || reportStatus === statusFilter;

    const reportDate = report.visitDate ? new Date(report.visitDate) : null;
    const reportDateIso = reportDate && !Number.isNaN(reportDate.getTime())
      ? reportDate.toISOString().slice(0, 10)
      : '';

    const matchesFrom = !dateFromFilter || (reportDateIso && reportDateIso >= dateFromFilter);
    const matchesTo = !dateToFilter || (reportDateIso && reportDateIso <= dateToFilter);

    const searchHaystack = `${report.findings || ''} ${report.inspector?.fullName || ''}`.toLowerCase();
    const matchesSearch = !searchFilter || searchHaystack.includes(searchFilter);

    return matchesStatus && matchesFrom && matchesTo && matchesSearch;
  });
}

function applyReportFilters() {
  const statusFilter = (document.getElementById('reports-status-filter')?.value || '').trim();
  const dateFromFilter = (document.getElementById('reports-date-from')?.value || '').trim();
  const dateToFilter = (document.getElementById('reports-date-to')?.value || '').trim();
  const searchFilter = (document.getElementById('reports-search')?.value || '').trim();

  const hasActiveFilter = Boolean(statusFilter || dateFromFilter || dateToFilter || searchFilter);
  const filteredReports = filterReports(cachedReports);

  if (filteredReports.length === 0) {
    renderEmptyRow();
    updateResultsLabel(0, cachedReports.length);
    updateActiveFilterIndicator(hasActiveFilter);
    syncFiltersToQuery();
    return;
  }

  renderReportsRows(filteredReports);
  updateResultsLabel(filteredReports.length, cachedReports.length);
  updateActiveFilterIndicator(hasActiveFilter);
  syncFiltersToQuery();
}

function applyInitialFiltersFromQuery() {
  const params = getQueryParams();

  const status = (params.get('status') || '').trim();
  const from = (params.get('from') || '').trim();
  const to = (params.get('to') || '').trim();
  const search = (params.get('q') || '').trim();

  const statusInput = document.getElementById('reports-status-filter');
  const fromInput = document.getElementById('reports-date-from');
  const toInput = document.getElementById('reports-date-to');
  const searchInput = document.getElementById('reports-search');

  if (status && statusInput && Array.from(statusInput.options).some((option) => option.value === status)) {
    statusInput.value = status;
  }

  if (from && fromInput) {
    fromInput.value = from;
  }

  if (to && toInput) {
    toInput.value = to;
  }

  if (search && searchInput) {
    searchInput.value = search;
  }
}

function getCalendarLocalEventsStorageKey() {
  const storageUserKey = currentUser?.id || currentUser?.email || currentUser?.fullName || 'anonymous';
  return `calendar:local-events:${storageUserKey}`;
}

function readLocalCalendarEvents() {
  try {
    const raw = localStorage.getItem(getCalendarLocalEventsStorageKey());
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Failed to read local calendar events', error);
    return [];
  }
}

function writeLocalCalendarEvents(events) {
  localStorage.setItem(getCalendarLocalEventsStorageKey(), JSON.stringify(events));
}

function addRedoInspectionToLocalCalendar({ businessId, businessName, report, findings, redoDate }) {
  const startDate = new Date(redoDate);
  if (Number.isNaN(startDate.getTime())) {
    throw new Error('INVALID_REDO_DATE');
  }

  const endDate = new Date(startDate.getTime() + (60 * 60 * 1000));
  const originalVisitDate = report?.visitDate
    ? new Date(report.visitDate).toLocaleString('he-IL')
    : 'לא ידוע';
  const inspectorName = report?.inspector?.fullName || 'לא ידוע';

  const eventDescription = [
    `ביקורת חוזרת עבור עסק: ${businessName || `#${businessId}`}`,
    `מקור: דו"ח ביקורת מתאריך ${originalVisitDate}`,
    `מפקח אחרון: ${inspectorName}`,
    `סטטוס דו"ח אחרון: ${report?.status || '-'}`,
    '',
    'ליקויים/ממצאים מהביקורת האחרונה:',
    findings || 'לא הוזנו ממצאים.',
  ].join('\n');

  const localEvents = readLocalCalendarEvents();
  localEvents.push({
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: `ביקורת חוזרת - ${businessName || `עסק #${businessId}`}`,
    start: startDate.toISOString(),
    end: endDate.toISOString(),
    description: eventDescription,
    location: '',
    classNames: ['calendar-event-tone-pending'],
    extendedProps: {
      tone: 'pending',
      source: 'local',
      isRedo: true,
      businessId: String(businessId),
    },
  });

  writeLocalCalendarEvents(localEvents);
}

function openEditModal(report) {
  const modal = document.getElementById('edit-report-modal');
  const reportIdInput = document.getElementById('edit-report-id');
  const statusInput = document.getElementById('edit-report-status');
  const findingsInput = document.getElementById('edit-report-findings');
  const scheduleRedoInput = document.getElementById('edit-schedule-redo');
  const redoDateInput = document.getElementById('edit-redo-date');

  if (!modal || !reportIdInput || !statusInput || !findingsInput || !scheduleRedoInput || !redoDateInput) {
    return;
  }

  reportIdInput.value = String(report.id || '');
  statusInput.value = report.status || 'pass';
  findingsInput.value = report.findings || '';
  scheduleRedoInput.checked = false;
  redoDateInput.value = '';
  redoDateInput.disabled = true;

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
  return getQueryParams().get('businessId');
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

  tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-slate-500">לא נמצאו דו"חות לפי הסינון שנבחר.</td></tr>';
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
      <td class="px-6 py-4">
        <button type="button" data-report-id="${report.id}" class="edit-report-button text-brand-600 hover:text-brand-700 hover:underline font-medium">עריכה</button>
      </td>
    `;

    tbody.appendChild(row);
  });
}

function bindFilters() {
  const statusInput = document.getElementById('reports-status-filter');
  const fromInput = document.getElementById('reports-date-from');
  const toInput = document.getElementById('reports-date-to');
  const searchInput = document.getElementById('reports-search');
  const clearButton = document.getElementById('reports-clear-filters');

  statusInput?.addEventListener('change', applyReportFilters);
  fromInput?.addEventListener('change', applyReportFilters);
  toInput?.addEventListener('change', applyReportFilters);
  searchInput?.addEventListener('input', applyReportFilters);

  clearButton?.addEventListener('click', () => {
    if (statusInput) {
      statusInput.value = '';
    }
    if (fromInput) {
      fromInput.value = '';
    }
    if (toInput) {
      toInput.value = '';
    }
    if (searchInput) {
      searchInput.value = '';
    }

    applyReportFilters();
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
  currentBusinessName = business.businessName || '';
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

    cachedReports = Array.isArray(reports) ? reports : [];

    if (cachedReports.length === 0) {
      renderEmptyRow();
      updateResultsLabel(0, 0);
      return;
    }

    applyReportFilters();
  } catch (error) {
    console.error('Failed loading reports history:', error);
    renderErrorRow('שגיאה בטעינת הנתונים.');
    updateResultsLabel(0, 0);
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
  const scheduleRedoInput = document.getElementById('edit-schedule-redo');
  const redoDateInput = document.getElementById('edit-redo-date');

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

  if (scheduleRedoInput && redoDateInput) {
    scheduleRedoInput.addEventListener('change', () => {
      const enabled = scheduleRedoInput.checked;
      redoDateInput.disabled = !enabled;
      if (!enabled) {
        redoDateInput.value = '';
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
    const shouldScheduleRedo = Boolean(scheduleRedoInput?.checked);
    const redoDate = redoDateInput?.value;

    if (!reportId || !status || !findings) {
      alert('יש למלא את כל השדות לפני שמירה.');
      return;
    }

    if (shouldScheduleRedo && !redoDate) {
      alert('יש לבחור תאריך לביקורת חוזרת.');
      return;
    }

    const originalLabel = saveButton.textContent;
    saveButton.disabled = true;
    saveButton.textContent = 'שומר...';

    try {
      await updateReport(reportId, { status, findings });
      if (shouldScheduleRedo) {
        const selectedReport = cachedReports.find((report) => String(report.id) === String(reportId));
        addRedoInspectionToLocalCalendar({
          businessId,
          businessName: currentBusinessName,
          report: selectedReport,
          findings,
          redoDate,
        });
      }

      closeEditModal();
      await loadReports(businessId);
      if (shouldScheduleRedo) {
        const shouldOpenCalendar = confirm('הדו"ח עודכן בהצלחה ונוספה ביקורת חוזרת ליומן המקומי. לעבור עכשיו ליומן?');
        if (shouldOpenCalendar) {
          window.location.href = 'calendar.html';
          return;
        }
      } else {
        alert('הדו"ח עודכן בהצלחה.');
      }
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

  currentUser = renderUserName('user-name');
  initThemeToggle(currentUser);
  renderAdminLink(currentUser, 'admin-link-placeholder');
  bindLogout('logout-button');

  const businessId = getBusinessId();
  if (!businessId) {
    alert('שגיאה: לא נבחר עסק.');
    window.location.href = 'dashboard.html';
    return;
  }

  bindFilters();
  applyInitialFiltersFromQuery();
  bindEditActions(businessId);
  loadReports(businessId);
}

initPage();
