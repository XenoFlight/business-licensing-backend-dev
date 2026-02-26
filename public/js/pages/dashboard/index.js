import { requireAuth, renderUserName } from '../../core/auth.js';
import { apiFetch } from '../../core/api.js';
import { bindLogout, renderAdminLink } from '../../core/nav.js';
import { getStatusLabel, isActiveStatus, isPendingStatus, normalizeStatus } from '../../core/status.js';
import { initThemeToggle } from '../../core/theme.js';

let businessStatusChartInstance;
let reportStatusChartInstance;

// ===== KPI Rendering =====
function updateKpiCards(businesses, reports) {
  const totalBusinessesElement = document.getElementById('total-businesses');
  const activeBusinessesElement = document.getElementById('active-businesses');
  const pendingBusinessesElement = document.getElementById('pending-businesses');
  const totalReportsElement = document.getElementById('total-reports');
  const reportPassRateElement = document.getElementById('report-pass-rate');
  const mappedBusinessesElement = document.getElementById('mapped-businesses');

  const nonClosedBusinesses = businesses.filter((business) => normalizeStatus(business.status) !== 'closed');
  totalBusinessesElement.textContent = nonClosedBusinesses.length;

  const activeCount = businesses.filter((business) => isActiveStatus(business.status)).length;
  activeBusinessesElement.textContent = activeCount;

  const pendingCount = businesses.filter((business) => isPendingStatus(business.status)).length;
  pendingBusinessesElement.textContent = pendingCount;

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
            color: '#334155',
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

  const labels = Array.from(distribution.keys()).map((statusCode) => getStatusLabel(statusCode));
  const values = Array.from(distribution.values());

  createPieChart(
    'business-status-chart',
    labels,
    values,
    ['#0284c7', '#10b981', '#f59e0b', '#ef4444', '#64748b', '#7c3aed', '#0f766e'],
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

    updateKpiCards(businesses, reports);
    renderBusinessStatusChart(businesses);
    renderReportsStatusChart(reports);
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    document.getElementById('total-businesses').textContent = '—';
    document.getElementById('active-businesses').textContent = '—';
    document.getElementById('pending-businesses').textContent = '—';
    document.getElementById('total-reports').textContent = '—';
    document.getElementById('report-pass-rate').textContent = '—';
    document.getElementById('mapped-businesses').textContent = '—';
  }
}

// ===== Page Bootstrap =====
function initDashboard() {
  requireAuth();

  const user = renderUserName('user-name');
  initThemeToggle(user);
  renderAdminLink(user, 'admin-link-placeholder');
  bindLogout('logout-button');

  fetchDashboardData();
}

initDashboard();
