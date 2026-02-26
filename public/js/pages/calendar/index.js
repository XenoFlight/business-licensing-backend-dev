import { requireAuth, renderUserName } from '../../core/auth.js';
import { apiFetch } from '../../core/api.js';
import { bindLogout, renderAdminLink } from '../../core/nav.js';
import { initThemeToggle } from '../../core/theme.js';

// ===== Calendar Page =====
// Authenticated calendar view backed by ICS sync + local event persistence.

const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;
const STATUS_TONE = {
  DEFAULT: 'default',
  PENDING: 'pending',
  DONE: 'done',
  ALERT: 'alert',
};

let storageUserKey = 'anonymous';
let loadedCalendarEvents = [];
let syncedCalendarEvents = [];
let localCalendarEvents = [];
let hiddenSyncedEventIds = [];
let activeCalendarFilter = 'all';
let selectedModalEvent = null;

function getInitialCalendarFilterFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const candidate = params.get('filter');
  const allowed = ['all', 'pending', 'alert', 'done', 'redo'];
  return allowed.includes(candidate) ? candidate : 'all';
}

function getLocalEventsStorageKey() {
  return `calendar:local-events:${storageUserKey}`;
}

function getHiddenSyncedStorageKey() {
  return `calendar:hidden-synced:${storageUserKey}`;
}

function readJsonFromLocalStorage(key, fallbackValue) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return fallbackValue;
    }

    return JSON.parse(raw);
  } catch (error) {
    console.warn('Failed to read local storage key', key, error);
    return fallbackValue;
  }
}

function saveLocalCalendarState() {
  localStorage.setItem(getLocalEventsStorageKey(), JSON.stringify(localCalendarEvents));
  localStorage.setItem(getHiddenSyncedStorageKey(), JSON.stringify(hiddenSyncedEventIds));
}

function loadLocalCalendarState() {
  const localEvents = readJsonFromLocalStorage(getLocalEventsStorageKey(), []);
  const hiddenSynced = readJsonFromLocalStorage(getHiddenSyncedStorageKey(), []);

  localCalendarEvents = Array.isArray(localEvents) ? localEvents : [];
  hiddenSyncedEventIds = Array.isArray(hiddenSynced) ? hiddenSynced : [];
}

function buildStableEventId(input) {
  const raw = String(input || 'event');
  let hash = 0;
  for (let index = 0; index < raw.length; index += 1) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(index);
    hash |= 0;
  }

  return `synced-${Math.abs(hash)}`;
}

// ===== Calendar Feedback UI =====
function setIcalFeedback(message, type = 'info') {
  const feedback = document.getElementById('ical-feedback');
  if (!feedback) {
    return;
  }

  feedback.textContent = message || '';
  feedback.className = 'text-sm';

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

function inferEventTone(event) {
  const haystack = `${event.title || ''} ${event.description || ''}`.toLowerCase();

  if (/דחוף|חריג|אזהרה|urgent|critical|overdue|failed|fail|נדחה/.test(haystack)) {
    return STATUS_TONE.ALERT;
  }

  if (/בוצע|הושלם|עבר|נסגר|approved|done|completed|pass/.test(haystack)) {
    return STATUS_TONE.DONE;
  }

  if (/בטיפול|ממתין|pending|review|renewal|process|חדש|scheduled/.test(haystack)) {
    return STATUS_TONE.PENDING;
  }

  return STATUS_TONE.DEFAULT;
}

function isRedoInspectionEvent(event) {
  const haystack = `${event.title || ''} ${event.description || ''}`.toLowerCase();
  if (/ביקורת חוזרת|redo inspection|re-inspection|reinspection/.test(haystack)) {
    return true;
  }

  return Boolean(event.extendedProps?.isRedo);
}

function extractBusinessId(event) {
  const haystack = `${event.title || ''} ${event.description || ''} ${event.location || ''}`;
  const patterns = [
    /businessid\s*[:=]\s*(\d+)/i,
    /business\s*#\s*(\d+)/i,
    /עסק\s*#\s*(\d+)/i,
    /מזהה\s*עסק\s*[:=]\s*(\d+)/i,
    /id\s*[:=]\s*(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = haystack.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function formatEventDateRange(eventInfo) {
  const startDate = eventInfo.event.start;
  const endDate = eventInfo.event.end;
  if (!startDate) {
    return 'ללא תאריך';
  }

  const dateOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };
  const timeOptions = { hour: '2-digit', minute: '2-digit' };
  const locale = 'he-IL';
  const isAllDay = eventInfo.event.allDay;

  const startLabel = isAllDay
    ? startDate.toLocaleDateString(locale, dateOptions)
    : `${startDate.toLocaleDateString(locale, dateOptions)} ${startDate.toLocaleTimeString(locale, timeOptions)}`;

  if (!endDate) {
    return startLabel;
  }

  const endLabel = isAllDay
    ? endDate.toLocaleDateString(locale, dateOptions)
    : `${endDate.toLocaleDateString(locale, dateOptions)} ${endDate.toLocaleTimeString(locale, timeOptions)}`;

  return `${startLabel} - ${endLabel}`;
}

function closeEventModal() {
  const modal = document.getElementById('calendar-event-modal');
  if (!modal) {
    return;
  }

  selectedModalEvent = null;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

function openEventModal(eventInfo) {
  const modal = document.getElementById('calendar-event-modal');
  if (!modal) {
    return;
  }

  const titleEl = document.getElementById('calendar-modal-title');
  const timeEl = document.getElementById('calendar-modal-time');
  const locationEl = document.getElementById('calendar-modal-location');
  const descriptionEl = document.getElementById('calendar-modal-description');
  const inspectionLink = document.getElementById('calendar-modal-inspection-link');
  const reportsLink = document.getElementById('calendar-modal-reports-link');
  const deleteButton = document.getElementById('calendar-modal-delete-btn');

  const businessId = eventInfo.event.extendedProps?.businessId || null;
  const source = eventInfo.event.extendedProps?.source || 'synced';
  const location = eventInfo.event.extendedProps?.location || 'ללא מיקום';
  const description = eventInfo.event.extendedProps?.description || 'אין תיאור נוסף לאירוע.';

  selectedModalEvent = {
    id: eventInfo.event.id,
    source,
  };

  titleEl.textContent = eventInfo.event.title || 'אירוע';
  timeEl.textContent = `זמן: ${formatEventDateRange(eventInfo)}`;
  locationEl.textContent = `מיקום: ${location}`;
  descriptionEl.textContent = description;

  inspectionLink.href = businessId
    ? `inspection.html?businessId=${encodeURIComponent(businessId)}`
    : 'inspection.html';

  reportsLink.href = businessId
    ? `reports-history.html?businessId=${encodeURIComponent(businessId)}`
    : 'businesses.html';

  reportsLink.textContent = businessId ? 'דו"חות עסק' : 'מעבר לניהול תיקי עסקים';

  if (deleteButton) {
    deleteButton.textContent = source === 'local' ? 'מחיקת אירוע מקומי' : 'הסתרת אירוע מסונכרן';
  }

  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function normalizeCalendarEvents(rawEvents, source = 'synced') {
  return rawEvents.map((event) => {
    const startIso = event.start ? new Date(event.start).toISOString() : '';
    const endIso = event.end ? new Date(event.end).toISOString() : '';
    const tone = event.extendedProps?.tone || inferEventTone(event);
    const stableId = event.id || (source === 'local'
      ? `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      : buildStableEventId(`${event.title || ''}|${startIso}|${endIso}|${event.location || ''}`));

    return {
      ...event,
      id: stableId,
      classNames: [`calendar-event-tone-${tone}`],
      extendedProps: {
        ...(event.extendedProps || {}),
        description: event.description || '',
        location: event.location || '',
        tone,
        source,
        isRedo: isRedoInspectionEvent(event),
        businessId: extractBusinessId(event),
      },
    };
  });
}

function rebuildLoadedEvents() {
  const visibleSynced = syncedCalendarEvents.filter((event) => !hiddenSyncedEventIds.includes(event.id));
  loadedCalendarEvents = [...visibleSynced, ...localCalendarEvents];
}

function getFilteredEvents(events, filter) {
  if (filter === 'all') {
    return events;
  }

  if (filter === 'redo') {
    return events.filter((event) => Boolean(event.extendedProps?.isRedo));
  }

  return events.filter((event) => (event.extendedProps?.tone || STATUS_TONE.DEFAULT) === filter);
}

function applyCalendarFilter(calendar) {
  rebuildLoadedEvents();
  const filteredEvents = getFilteredEvents(loadedCalendarEvents, activeCalendarFilter);
  calendar.removeAllEvents();
  calendar.addEventSource(filteredEvents);
}

function openLocalEventModal() {
  const modal = document.getElementById('calendar-local-event-modal');
  if (!modal) {
    return;
  }

  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeLocalEventModal() {
  const modal = document.getElementById('calendar-local-event-modal');
  if (!modal) {
    return;
  }

  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

function createLocalEventFromForm() {
  const title = document.getElementById('local-event-title').value.trim();
  const start = document.getElementById('local-event-start').value;
  const end = document.getElementById('local-event-end').value;
  const tone = document.getElementById('local-event-tone').value;
  const location = document.getElementById('local-event-location').value.trim();
  const description = document.getElementById('local-event-description').value.trim();

  if (!title || !start) {
    return { error: 'יש למלא כותרת ותאריך התחלה לאירוע המקומי.' };
  }

  const startDate = new Date(start);
  const endDate = end ? new Date(end) : null;

  if (Number.isNaN(startDate.getTime())) {
    return { error: 'תאריך התחלה אינו תקין.' };
  }

  if (endDate && Number.isNaN(endDate.getTime())) {
    return { error: 'תאריך סיום אינו תקין.' };
  }

  if (endDate && endDate < startDate) {
    return { error: 'תאריך הסיום חייב להיות אחרי תאריך ההתחלה.' };
  }

  return {
    event: {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      start: startDate.toISOString(),
      end: endDate ? endDate.toISOString() : null,
      description,
      location,
      classNames: [`calendar-event-tone-${tone}`],
      extendedProps: {
        tone,
        source: 'local',
      },
    },
  };
}

function handleCreateLocalEvent(calendar, submitEvent) {
  submitEvent.preventDefault();
  const form = submitEvent.currentTarget;
  const { event, error } = createLocalEventFromForm();

  if (error) {
    setIcalFeedback(error, 'error');
    return;
  }

  localCalendarEvents.push(event);
  saveLocalCalendarState();
  applyCalendarFilter(calendar);
  setIcalFeedback('האירוע המקומי נשמר בהצלחה.', 'success');
  form.reset();
  closeLocalEventModal();
}

function removeEventFromLocalCalendar(calendar) {
  if (!selectedModalEvent) {
    return;
  }

  if (selectedModalEvent.source === 'local') {
    localCalendarEvents = localCalendarEvents.filter((event) => event.id !== selectedModalEvent.id);
  } else if (!hiddenSyncedEventIds.includes(selectedModalEvent.id)) {
    hiddenSyncedEventIds.push(selectedModalEvent.id);
  }

  saveLocalCalendarState();
  applyCalendarFilter(calendar);
  closeEventModal();
}

function setActiveFilterButtonState(filterValue) {
  const buttons = document.querySelectorAll('.calendar-filter-btn');
  buttons.forEach((button) => {
    const isActive = button.getAttribute('data-filter') === filterValue;
    if (isActive) {
      button.classList.remove('bg-slate-100', 'text-slate-700', 'hover:bg-slate-200');
      button.classList.add('bg-brand-50', 'text-brand-700');
      return;
    }

    button.classList.remove('bg-brand-50', 'text-brand-700');
    button.classList.add('bg-slate-100', 'text-slate-700', 'hover:bg-slate-200');
  });
}

function bindCalendarQuickFilters(calendar) {
  const filterBar = document.getElementById('calendar-quick-filters');
  if (!filterBar) {
    return;
  }

  filterBar.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const selectedFilter = target.getAttribute('data-filter');
    if (!selectedFilter || selectedFilter === activeCalendarFilter) {
      return;
    }

    activeCalendarFilter = selectedFilter;
    setActiveFilterButtonState(selectedFilter);
    applyCalendarFilter(calendar);
  });
}

// ===== Calendar Initialization =====
function createCalendarInstance() {
  const calendarEl = document.getElementById('calendar');

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    locale: 'he',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay',
    },
    eventClick: (eventInfo) => {
      eventInfo.jsEvent.preventDefault();
      openEventModal(eventInfo);
    },
    eventDidMount: (info) => {
      const description = info.event.extendedProps?.description;
      if (description) {
        info.el.title = description;
      }
      info.el.classList.add('calendar-event-chip');
    },
    events: [],
  });

  calendar.render();
  return calendar;
}

// ===== Event Synchronization =====
async function loadDefaultCalendarEvents(calendar) {
  setIcalFeedback('טוען אירועים מהיומן הארגוני...', 'info');

  try {
    const response = await apiFetch('/api/calendar/ical', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setIcalFeedback(payload.message || 'שגיאה בטעינת היומן.', 'error');
      return;
    }

    const events = Array.isArray(payload) ? payload : [];
    syncedCalendarEvents = normalizeCalendarEvents(events, 'synced');
    applyCalendarFilter(calendar);
    setIcalFeedback(`עודכן בהצלחה: ${loadedCalendarEvents.length} אירועים נטענו.`, 'success');
  } catch (error) {
    console.error('Calendar sync error:', error);
    applyCalendarFilter(calendar);
    setIcalFeedback('שגיאת תקשורת בסנכרון היומן. מוצגים אירועים מקומיים בלבד.', 'error');
  }
}

// ===== Page Bootstrap =====
function initCalendarPage() {
  requireAuth();

  activeCalendarFilter = getInitialCalendarFilterFromQuery();

  const user = renderUserName('user-name');
  storageUserKey = user?.id || user?.email || user?.fullName || 'anonymous';
  loadLocalCalendarState();
  localCalendarEvents = normalizeCalendarEvents(localCalendarEvents, 'local');

  initThemeToggle(user);
  renderAdminLink(user, 'admin-link-placeholder');
  bindLogout('logout-button');

  const calendar = createCalendarInstance();
  bindCalendarQuickFilters(calendar);
  setActiveFilterButtonState(activeCalendarFilter);
  const closeButton = document.getElementById('calendar-modal-close');
  const cancelButton = document.getElementById('calendar-modal-cancel');
  const deleteButton = document.getElementById('calendar-modal-delete-btn');
  const modalOverlay = document.getElementById('calendar-event-modal');
  const addLocalEventButton = document.getElementById('add-local-event-btn');
  const localModal = document.getElementById('calendar-local-event-modal');
  const localModalClose = document.getElementById('calendar-local-modal-close');
  const localModalCancel = document.getElementById('calendar-local-modal-cancel');
  const localEventForm = document.getElementById('calendar-local-event-form');

  closeButton?.addEventListener('click', closeEventModal);
  cancelButton?.addEventListener('click', closeEventModal);
  deleteButton?.addEventListener('click', () => removeEventFromLocalCalendar(calendar));
  modalOverlay?.addEventListener('click', (event) => {
    if (event.target === modalOverlay) {
      closeEventModal();
    }
  });

  addLocalEventButton?.addEventListener('click', openLocalEventModal);
  localModalClose?.addEventListener('click', closeLocalEventModal);
  localModalCancel?.addEventListener('click', closeLocalEventModal);
  localEventForm?.addEventListener('submit', (event) => handleCreateLocalEvent(calendar, event));
  localModal?.addEventListener('click', (event) => {
    if (event.target === localModal) {
      closeLocalEventModal();
    }
  });

  loadDefaultCalendarEvents(calendar);

  window.setInterval(() => {
    loadDefaultCalendarEvents(calendar);
  }, AUTO_SYNC_INTERVAL_MS);
}

initCalendarPage();
