import { supabase } from '../api/supabase.js';

let themeToggleBtn = null;
let themeToggleIcon = null;

export function initTheme() {
  themeToggleBtn = document.getElementById('themeToggle');
  themeToggleIcon = themeToggleBtn.querySelector('.theme-toggle-icon');

  // Cargar preferencia local guardada o usar oscuro por defecto
  const savedTheme = localStorage.getItem('theme') || 'dark';
  if (savedTheme === 'light') {
    document.body.classList.add('light-theme');
    themeToggleIcon.textContent = '🌙';
  } else {
    themeToggleIcon.textContent = '☀️';
  }

  themeToggleBtn.addEventListener('click', async () => {
    document.body.classList.toggle('light-theme');
    const isLight = document.body.classList.contains('light-theme');
    const theme = isLight ? 'light' : 'dark';
    localStorage.setItem('theme', theme);
    themeToggleIcon.textContent = isLight ? '🌙' : '☀️';

    // Si el usuario está autenticado, guardar su preferencia en la base de datos
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      try {
        await supabase
          .from('user_preferences')
          .update({ theme })
          .eq('id', session.user.id);
      } catch (err) {
        console.error('Error al guardar preferencia de tema en base de datos:', err);
      }
    }
  });
}

// Cargar el tema desde Supabase
export async function loadUserTheme(userId) {
  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('theme')
      .eq('id', userId)
      .single();
    if (data && data.theme) {
      const isLight = data.theme === 'light';
      if (isLight) {
        document.body.classList.add('light-theme');
        themeToggleIcon.textContent = '🌙';
        localStorage.setItem('theme', 'light');
      } else {
        document.body.classList.remove('light-theme');
        themeToggleIcon.textContent = '☀️';
        localStorage.setItem('theme', 'dark');
      }
    }
  } catch (err) {
    console.warn('No se pudieron cargar las preferencias del usuario de Supabase:', err);
  }
}
