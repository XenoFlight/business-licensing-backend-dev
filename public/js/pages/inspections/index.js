import { requireAuth, renderUserName } from '../../core/auth.js';
import { bindLogout, renderAdminLink } from '../../core/nav.js';
import { initThemeToggle } from '../../core/theme.js';

// ===== Inspections Hub Page =====
// Central menu for inspection actions.

function initPage() {
  requireAuth();

  const user = renderUserName('user-name');
  initThemeToggle(user);
  renderAdminLink(user, 'admin-link-placeholder');
  bindLogout('logout-button');
}

initPage();
