import { getToken, logout } from './auth.js';

// ===== API Fetch Helper =====
// Injects JWT token when present and handles unauthorized responses globally.
export async function apiFetch(url, options = {}) {
  const token = getToken();
  const headers = {
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    logout();
    throw new Error('Unauthorized');
  }

  return response;
}
