import { requireAuth, renderUserName } from '../../core/auth.js';
import { apiFetch } from '../../core/api.js';
import { bindLogout, renderAdminLink } from '../../core/nav.js';
import { isActiveStatus, isPendingStatus } from '../../core/status.js';

// ===== KPI Rendering =====
function updateKpiCards(businesses) {
  const totalBusinessesElement = document.getElementById('total-businesses');
  const activeBusinessesElement = document.getElementById('active-businesses');
  const pendingBusinessesElement = document.getElementById('pending-businesses');

  totalBusinessesElement.textContent = businesses.length;

  const activeCount = businesses.filter((business) => isActiveStatus(business.status)).length;
  activeBusinessesElement.textContent = activeCount;

  const pendingCount = businesses.filter((business) => isPendingStatus(business.status)).length;
  pendingBusinessesElement.textContent = pendingCount;
}

// ===== Dashboard Data Load =====
async function fetchBusinesses() {
  try {
    const response = await apiFetch('/api/businesses');

    if (!response.ok) {
      throw new Error('Failed to fetch businesses');
    }

    const businesses = await response.json();
    updateKpiCards(Array.isArray(businesses) ? businesses : []);
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    document.getElementById('total-businesses').textContent = '—';
    document.getElementById('active-businesses').textContent = '—';
    document.getElementById('pending-businesses').textContent = '—';
  }
}

// ===== Page Bootstrap =====
function initDashboard() {
  requireAuth();

  const user = renderUserName('user-name');
  renderAdminLink(user, 'admin-link-placeholder');
  bindLogout('logout-button');

  fetchBusinesses();
}

initDashboard();
