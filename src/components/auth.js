import { supabase } from '../api/supabase.js';
import { showToast } from './toast.js';
import { loadUserTheme } from './theme.js';

export function initAuth() {
  const authSection = document.getElementById('authSection');
  const userProfile = document.getElementById('userProfile');
  const appMain = document.getElementById('appMain');

  // 1. Inyectar HTML dinámico
  userProfile.innerHTML = `
    <span class="user-avatar" id="userAvatar">U</span>
    <span class="user-name" id="userName">Cargando...</span>
    <button id="logoutBtn" class="logout-btn" title="Cerrar Sesión">
      <span class="logout-icon">🚪</span>
    </button>
  `;

  authSection.innerHTML = `
    <div class="auth-header">
      <h2>Únete a SesiónBuilder</h2>
      <p>Crea sesiones de aprendizaje automatizadas en minutos</p>
    </div>

    <div class="auth-tabs">
      <button class="auth-tab active" id="tabLogin">Iniciar Sesión</button>
      <button class="auth-tab" id="tabRegister">Registrarse</button>
    </div>

    <!-- Formulario Login -->
    <form id="loginForm" class="auth-form">
      <div class="form-group">
        <label for="loginEmail">Correo Electrónico</label>
        <input type="email" id="loginEmail" placeholder="correo@ejemplo.com" required>
      </div>
      <div class="form-group">
        <label for="loginPassword">Contraseña</label>
        <input type="password" id="loginPassword" placeholder="••••••••" required>
      </div>
      <button type="submit" class="auth-submit-btn">Ingresar</button>
    </form>

    <!-- Formulario Registro -->
    <form id="registerForm" class="auth-form hidden">
      <div class="form-group">
        <label for="registerName">Nombre Completo</label>
        <input type="text" id="registerName" placeholder="Ej. Prof. María Pérez" required>
      </div>
      <div class="form-group">
        <label for="registerEmail">Correo Electrónico</label>
        <input type="email" id="registerEmail" placeholder="correo@ejemplo.com" required>
      </div>
      <div class="form-group">
        <label for="registerPassword">Contraseña</label>
        <input type="password" id="registerPassword" placeholder="Mínimo 6 caracteres" required minlength="6">
      </div>
      <button type="submit" class="auth-submit-btn">Crear Cuenta</button>
    </form>

    <div class="auth-divider">
      <span>o continuar con</span>
    </div>

    <!-- Botón OAuth Visual -->
    <button id="googleAuthBtn" class="oauth-btn" type="button">
      <svg class="google-icon" viewBox="0 0 24 24" width="18" height="18">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      Google (Integración futura)
    </button>
  `;

  // 2. Obtener referencias del DOM inyectado
  const userAvatar = document.getElementById('userAvatar');
  const userName = document.getElementById('userName');
  const logoutBtn = document.getElementById('logoutBtn');

  const loginForm = document.getElementById('loginForm');
  const loginEmail = document.getElementById('loginEmail');
  const loginPassword = document.getElementById('loginPassword');

  const registerForm = document.getElementById('registerForm');
  const registerName = document.getElementById('registerName');
  const registerEmail = document.getElementById('registerEmail');
  const registerPassword = document.getElementById('registerPassword');

  const tabLogin = document.getElementById('tabLogin');
  const tabRegister = document.getElementById('tabRegister');

  // --- Gestión de Pestañas ---
  tabLogin.addEventListener('click', () => {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
  });

  tabRegister.addEventListener('click', () => {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    registerForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
  });

  // --- Manejo de Inicio de Sesión ---
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = loginEmail.value.trim();
    const password = loginPassword.value;

    const submitBtn = loginForm.querySelector('.auth-submit-btn');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Ingresando...';

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;
      showToast('¡Ingreso exitoso!', 'success');
    } catch (err) {
      console.error('Error de login:', err);
      showToast(`Error de ingreso: ${err.message || err.error_description || 'Verifica tus credenciales'}`, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });

  // --- Manejo de Registro ---
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = registerName.value.trim();
    const email = registerEmail.value.trim();
    const password = registerPassword.value;

    const submitBtn = registerForm.querySelector('.auth-submit-btn');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Registrando...';

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name
          }
        }
      });

      if (error) throw error;

      if (data.session) {
        showToast('¡Registro exitoso!', 'success');
      } else {
        showToast('¡Cuenta creada! Por favor revisa tu correo electrónico para verificar tu cuenta.', 'info');
        registerForm.reset();
        tabLogin.click();
      }
    } catch (err) {
      console.error('Error de registro:', err);
      showToast(`Error de registro: ${err.message || err.error_description || 'Ocurrió un problema'}`, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });

  // --- Manejo de Cierre de Sesión ---
  logoutBtn.addEventListener('click', async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // Notificar a otros componentes que limpien su estado
      document.dispatchEvent(new CustomEvent('app:logout'));
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
      showToast('Error al cerrar sesión.', 'error');
    }
  });

  // --- Escucha de Estado de Autenticación ---
  supabase.auth.onAuthStateChange(async (event, session) => {
    console.log('Evento de Autenticación Supabase:', event);
    
    if (session) {
      const user = session.user;
      const email = user.email;
      const name = user.user_metadata?.name || user.user_metadata?.full_name || email;
      
      // Rellenar widget de perfil
      userName.textContent = name;
      userAvatar.textContent = name.charAt(0).toUpperCase();
      userProfile.classList.remove('hidden');
      
      // Mostrar app main y ocultar portal de acceso
      appMain.classList.remove('hidden');
      authSection.classList.add('hidden');
      
      // Cargar preferencia de tema de la base de datos
      await loadUserTheme(user.id);

      // NOTIFICACIÓN: Informar a otros componentes que el usuario ingresó con éxito
      document.dispatchEvent(new CustomEvent('app:login', { detail: { user } }));
    } else {
      // Limpiar UI de perfil
      userName.textContent = '';
      userAvatar.textContent = '';
      userProfile.classList.add('hidden');
      
      // Ocultar app main y mostrar portal de acceso
      appMain.classList.add('hidden');
      authSection.classList.remove('hidden');
    }
  });
}
