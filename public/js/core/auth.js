// ===== Auth Storage Helpers =====
export function getToken() {
  return localStorage.getItem('token');
}

export function getCurrentUser() {
  const userStr = localStorage.getItem('user');

  if (!userStr) {
    return null;
  }

  try {
    return JSON.parse(userStr);
  } catch (error) {
    console.error('Failed to parse user data from localStorage, logging out.', error);
    logout();
    return null;
  }
}

// ===== Route Guard =====
// Redirects to login when there is no active token.
export function requireAuth() {
  const token = getToken();

  if (!token) {
    window.location.href = 'login.html';
    return null;
  }

  return token;
}

// ===== Session Teardown =====
export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'login.html';
}

// ===== UI Helper =====
// Renders current user name in page header area.
export function renderUserName(elementId = 'user-name') {
  const user = getCurrentUser();
  const target = document.getElementById(elementId);

  if (!target || !user || !user.fullName) {
    return user;
  }

  target.textContent = `שלום, ${user.fullName}`;
  return user;
}
