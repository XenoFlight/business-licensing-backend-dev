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

function renderAllUsersEmptyState() {
  const tbody = document.querySelector('#all-users-table tbody');
  if (!tbody) {
    return;
  }

  tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-8 text-center text-slate-500">לא נמצאו משתמשים.</td></tr>';
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

function removeAllUsersRow(userId) {
  const row = document.getElementById(`all-user-row-${userId}`);
  if (row) {
    row.remove();
  }

  const tbody = document.querySelector('#all-users-table tbody');
  if (tbody && tbody.children.length === 0) {
    renderAllUsersEmptyState();
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

async function deleteUser(userId, button) {
  if (!confirm('האם אתה בטוח שברצונך למחוק את המשתמש מהמערכת?')) {
    return;
  }

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = '...';

  try {
    const response = await apiFetch(`/api/admin/users/${userId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'שגיאה במחיקת המשתמש');
    }

    alert('המשתמש נמחק בהצלחה.');
    removeUserRow(userId);
    removeAllUsersRow(userId);
  } catch (error) {
    console.error('Error deleting user:', error);
    alert(`שגיאה: ${error.message}`);
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function setUserActiveState(userId, nextActiveState, button) {
  const promptText = nextActiveState
    ? 'האם אתה בטוח שברצונך להפעיל את המשתמש?'
    : 'האם אתה בטוח שברצונך להשבית את המשתמש?';

  if (!confirm(promptText)) {
    return;
  }

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = '...';

  try {
    const response = await apiFetch(`/api/admin/users/${userId}/active`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isActive: nextActiveState }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'שגיאה בעדכון סטטוס המשתמש');
    }

    alert(nextActiveState ? 'המשתמש הופעל בהצלחה.' : 'המשתמש הושבת בהצלחה.');
    await fetchAllUsers();
  } catch (error) {
    console.error('Error updating user active state:', error);
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

  const allUsersTable = document.getElementById('all-users-table');
  if (!allUsersTable) {
    return;
  }

  allUsersTable.addEventListener('click', (event) => {
    const toggleActiveButton = event.target.closest('[data-action="toggle-active"]');
    if (toggleActiveButton) {
      const userId = toggleActiveButton.getAttribute('data-user-id');
      const nextActiveState = toggleActiveButton.getAttribute('data-next-active') === 'true';
      setUserActiveState(userId, nextActiveState, toggleActiveButton);
      return;
    }

    const deleteButton = event.target.closest('[data-action="delete-user"]');
    if (!deleteButton) {
      return;
    }

    const userId = deleteButton.getAttribute('data-user-id');
    deleteUser(userId, deleteButton);
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

function getApprovalLabel(isApproved) {
  return isApproved ? 'מאושר' : 'ממתין לאישור';
}

function getActiveLabel(isActive) {
  return isActive ? 'פעיל' : 'לא פעיל';
}

async function fetchAllUsers() {
  const tbody = document.querySelector('#all-users-table tbody');
  if (!tbody) {
    return;
  }

  try {
    const response = await apiFetch('/api/admin/users');

    if (!response.ok) {
      throw new Error('שגיאה בטעינת המשתמשים');
    }

    const users = await response.json();
    tbody.innerHTML = '';

    if (!Array.isArray(users) || users.length === 0) {
      renderAllUsersEmptyState();
      return;
    }

    const currentUser = getCurrentUser();
    const currentUserId = Number(currentUser?.id);

    users.forEach((systemUser) => {
      const row = document.createElement('tr');
      row.className = 'hover:bg-slate-50 transition-colors';
      row.id = `all-user-row-${systemUser.id}`;

      const isSelf = currentUserId === Number(systemUser.id);
      const toggleActionLabel = systemUser.isActive ? 'השבת משתמש' : 'הפעל משתמש';
      const nextActiveState = systemUser.isActive ? 'false' : 'true';
      const toggleActionClass = systemUser.isActive
        ? 'bg-amber-500 text-white hover:bg-amber-600'
        : 'bg-emerald-600 text-white hover:bg-emerald-700';

      row.innerHTML = `
        <td class="px-6 py-4 font-medium text-slate-900">${systemUser.fullName}</td>
        <td class="px-6 py-4 text-slate-600">${systemUser.email}</td>
        <td class="px-6 py-4 text-slate-600">${systemUser.role}</td>
        <td class="px-6 py-4 text-slate-600">${getApprovalLabel(systemUser.isApproved)}</td>
        <td class="px-6 py-4 text-slate-600">${getActiveLabel(systemUser.isActive)}</td>
        <td class="px-6 py-4 text-slate-600">${new Date(systemUser.createdAt).toLocaleDateString('he-IL')}</td>
        <td class="px-6 py-4 flex gap-2">
          ${isSelf
            ? '<span class="text-xs text-slate-400">המשתמש הנוכחי</span>'
            : `
              <button class="${toggleActionClass} px-3 py-1.5 rounded text-xs transition-colors" data-action="toggle-active" data-user-id="${systemUser.id}" data-next-active="${nextActiveState}">${toggleActionLabel}</button>
              <button class="bg-red-500 text-white px-3 py-1.5 rounded text-xs hover:bg-red-600 transition-colors" data-action="delete-user" data-user-id="${systemUser.id}">מחק משתמש</button>
            `}
        </td>
      `;

      tbody.appendChild(row);
    });
  } catch (error) {
    console.error('Error fetching all users:', error);
    tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-8 text-center text-red-500">שגיאה בטעינת כל המשתמשים.</td></tr>';
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
  fetchAllUsers();
}

initPage();
