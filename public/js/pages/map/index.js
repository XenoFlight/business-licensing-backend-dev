import { requireAuth, renderUserName } from '../../core/auth.js';
import { apiFetch } from '../../core/api.js';
import { bindLogout, renderAdminLink } from '../../core/nav.js';

// ===== Business Map Page =====
// Displays businesses with saved coordinates on an interactive map.

let map;

// ===== Map Initialization =====
function initMap() {
  const defaultCenter = [31.6, 34.8];
  map = L.map('map').setView(defaultCenter, 11);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
}

// ===== Marker Helpers =====
function markerLinkForBusiness(business) {
  if (business.id) {
    return `business-details.html?id=${encodeURIComponent(business.id)}`;
  }

  return `business-details.html?name=${encodeURIComponent(business.businessName || '')}`;
}

function addMarkerForBusiness(business) {
  if (!map || !business.latitude || !business.longitude) {
    return;
  }

  const marker = L.marker([business.latitude, business.longitude]).addTo(map);
  const addressDisplay = business.address || business.businessArea || business.street || '-';
  const detailsLink = markerLinkForBusiness(business);

  marker.bindPopup(`<strong>${business.businessName || 'ללא שם'}</strong><br>${addressDisplay}<br><a href="${detailsLink}">פרטים</a>`);
}

// ===== Data Load =====
async function fetchBusinesses() {
  const response = await apiFetch('/api/businesses');

  if (!response.ok) {
    throw new Error('Failed to fetch businesses');
  }

  const businesses = await response.json();
  if (!Array.isArray(businesses)) {
    return;
  }

  businesses.forEach((business) => addMarkerForBusiness(business));
}

// ===== Page Bootstrap =====
async function initPage() {
  requireAuth();

  const user = renderUserName('user-name');
  renderAdminLink(user, 'admin-link-placeholder');
  bindLogout('logout-button');

  initMap();

  try {
    await fetchBusinesses();
  } catch (error) {
    console.error('Map error:', error);
  }
}

initPage();
