import { getCurrentUser, requireAuth, renderUserName } from '../../core/auth.js';
import { apiFetch } from '../../core/api.js';
import { bindLogout } from '../../core/nav.js';
import { initThemeToggle } from '../../core/theme.js';

// ===== Admin Approvals Page =====
// Handles pending user approvals and denials for admin users.

// ===== Table State Helpers =====
function renderEmptyState() {
  const tbody = document.querySelector('#pending-users-table tbody');
  if (!tbody) {
    return;
  }

  tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-slate-500">אין משתמשים הממתינים לאישור.</td></tr>';
}

function removeUserRow(userId) {
  const row = document.getElementById(`user-row-${userId}`);
  if (row) {
    row.remove();
  }

  const tbody = document.querySelector('#pending-users-table tbody');
  if (tbody && tbody.children.length === 0) {
    renderEmptyState();
  }
}

// ===== Approval Actions =====
async function approveUser(userId, button) {
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = 'מאשר...';

  try {
    const response = await apiFetch(`/api/admin/approve/${userId}`, {
      method: 'PUT',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'שגיאה באישור המשתמש');
    }

    alert('המשתמש אושר בהצלחה!');
    removeUserRow(userId);
  } catch (error) {
    console.error('Error approving user:', error);
    alert(`שגיאה: ${error.message}`);
    button.disabled = false;
    button.textContent = originalText;
  }
}

// ===== Denial Actions =====
async function denyUser(userId, button) {
  if (!confirm('האם אתה בטוח שברצונך לדחות ולמחוק את המשתמש?')) {
    return;
  }

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = '...';

  try {
    const response = await apiFetch(`/api/admin/deny/${userId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'שגיאה בדחיית המשתמש');
    }

    alert('המשתמש נדחה ונמחק בהצלחה.');
    removeUserRow(userId);
  } catch (error) {
    console.error('Error denying user:', error);
    alert(`שגיאה: ${error.message}`);
    button.disabled = false;
    button.textContent = originalText;
  }
}

// ===== Event Delegation =====
function bindTableActions() {
  const table = document.getElementById('pending-users-table');
  if (!table) {
    return;
  }

  table.addEventListener('click', (event) => {
    const approveButton = event.target.closest('[data-action="approve"]');
    if (approveButton) {
      const userId = approveButton.getAttribute('data-user-id');
      approveUser(userId, approveButton);
      return;
    }

    const denyButton = event.target.closest('[data-action="deny"]');
    if (denyButton) {
      const userId = denyButton.getAttribute('data-user-id');
      denyUser(userId, denyButton);
    }
  });
}

// ===== Data Load =====
async function fetchPendingUsers() {
  const tbody = document.querySelector('#pending-users-table tbody');

  try {
    const response = await apiFetch('/api/admin/pending-users');

    if (!response.ok) {
      throw new Error('שגיאה בטעינת המשתמשים');
    }

    const users = await response.json();
    tbody.innerHTML = '';

    if (!Array.isArray(users) || users.length === 0) {
      renderEmptyState();
      return;
    }

    users.forEach((pendingUser) => {
      const row = document.createElement('tr');
      row.className = 'hover:bg-slate-50 transition-colors';
      row.id = `user-row-${pendingUser.id}`;
      row.innerHTML = `
        <td class="px-6 py-4 font-medium text-slate-900">${pendingUser.fullName}</td>
        <td class="px-6 py-4 text-slate-600">${pendingUser.email}</td>
        <td class="px-6 py-4 text-slate-600">${pendingUser.role}</td>
        <td class="px-6 py-4 text-slate-600">${new Date(pendingUser.createdAt).toLocaleDateString('he-IL')}</td>
        <td class="px-6 py-4 flex gap-2">
          <button class="bg-green-600 text-white px-3 py-1.5 rounded text-xs hover:bg-green-700 transition-colors" data-action="approve" data-user-id="${pendingUser.id}">אשר משתמש</button>
          <button class="bg-red-500 text-white px-3 py-1.5 rounded text-xs hover:bg-red-600 transition-colors" data-action="deny" data-user-id="${pendingUser.id}">דחה</button>
        </td>
      `;

      tbody.appendChild(row);
    });
  } catch (error) {
    console.error('Error fetching pending users:', error);
    tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-red-500">שגיאה בטעינת המשתמשים.</td></tr>';
  }
}

// ===== Page Bootstrap =====
function initPage() {
  requireAuth();

  const user = getCurrentUser();
  if (!user || user.role !== 'admin') {
    alert('אין לך הרשאת גישה לדף זה.');
    window.location.href = 'dashboard.html';
    return;
  }

  renderUserName('user-name');
  initThemeToggle(user);
  bindLogout('logout-button');
  bindTableActions();
  fetchPendingUsers();
}

initPage();
