import { requireAuth, renderUserName } from '../../core/auth.js';
import { apiFetch } from '../../core/api.js';
import { bindLogout, renderAdminLink } from '../../core/nav.js';
import { initThemeToggle } from '../../core/theme.js';

// ===== Calendar Page =====
// Authenticated calendar view backed by ICS feed synchronization.

const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;

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
    calendar.removeAllEvents();
    calendar.addEventSource(events);
    setIcalFeedback(`עודכן בהצלחה: ${events.length} אירועים נטענו.`, 'success');
  } catch (error) {
    console.error('Calendar sync error:', error);
    setIcalFeedback('שגיאת תקשורת בסנכרון היומן. נסה שוב מאוחר יותר.', 'error');
  }
}

// ===== Page Bootstrap =====
function initCalendarPage() {
  requireAuth();

  const user = renderUserName('user-name');
  initThemeToggle(user);
  renderAdminLink(user, 'admin-link-placeholder');
  bindLogout('logout-button');

  const calendar = createCalendarInstance();
  loadDefaultCalendarEvents(calendar);

  window.setInterval(() => {
    loadDefaultCalendarEvents(calendar);
  }, AUTO_SYNC_INTERVAL_MS);
}

initCalendarPage();
