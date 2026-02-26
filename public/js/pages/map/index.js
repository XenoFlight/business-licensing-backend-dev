import { requireAuth, renderUserName } from '../../core/auth.js';
import { apiFetch } from '../../core/api.js';
import { bindLogout, renderAdminLink } from '../../core/nav.js';
import { initThemeToggle } from '../../core/theme.js';

// ===== Business Map Page =====
// Displays businesses with saved coordinates on an interactive map.

let map;
let markerLayer;
let allBusinesses = [];

// ===== Map Initialization =====
function initMap() {
  const defaultCenter = [31.6, 34.8];
  map = L.map('map').setView(defaultCenter, 11);
  markerLayer = L.layerGroup().addTo(map);

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

  const marker = L.marker([business.latitude, business.longitude]).addTo(markerLayer);
  const addressDisplay = business.address || business.businessArea || business.street || '-';
  const detailsLink = markerLinkForBusiness(business);

  marker.bindPopup(`<strong>${business.businessName || 'ללא שם'}</strong><br>${addressDisplay}<br><a href="${detailsLink}">פרטים</a>`);
}

function getBusinessAreaLabel(business) {
  return String(business.businessArea || business.address || 'ללא אזור').trim();
}

function getBusinessesWithCoordinates(sourceBusinesses) {
  return sourceBusinesses.filter((business) => {
    const lat = Number(business.latitude);
    const lng = Number(business.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng);
  });
}

function fitMapToBusinesses(businesses) {
  if (!map || businesses.length === 0) {
    return;
  }

  const bounds = L.latLngBounds(businesses.map((business) => [business.latitude, business.longitude]));
  map.fitBounds(bounds.pad(0.08));
}

function updateMapCountLabel(filteredBusinesses, totalBusinesses) {
  const countElement = document.getElementById('map-count');
  if (!countElement) {
    return;
  }

  countElement.textContent = `מציג ${filteredBusinesses.length} מתוך ${totalBusinesses} עסקים עם מיקום`;
}

function renderMarkersByArea(areaValue = '') {
  if (!markerLayer) {
    return;
  }

  markerLayer.clearLayers();

  const withCoordinates = getBusinessesWithCoordinates(allBusinesses);
  const normalizedArea = String(areaValue || '').trim();
  const filtered = normalizedArea
    ? withCoordinates.filter((business) => getBusinessAreaLabel(business) === normalizedArea)
    : withCoordinates;

  filtered.forEach((business) => addMarkerForBusiness(business));
  fitMapToBusinesses(filtered);
  updateMapCountLabel(filtered, withCoordinates.length);
}

function populateAreaFilter(businesses) {
  const areaFilter = document.getElementById('area-filter');
  if (!areaFilter) {
    return;
  }

  const uniqueAreas = Array.from(new Set(businesses.map((business) => getBusinessAreaLabel(business)))).sort((a, b) => a.localeCompare(b, 'he'));
  uniqueAreas.forEach((area) => {
    const option = document.createElement('option');
    option.value = area;
    option.textContent = area;
    areaFilter.appendChild(option);
  });

  areaFilter.addEventListener('change', (event) => {
    renderMarkersByArea(event.target.value);
  });
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

  allBusinesses = businesses;
  populateAreaFilter(getBusinessesWithCoordinates(allBusinesses));
  renderMarkersByArea('');
}

// ===== Page Bootstrap =====
async function initPage() {
  requireAuth();

  const user = renderUserName('user-name');
  initThemeToggle(user);
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
