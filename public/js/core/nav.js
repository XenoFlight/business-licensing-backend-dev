import { logout } from './auth.js';

// ===== Header Admin Link =====
// Renders admin navigation entry only for admin users.
export function renderAdminLink(user, placeholderId = 'admin-link-placeholder') {
  const placeholder = document.getElementById(placeholderId);

  if (!placeholder || !user || user.role !== 'admin') {
    return;
  }

  const adminLink = document.createElement('a');
  adminLink.href = 'admin-dashboard.html';
  adminLink.innerHTML = '<i class="fa-solid fa-user-shield"></i> פאנל ניהול';
  adminLink.className = 'px-3 py-2 rounded-lg text-sm font-medium text-purple-600 hover:bg-purple-50 transition-colors flex items-center gap-2';
  placeholder.appendChild(adminLink);
}

// ===== Header Logout Binding =====
export function bindLogout(buttonId = 'logout-button') {
  const logoutButton = document.getElementById(buttonId);

  if (!logoutButton) {
    return;
  }

  logoutButton.addEventListener('click', logout);
}
