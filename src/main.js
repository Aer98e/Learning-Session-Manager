import { initTheme } from './components/theme.js';
import { initAuth } from './components/auth.js';
import { initTemplateLoader } from './components/templateLoader.js';
import { initFormManager } from './components/formManager.js';

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initAuth();
  initTemplateLoader();
  initFormManager();
});
