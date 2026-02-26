import { requireAuth, renderUserName } from '../../core/auth.js';
import { apiFetch } from '../../core/api.js';
import { bindLogout, renderAdminLink } from '../../core/nav.js';
import { initThemeToggle } from '../../core/theme.js';

let activeUser = null;
let allUpcomingRecords = [];

function getQueryParams() {
  return new URLSearchParams(window.location.search);
}

function updateResultsLabel(visible, total) {
  const label = document.getElementById('upcoming-results-label');
  if (!label) {
    return;
  }

  label.textContent = `מציג ${visible} מתוך ${total}`;
}

function updateActiveFilterIndicator(isActive) {
  const indicator = document.getElementById('upcoming-active-filter-indicator');
  if (!indicator) {
    return;
  }

  indicator.classList.toggle('hidden', !isActive);
}

function getUpcomingFilterState() {
  return {
    source: (document.getElementById('upcoming-source-filter')?.value || 'all').trim(),
    range: (document.getElementById('upcoming-range-filter')?.value || 'all').trim(),
    query: (document.getElementById('upcoming-search')?.value || '').trim().toLowerCase(),
  };
}

function syncUpcomingFiltersToQuery() {
  const params = getQueryParams();
  const state = getUpcomingFilterState();

  params.delete('source');
  params.delete('range');
  params.delete('q');

  if (state.source && state.source !== 'all') {
    params.set('source', state.source);
  }

  if (state.range && state.range !== 'all') {
    params.set('range', state.range);
  }

  if (state.query) {
    params.set('q', state.query);
  }

  const query = params.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}`;
  window.history.replaceState(null, '', nextUrl);
}

function applyUpcomingFiltersFromQuery() {
  const params = getQueryParams();
  const source = (params.get('source') || '').trim();
  const range = (params.get('range') || '').trim();
  const query = (params.get('q') || '').trim();

  const sourceInput = document.getElementById('upcoming-source-filter');
  const rangeInput = document.getElementById('upcoming-range-filter');
  const queryInput = document.getElementById('upcoming-search');

  if (source && sourceInput && Array.from(sourceInput.options).some((option) => option.value === source)) {
    sourceInput.value = source;
  }

  if (range && rangeInput && Array.from(rangeInput.options).some((option) => option.value === range)) {
    rangeInput.value = range;
  }

  if (query && queryInput) {
    queryInput.value = query;
  }
}

function setFeedback(message, tone = 'info') {
  const el = document.getElementById('upcoming-feedback');
  if (!el) {
    return;
  }

  el.textContent = message;
  el.className = 'text-sm mb-4';
  if (tone === 'error') {
    el.classList.add('text-red-600');
  } else if (tone === 'success') {
    el.classList.add('text-emerald-600');
  } else {
    el.classList.add('text-slate-500');
  }
}

function getStorageUserKey(user) {
  return user?.id || user?.email || user?.fullName || 'anonymous';
}

function getLocalCalendarEvents(user) {
  const key = `calendar:local-events:${getStorageUserKey(user)}`;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Failed to parse local calendar events', error);
    return [];
  }
}

function isInspectionEvent(event) {
  const haystack = `${event.title || ''} ${event.description || ''}`.toLowerCase();
  return /ביקורת|inspection|redo|reinspection|חוזרת/.test(haystack);
}

function isDoneLocalEvent(event) {
  return event?.extendedProps?.source === 'local' && event?.extendedProps?.tone === 'done';
}

function toUpcomingRecord(event, sourceLabel) {
  const startDate = event.start ? new Date(event.start) : null;
  if (!startDate || Number.isNaN(startDate.getTime())) {
    return null;
  }

  return {
    eventId: event.id || null,
    title: event.title || 'ללא כותרת',
    sourceLabel,
    source: event.extendedProps?.source || (sourceLabel === 'מקומי' ? 'local' : 'synced'),
    startDate,
    businessId: event.extendedProps?.businessId || null,
  };
}

function categorizeUpcoming(events) {
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;

  const overdue = [];
  const in7 = [];
  const in30 = [];

  events.forEach((event) => {
    const diffMs = event.startDate.getTime() - now.getTime();
    if (diffMs < 0) {
      overdue.push(event);
      return;
    }

    const diffDays = diffMs / dayMs;
    if (diffDays <= 7) {
      in7.push(event);
      return;
    }

    if (diffDays <= 30) {
      in30.push(event);
    }
  });

  const byDateAsc = (first, second) => first.startDate.getTime() - second.startDate.getTime();
  const byDateDesc = (first, second) => second.startDate.getTime() - first.startDate.getTime();
  overdue.sort(byDateDesc);
  in7.sort(byDateAsc);
  in30.sort(byDateAsc);

  return { overdue, in7, in30 };
}

function getRangeBucket(event, now = new Date()) {
  const dayMs = 24 * 60 * 60 * 1000;
  const diffMs = event.startDate.getTime() - now.getTime();

  if (diffMs < 0) {
    return 'overdue';
  }

  const diffDays = diffMs / dayMs;
  if (diffDays <= 7) {
    return '7';
  }

  if (diffDays <= 30) {
    return '30';
  }

  return 'out';
}

function applyUpcomingFiltersAndRender() {
  const state = getUpcomingFilterState();
  const hasActiveFilter = state.source !== 'all' || state.range !== 'all' || Boolean(state.query);

  const filtered = allUpcomingRecords.filter((event) => {
    const matchesSource = state.source === 'all' || event.source === state.source;
    const matchesSearch = !state.query || String(event.title || '').toLowerCase().includes(state.query);

    const bucket = getRangeBucket(event);
    const matchesRange = state.range === 'all'
      ? bucket !== 'out'
      : bucket === state.range;

    return matchesSource && matchesSearch && matchesRange;
  });

  const categorized = categorizeUpcoming(filtered);
  renderUpcomingRows('overdue-body', categorized.overdue, { markOverdue: true });
  renderUpcomingRows('upcoming-7days-body', categorized.in7);
  renderUpcomingRows('upcoming-30days-body', categorized.in30);

  updateResultsLabel(filtered.length, allUpcomingRecords.length);
  updateActiveFilterIndicator(hasActiveFilter);
  syncUpcomingFiltersToQuery();
}

function bindUpcomingFilters() {
  const sourceInput = document.getElementById('upcoming-source-filter');
  const rangeInput = document.getElementById('upcoming-range-filter');
  const queryInput = document.getElementById('upcoming-search');
  const clearButton = document.getElementById('upcoming-clear-filters');

  sourceInput?.addEventListener('change', applyUpcomingFiltersAndRender);
  rangeInput?.addEventListener('change', applyUpcomingFiltersAndRender);
  queryInput?.addEventListener('input', applyUpcomingFiltersAndRender);

  clearButton?.addEventListener('click', () => {
    if (sourceInput) {
      sourceInput.value = 'all';
    }
    if (rangeInput) {
      rangeInput.value = 'all';
    }
    if (queryInput) {
      queryInput.value = '';
    }

    applyUpcomingFiltersAndRender();
  });
}

function renderUpcomingRows(targetBodyId, rows, options = {}) {
  const { markOverdue = false } = options;
  const tbody = document.getElementById(targetBodyId);
  if (!tbody) {
    return;
  }

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-slate-500">לא נמצאו ביקורות בטווח זה.</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map((row) => {
    const formattedDate = row.startDate.toLocaleString('he-IL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    const actionHref = row.businessId
      ? `inspection.html?businessId=${encodeURIComponent(row.businessId)}`
      : 'inspection.html';

    const actionCell = row.source === 'local' && row.eventId
      ? `<button type="button" class="text-brand-600 hover:text-brand-700 hover:underline font-medium" data-action="mark-done" data-event-id="${row.eventId}">סמן כבוצע</button>`
      : `<a href="${actionHref}" class="text-brand-600 hover:text-brand-700 hover:underline font-medium">פתיחת ביקורת</a>`;

    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    const diffDaysRaw = (row.startDate.getTime() - now.getTime()) / dayMs;
    const diffDays = Math.ceil(Math.abs(diffDaysRaw));
    const daysText = diffDaysRaw < 0
      ? `איחור ${diffDays} ימים`
      : diffDays === 0
        ? 'היום'
        : `בעוד ${diffDays} ימים`;

    const daysClass = diffDaysRaw < 0
      ? 'text-red-600 font-bold'
      : diffDays <= 7
        ? 'text-amber-600 font-semibold'
        : 'text-slate-600';

    const rowClassName = markOverdue
      ? 'hover:bg-red-50/60 transition-colors bg-red-50/40'
      : 'hover:bg-slate-50 transition-colors';

    return `
      <tr class="${rowClassName}">
        <td class="px-6 py-4 text-slate-900">${formattedDate}</td>
        <td class="px-6 py-4 ${daysClass}">${daysText}</td>
        <td class="px-6 py-4 text-slate-700">${row.title}</td>
        <td class="px-6 py-4 text-slate-600">${row.sourceLabel}</td>
        <td class="px-6 py-4">${actionCell}</td>
      </tr>
    `;
  }).join('');
}

function updateLocalEventAsDone(eventId) {
  if (!activeUser) {
    return false;
  }

  const key = `calendar:local-events:${getStorageUserKey(activeUser)}`;
  const events = getLocalCalendarEvents(activeUser);
  const target = events.find((event) => String(event.id) === String(eventId));
  if (!target) {
    return false;
  }

  target.extendedProps = {
    ...(target.extendedProps || {}),
    tone: 'done',
    source: 'local',
  };
  target.classNames = ['calendar-event-tone-done'];

  localStorage.setItem(key, JSON.stringify(events));
  return true;
}

function bindUpcomingActions() {
  const tableBodies = ['overdue-body', 'upcoming-7days-body', 'upcoming-30days-body'];
  tableBodies.forEach((bodyId) => {
    const body = document.getElementById(bodyId);
    if (!body) {
      return;
    }

    body.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action="mark-done"]');
      if (!button) {
        return;
      }

      const eventId = button.getAttribute('data-event-id');
      if (!eventId) {
        return;
      }

      const updated = updateLocalEventAsDone(eventId);
      if (!updated) {
        setFeedback('האירוע לא נמצא לעדכון.', 'error');
        return;
      }

      setFeedback('האירוע סומן כבוצע והוסר מרשימת הביקורות הקרובות.', 'success');
      loadUpcomingInspections(activeUser);
    });
  });
}

async function loadUpcomingInspections(user) {
  setFeedback('טוען ביקורות קרובות...', 'info');

  const localEvents = getLocalCalendarEvents(user)
    .filter((event) => !isDoneLocalEvent(event))
    .filter(isInspectionEvent)
    .map((event) => toUpcomingRecord(event, 'מקומי'))
    .filter(Boolean);

  let syncedEvents = [];
  try {
    const response = await apiFetch('/api/calendar/ical', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    const payload = await response.json().catch(() => []);
    if (response.ok) {
      syncedEvents = (Array.isArray(payload) ? payload : [])
        .filter(isInspectionEvent)
        .map((event) => toUpcomingRecord(event, 'מסונכרן'))
        .filter(Boolean);
    }
  } catch (error) {
    console.warn('Failed loading synced calendar for upcoming inspections', error);
  }

  allUpcomingRecords = [...localEvents, ...syncedEvents];
  applyUpcomingFiltersAndRender();

  const total = allUpcomingRecords.filter((event) => getRangeBucket(event) !== 'out').length;
  setFeedback(`נמצאו ${total} ביקורות רלוונטיות (באיחור + עד 30 ימים).`, 'success');
}

function initPage() {
  requireAuth();

  const user = renderUserName('user-name');
  activeUser = user;
  initThemeToggle(user);
  renderAdminLink(user, 'admin-link-placeholder');
  bindLogout('logout-button');

  applyUpcomingFiltersFromQuery();
  bindUpcomingFilters();
  bindUpcomingActions();
  loadUpcomingInspections(user);
}

initPage();
