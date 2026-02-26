import { requireAuth, renderUserName } from '../../core/auth.js';
import { apiFetch } from '../../core/api.js';
import { bindLogout, renderAdminLink } from '../../core/nav.js';
import { getStatusLabel, isActiveStatus, normalizeStatus } from '../../core/status.js';
import { initThemeToggle } from '../../core/theme.js';

let businessStatusChartInstance;
let reportStatusChartInstance;
let lastBusinesses = [];
let lastReports = [];

function isDarkThemeActive() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

function getChartLegendColor() {
  return isDarkThemeActive() ? '#cbd5e1' : '#334155';
}

function getStorageUserKey(user) {
  return user?.id || user?.email || user?.fullName || 'anonymous';
}

function readLocalCalendarEvents(user) {
  const key = `calendar:local-events:${getStorageUserKey(user)}`;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Failed reading local calendar events', error);
    return [];
  }
}

function isInspectionEvent(event) {
  const haystack = `${event.title || ''} ${event.description || ''}`.toLowerCase();
  return /ביקורת|inspection|redo|reinspection|חוזרת/.test(haystack);
}

function countUpcomingByRange(events) {
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;

  let within7Days = 0;
  let within30Days = 0;

  events.forEach((event) => {
    const startDate = event?.start ? new Date(event.start) : null;
    if (!startDate || Number.isNaN(startDate.getTime())) {
      return;
    }

    const diffMs = startDate.getTime() - now.getTime();
    if (diffMs < 0) {
      return;
    }

    const diffDays = diffMs / dayMs;
    if (diffDays <= 7) {
      within7Days += 1;
    }

    if (diffDays <= 30) {
      within30Days += 1;
    }
  });

  return { within7Days, within30Days };
}

function renderUpcomingCounts({ within7Days, within30Days }) {
  const chip = document.getElementById('upcoming-counts-chip');
  if (!chip) {
    return;
  }

  chip.textContent = `${within7Days} / ${within30Days}`;
}

async function loadUpcomingCounts(user) {
  const localEvents = readLocalCalendarEvents(user).filter(isInspectionEvent);
  let syncedEvents = [];

  try {
    const response = await apiFetch('/api/calendar/ical', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (response.ok) {
      const payload = await response.json().catch(() => []);
      syncedEvents = (Array.isArray(payload) ? payload : []).filter(isInspectionEvent);
    }
  } catch (error) {
    console.warn('Failed to load synced upcoming events for dashboard', error);
  }

  const counts = countUpcomingByRange([...localEvents, ...syncedEvents]);
  renderUpcomingCounts(counts);
}

// ===== KPI Rendering =====
function updateKpiCards(businesses, reports) {
  const totalBusinessesElement = document.getElementById('total-businesses');
  const activeBusinessesElement = document.getElementById('active-businesses');
  const pendingBusinessesElement = document.getElementById('pending-businesses');
  const shortLicenseBusinessesElement = document.getElementById('short-license-businesses');
  const renewingBusinessesElement = document.getElementById('renewing-businesses');
  const deniedBusinessesElement = document.getElementById('denied-businesses');
  const totalReportsElement = document.getElementById('total-reports');
  const reportPassRateElement = document.getElementById('report-pass-rate');
  const mappedBusinessesElement = document.getElementById('mapped-businesses');

  const nonClosedBusinesses = businesses.filter((business) => normalizeStatus(business.status) !== 'closed');
  totalBusinessesElement.textContent = nonClosedBusinesses.length;

  const activeCount = businesses.filter((business) => isActiveStatus(business.status)).length;
  activeBusinessesElement.textContent = activeCount;

  const shortLicenseCount = businesses.filter((business) => normalizeStatus(business.status) === 'temporarily_permitted').length;
  const renewingCount = businesses.filter((business) => normalizeStatus(business.status) === 'renewal_in_progress').length;
  const deniedCount = businesses.filter((business) => normalizeStatus(business.status) === 'rejected').length;
  const pendingCount = shortLicenseCount + renewingCount + deniedCount;
  pendingBusinessesElement.textContent = pendingCount;

  if (shortLicenseBusinessesElement) {
    shortLicenseBusinessesElement.textContent = shortLicenseCount;
  }

  if (renewingBusinessesElement) {
    renewingBusinessesElement.textContent = renewingCount;
  }

  if (deniedBusinessesElement) {
    deniedBusinessesElement.textContent = deniedCount;
  }

  totalReportsElement.textContent = reports.length;

  const passCount = reports.filter((report) => report.status === 'pass').length;
  const passRate = reports.length ? Math.round((passCount / reports.length) * 100) : 0;
  reportPassRateElement.textContent = `${passRate}%`;

  const mappedCount = businesses.filter((business) => typeof business.latitude === 'number' && typeof business.longitude === 'number').length;
  mappedBusinessesElement.textContent = mappedCount;
}

// ===== Chart Rendering =====
function createPieChart(canvasId, labels, data, colors, chartInstanceRefSetter) {
  if (typeof Chart === 'undefined') {
    return;
  }

  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    return;
  }

  const existingInstance = canvasId === 'business-status-chart' ? businessStatusChartInstance : reportStatusChartInstance;
  if (existingInstance) {
    existingInstance.destroy();
  }

  const nextInstance = new Chart(canvas, {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            usePointStyle: true,
            boxWidth: 8,
            color: getChartLegendColor(),
            font: {
              family: 'Arial',
            },
          },
        },
      },
    },
  });

  chartInstanceRefSetter(nextInstance);
}

function renderBusinessStatusChart(businesses) {
  const distribution = new Map();

  businesses.forEach((business) => {
    const normalizedStatus = normalizeStatus(business.status) || 'application_submitted';
    if (normalizedStatus === 'closed') {
      return;
    }

    distribution.set(normalizedStatus, (distribution.get(normalizedStatus) || 0) + 1);
  });

  const statusOrder = [
    'temporarily_permitted',
    'renewal_in_progress',
    'rejected',
    'application_submitted',
    'pending_review',
    'approved',
  ];

  const statusColors = {
    temporarily_permitted: '#0ea5e9',
    renewal_in_progress: '#f59e0b',
    rejected: '#ef4444',
    application_submitted: '#64748b',
    pending_review: '#7c3aed',
    approved: '#10b981',
  };

  const orderedStatuses = statusOrder.filter((statusCode) => (distribution.get(statusCode) || 0) > 0);
  const adHocStatuses = Array.from(distribution.keys()).filter((statusCode) => !statusOrder.includes(statusCode));
  const statusesForChart = [...orderedStatuses, ...adHocStatuses];

  const labels = statusesForChart.map((statusCode) => getStatusLabel(statusCode));
  const values = statusesForChart.map((statusCode) => distribution.get(statusCode) || 0);
  const colors = statusesForChart.map((statusCode) => statusColors[statusCode] || '#0f766e');

  createPieChart(
    'business-status-chart',
    labels,
    values,
    colors,
    (instance) => { businessStatusChartInstance = instance; },
  );
}

function renderReportsStatusChart(reports) {
  const statusMap = {
    pass: { label: 'עבר', color: '#10b981' },
    fail: { label: 'נכשל', color: '#ef4444' },
    conditional_pass: { label: 'עבר בתנאי', color: '#f59e0b' },
  };

  const counters = {
    pass: 0,
    fail: 0,
    conditional_pass: 0,
  };

  reports.forEach((report) => {
    if (Object.prototype.hasOwnProperty.call(counters, report.status)) {
      counters[report.status] += 1;
    }
  });

  const nonZeroStatuses = Object.entries(counters).filter(([, value]) => value > 0);
  const labels = nonZeroStatuses.map(([status]) => statusMap[status].label);
  const values = nonZeroStatuses.map(([, value]) => value);
  const colors = nonZeroStatuses.map(([status]) => statusMap[status].color);

  createPieChart(
    'reports-status-chart',
    labels,
    values,
    colors,
    (instance) => { reportStatusChartInstance = instance; },
  );
}

// ===== Dashboard Data Load =====
async function fetchDashboardData() {
  try {
    const [businessesResponse, reportsResponse] = await Promise.all([
      apiFetch('/api/businesses'),
      apiFetch('/api/reports'),
    ]);

    if (!businessesResponse.ok) {
      throw new Error('Failed to fetch businesses');
    }

    const businessesPayload = await businessesResponse.json();
    const businesses = Array.isArray(businessesPayload) ? businessesPayload : [];

    const reports = reportsResponse.ok
      ? await reportsResponse.json().then((payload) => (Array.isArray(payload) ? payload : []))
      : [];

    lastBusinesses = businesses;
    lastReports = reports;

    updateKpiCards(businesses, reports);
    renderBusinessStatusChart(businesses);
    renderReportsStatusChart(reports);
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    document.getElementById('total-businesses').textContent = '—';
    document.getElementById('active-businesses').textContent = '—';
    document.getElementById('pending-businesses').textContent = '—';
    const shortLicenseBusinessesElement = document.getElementById('short-license-businesses');
    const renewingBusinessesElement = document.getElementById('renewing-businesses');
    const deniedBusinessesElement = document.getElementById('denied-businesses');

    if (shortLicenseBusinessesElement) {
      shortLicenseBusinessesElement.textContent = '—';
    }

    if (renewingBusinessesElement) {
      renewingBusinessesElement.textContent = '—';
    }

    if (deniedBusinessesElement) {
      deniedBusinessesElement.textContent = '—';
    }

    document.getElementById('total-reports').textContent = '—';
    document.getElementById('report-pass-rate').textContent = '—';
    document.getElementById('mapped-businesses').textContent = '—';
  }
}

function rerenderChartsForTheme() {
  if (!lastBusinesses.length && !lastReports.length) {
    return;
  }

  renderBusinessStatusChart(lastBusinesses);
  renderReportsStatusChart(lastReports);
}

// ===== Page Bootstrap =====
function initDashboard() {
  requireAuth();

  const user = renderUserName('user-name');
  initThemeToggle(user);
  renderAdminLink(user, 'admin-link-placeholder');
  bindLogout('logout-button');

  fetchDashboardData();
  loadUpcomingCounts(user);

  const themeToggleButton = document.getElementById('theme-toggle-button');
  themeToggleButton?.addEventListener('click', () => {
    window.setTimeout(rerenderChartsForTheme, 0);
  });
}

initDashboard();
