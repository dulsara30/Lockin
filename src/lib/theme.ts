export type ThemeMode = 'dark' | 'light' | 'system';

export function applyTheme(theme: ThemeMode) {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem('lockin-theme', theme);
  } catch {
    // localStorage might be unavailable in restricted iframes
  }

  const isLight =
    theme === 'light' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches);

  if (isLight) {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
  } else {
    document.documentElement.classList.remove('light');
    document.documentElement.classList.add('dark');
  }
}
