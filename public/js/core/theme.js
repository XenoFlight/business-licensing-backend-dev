const THEME_LAST_KEY = 'theme:last';
const THEME_USER_PREFIX = 'theme:user:';

function normalizeTheme(theme) {
  return theme === 'dark' ? 'dark' : 'light';
}

function getUserThemeKey(user) {
  if (!user) {
    return null;
  }

  const identifier = user.id || user.email || user.fullName;
  if (!identifier) {
    return null;
  }

  return `${THEME_USER_PREFIX}${identifier}`;
}

export function getThemeForUser(user) {
  const userKey = getUserThemeKey(user);
  if (userKey) {
    const userTheme = localStorage.getItem(userKey);
    if (userTheme) {
      return normalizeTheme(userTheme);
    }
  }

  return normalizeTheme(localStorage.getItem(THEME_LAST_KEY));
}

export function applyTheme(theme) {
  const normalizedTheme = normalizeTheme(theme);
  document.documentElement.setAttribute('data-theme', normalizedTheme);

  if (normalizedTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  localStorage.setItem(THEME_LAST_KEY, normalizedTheme);
  return normalizedTheme;
}

function renderThemeToggleLabel(button, activeTheme) {
  const isDark = activeTheme === 'dark';
  button.innerHTML = isDark
    ? '<i class="fa-solid fa-moon"></i><span>כהה</span>'
    : '<i class="fa-solid fa-sun"></i><span>בהיר</span>';
}

export function initThemeToggle(user, options = {}) {
  const { userNameId = 'user-name' } = options;

  const userNameElement = document.getElementById(userNameId);
  if (!userNameElement || !userNameElement.parentElement) {
    return;
  }

  const activeTheme = applyTheme(getThemeForUser(user));
  const userThemeKey = getUserThemeKey(user);

  let toggleButton = document.getElementById('theme-toggle-button');
  if (!toggleButton) {
    toggleButton = document.createElement('button');
    toggleButton.id = 'theme-toggle-button';
    toggleButton.type = 'button';
    toggleButton.className = 'text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-3 py-2 rounded-lg transition-colors flex items-center gap-2';
    userNameElement.insertAdjacentElement('afterend', toggleButton);

    toggleButton.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
      const appliedTheme = applyTheme(nextTheme);

      if (userThemeKey) {
        localStorage.setItem(userThemeKey, appliedTheme);
      }

      renderThemeToggleLabel(toggleButton, appliedTheme);
    });
  }

  renderThemeToggleLabel(toggleButton, activeTheme);
}
