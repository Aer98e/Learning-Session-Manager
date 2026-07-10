import { initTheme } from './components/theme.js';
import { initAuth } from './components/auth.js';
import { initFormManager } from './components/formManager.js';

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initAuth();
  initFormManager();
});
