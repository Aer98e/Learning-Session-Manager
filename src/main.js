import { 
  getCycles, 
  getAgesByCycle, 
  getAreas, 
  getSkillsByArea, 
  getAbilitiesBySkill, 
  getStandardBySkillAndCycle, 
  getPerformancesBySkillAndAge 
} from './api/queries.js';
import { extractMarkers, generateDocument } from './utils/docxParser.js';
import { supabase } from './api/supabase.js';

// Estado global de la aplicación
let templateBuffer = null;
let detectedMarkers = [];
let availableAreas = [];

// Elementos del DOM
const dropZone = document.getElementById('dropZone');
const templateFileInput = document.getElementById('templateFileInput');
const fileInfo = document.getElementById('fileInfo');
const markerPreviewContainer = document.getElementById('markerPreviewContainer');
const markersList = document.getElementById('markersList');
const formSection = document.getElementById('formSection');
const generateDocBtn = document.getElementById('generateDocBtn');
const themeToggleBtn = document.getElementById('themeToggle');

// Elementos de Autenticación
const authSection = document.getElementById('authSection');
const appMain = document.getElementById('appMain');
const userProfile = document.getElementById('userProfile');
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

const sessionDateInput = document.getElementById('sessionDate');
const cycleSelect = document.getElementById('cycleSelect');
const ageSelect = document.getElementById('ageSelect');

// Configuración de los bloques de competencias
const sections = {
  1: {
    block: document.getElementById('section1'),
    areaSelect: document.getElementById('areaSelect1'),
    skillSelect: document.getElementById('skillSelect1'),
    standardPreview: document.getElementById('standardPreview1'),
    standardText: document.getElementById('standardText1'),
    abilitiesPreview: document.getElementById('abilitiesPreview1'),
    abilitiesList: document.getElementById('abilitiesList1'),
    performancesList: document.getElementById('performancesList1'),
    selectedAbilities: [],
    selectedStandard: ''
  },
  2: {
    block: document.getElementById('section2'),
    areaSelect: document.getElementById('areaSelect2'),
    skillSelect: document.getElementById('skillSelect2'),
    standardPreview: document.getElementById('standardPreview2'),
    standardText: document.getElementById('standardText2'),
    abilitiesPreview: document.getElementById('abilitiesPreview2'),
    abilitiesList: document.getElementById('abilitiesList2'),
    performancesList: document.getElementById('performancesList2'),
    selectedAbilities: [],
    selectedStandard: ''
  }
};

// --- 1. Inicialización y Carga de Plantilla ---

// Manejar selección de archivos
dropZone.addEventListener('click', () => templateFileInput.click());

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

templateFileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) handleFile(file);
});

function handleFile(file) {
  if (!file.name.toLowerCase().endsWith('.docx')) {
    showToast('Por favor carga un archivo Word válido (.docx)', 'error');
    return;
  }

  fileInfo.textContent = `Archivo cargado: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
  
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      templateBuffer = e.target.result;
      
      // Extraer marcadores
      detectedMarkers = extractMarkers(templateBuffer);
      renderMarkersPreview(detectedMarkers);

      // Activar Formulario (Paso 2)
      formSection.classList.remove('disabled');

      // Cargar ciclos iniciales y áreas
      await loadInitialFormData();
      
      // Ajustar visibilidad de Sección 2 según los marcadores
      toggleSection2ByMarkers(detectedMarkers);
      
      checkFormValidity();
    } catch (err) {
      showToast(err.message, 'error');
      fileInfo.textContent = '';
      templateBuffer = null;
    }
  };
  reader.readAsArrayBuffer(file);
}

function renderMarkersPreview(markers) {
  markerPreviewContainer.classList.remove('hidden');
  markersList.innerHTML = '';
  
  markers.forEach(marker => {
    const span = document.createElement('span');
    span.className = 'marker-tag';
    // Destacar marcadores de área y competencia
    if (marker.startsWith('AREA') || marker.startsWith('COMPETENCIA') || marker.startsWith('DESEMPEÑOS')) {
      span.classList.add('primary-marker');
    }
    span.textContent = `{${marker}}`;
    markersList.appendChild(span);
  });
}

function toggleSection2ByMarkers(markers) {
  // Si en los marcadores del Word se encuentra alguna variable del bloque 2 (ej. AREA2, COMPETENCIA2 o DESEMPEÑOS2), habilitamos la sección 2
  const hasSection2 = markers.some(m => m.endsWith('2'));
  
  if (hasSection2) {
    sections[2].block.classList.remove('hidden');
    // Hacemos requeridos los campos de la sección 2
    sections[2].areaSelect.required = true;
    sections[2].skillSelect.required = true;
  } else {
    sections[2].block.classList.add('hidden');
    sections[2].areaSelect.required = false;
    sections[2].skillSelect.required = false;
    // Limpiar campos por si acaso
    sections[2].areaSelect.value = '';
    resetSection(2);
  }
}

// --- 2. Carga y Filtros del Formulario ---

async function loadInitialFormData() {
  try {
    // 1. Cargar ciclos
    const cycles = await getCycles();
    cycleSelect.innerHTML = '<option value="">Selecciona un ciclo...</option>';
    cycles.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      cycleSelect.appendChild(opt);
    });

    // 2. Cargar áreas
    availableAreas = await getAreas();
    populateAreasSelects();
  } catch (error) {
    console.error('Error al inicializar el formulario:', error);
    showToast('Error al conectar con Supabase. Revisa las variables de entorno.', 'error');
  }
}

function populateAreasSelects() {
  [1, 2].forEach(num => {
    const select = sections[num].areaSelect;
    select.innerHTML = '<option value="">Selecciona el área...</option>';
    availableAreas.forEach(a => {
      const opt = document.createElement('option');
      opt.value = a.id;
      opt.textContent = a.name;
      select.appendChild(opt);
    });
  });
}

// Escuchar cambios en el Ciclo
cycleSelect.addEventListener('change', async (e) => {
  const cycleId = e.target.value;
  ageSelect.value = '';
  ageSelect.disabled = !cycleId;
  
  // Resetear filtros dependientes
  resetSection(1);
  resetSection(2);

  if (cycleId) {
    try {
      const ages = await getAgesByCycle(cycleId);
      ageSelect.innerHTML = '<option value="">Selecciona la edad...</option>';
      ages.forEach(a => {
        const opt = document.createElement('option');
        opt.value = a.id;
        opt.textContent = a.name;
        ageSelect.appendChild(opt);
      });
    } catch (error) {
      console.error(error);
    }
  } else {
    ageSelect.innerHTML = '<option value="">Selecciona la edad...</option>';
  }
  checkFormValidity();
});

// Escuchar cambios en la Edad
ageSelect.addEventListener('change', () => {
  // Si cambia la edad, debemos actualizar los desempeños ya cargados para cada sección
  [1, 2].forEach(num => {
    if (sections[num].skillSelect.value) {
      loadPerformances(num, sections[num].skillSelect.value, ageSelect.value);
    }
  });
  checkFormValidity();
});

// Registrar eventos para los selectores de Área y Competencia en cada sección
[1, 2].forEach(num => {
  const sec = sections[num];
  
  // Cambio de Área
  sec.areaSelect.addEventListener('change', async (e) => {
    const areaId = e.target.value;
    resetSection(num);

    if (areaId) {
      try {
        const skills = await getSkillsByArea(areaId);
        sec.skillSelect.innerHTML = '<option value="">Selecciona la competencia...</option>';
        skills.forEach(s => {
          const opt = document.createElement('option');
          opt.value = s.id;
          opt.textContent = s.name;
          sec.skillSelect.appendChild(opt);
        });
        sec.skillSelect.disabled = false;
      } catch (error) {
        console.error(error);
      }
    }
    checkFormValidity();
  });

  // Cambio de Competencia
  sec.skillSelect.addEventListener('change', async (e) => {
    const skillId = e.target.value;
    const cycleId = cycleSelect.value;
    const ageId = ageSelect.value;

    if (!skillId) {
      resetSection(num);
      checkFormValidity();
      return;
    }

    try {
      // 1. Obtener Estándar (Opción B: desde tabla standards)
      const standard = await getStandardBySkillAndCycle(skillId, cycleId);
      sec.selectedStandard = standard;
      sec.standardText.textContent = standard || 'No hay estándar registrado para este ciclo.';
      sec.standardPreview.classList.remove('hidden');

      // 2. Obtener Capacidades (Abilities)
      const abilities = await getAbilitiesBySkill(skillId);
      sec.selectedAbilities = abilities.map(a => a.name);
      sec.abilitiesList.innerHTML = '';
      abilities.forEach(a => {
        const li = document.createElement('li');
        li.textContent = a.name;
        sec.abilitiesList.appendChild(li);
      });
      sec.abilitiesPreview.classList.remove('hidden');

      // 3. Cargar desempeños si la edad está seleccionada
      if (ageId) {
        await loadPerformances(num, skillId, ageId);
      } else {
        sec.performancesList.innerHTML = '<p class="placeholder-text">Por favor selecciona la edad arriba para cargar los desempeños.</p>';
        sec.performancesList.classList.add('disabled-list');
      }
    } catch (error) {
      console.error(error);
    }
    checkFormValidity();
  });
});

// Limpia los datos de una sección
function resetSection(num) {
  const sec = sections[num];
  sec.skillSelect.innerHTML = '<option value="">Selecciona la competencia...</option>';
  sec.skillSelect.disabled = true;
  sec.standardPreview.classList.add('hidden');
  sec.standardText.textContent = '';
  sec.abilitiesPreview.classList.add('hidden');
  sec.abilitiesList.innerHTML = '';
  sec.performancesList.innerHTML = '<p class="placeholder-text">Selecciona una competencia y edad para ver los desempeños.</p>';
  sec.performancesList.classList.add('disabled-list');
  sec.selectedAbilities = [];
  sec.selectedStandard = '';
}

// Carga los desempeños en la UI
async function loadPerformances(num, skillId, ageId) {
  const sec = sections[num];
  try {
    const perfs = await getPerformancesBySkillAndAge(skillId, ageId);
    sec.performancesList.innerHTML = '';
    
    if (perfs.length === 0) {
      sec.performancesList.innerHTML = '<p class="placeholder-text">No hay desempeños registrados para esta edad.</p>';
      sec.performancesList.classList.add('disabled-list');
      return;
    }

    sec.performancesList.classList.remove('disabled-list');
    
    perfs.forEach(p => {
      const item = document.createElement('div');
      item.className = 'perf-item';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `perf_${num}_${p.id}`;
      checkbox.value = p.description;
      checkbox.addEventListener('change', checkFormValidity);

      const label = document.createElement('label');
      label.htmlFor = `perf_${num}_${p.id}`;
      label.textContent = p.description;

      item.appendChild(checkbox);
      item.appendChild(label);
      sec.performancesList.appendChild(item);
    });
  } catch (error) {
    console.error(error);
  }
}

// --- 3. Validación y Generación de Documento ---

sessionDateInput.addEventListener('input', checkFormValidity);

function checkFormValidity() {
  let isValid = true;

  // Validar plantilla cargada
  if (!templateBuffer) isValid = false;

  // Validar fecha, ciclo y edad
  if (!sessionDateInput.value) isValid = false;
  if (!cycleSelect.value) isValid = false;
  if (!ageSelect.value) isValid = false;

  // Validar Sección 1
  if (!sections[1].areaSelect.value) isValid = false;
  if (!sections[1].skillSelect.value) isValid = false;
  
  // Validar que al menos un desempeño esté marcado en la Sección 1
  const sec1Checked = sections[1].performancesList.querySelectorAll('input[type="checkbox"]:checked');
  if (sec1Checked.length === 0) isValid = false;

  // Validar Sección 2 si está visible en la plantilla
  const isSec2Visible = !sections[2].block.classList.contains('hidden');
  if (isSec2Visible) {
    if (!sections[2].areaSelect.value) isValid = false;
    if (!sections[2].skillSelect.value) isValid = false;
    
    const sec2Checked = sections[2].performancesList.querySelectorAll('input[type="checkbox"]:checked');
    if (sec2Checked.length === 0) isValid = false;
  }

  generateDocBtn.disabled = !isValid;
}

// Generación final del archivo
generateDocBtn.addEventListener('click', async () => {
  if (generateDocBtn.disabled) return;

  try {
    generateDocBtn.disabled = true;
    generateDocBtn.textContent = '⏳ Generando documento...';

    // Obtener datos generales
    const formattedDate = formatDate(sessionDateInput.value);
    const ageName = ageSelect.options[ageSelect.selectedIndex].textContent;

    // Crear el payload con los marcadores
    const payload = {};

    // Inyectar FECHA y EDAD
    if (detectedMarkers.includes('FECHA')) payload['FECHA'] = formattedDate;
    if (detectedMarkers.includes('EDAD')) payload['EDAD'] = ageName;

    // Inyectar datos por cada sección
    [1, 2].forEach(num => {
      const sec = sections[num];
      const areaName = sec.areaSelect.options[sec.areaSelect.selectedIndex]?.textContent || '';
      const skillName = sec.skillSelect.options[sec.skillSelect.selectedIndex]?.textContent || '';
      
      // Formatear capacidades como lista con viñetas
      const abilitiesString = sec.selectedAbilities
        .map(a => `• ${a}`)
        .join('\n');

      // Formatear desempeños seleccionados como lista con viñetas
      const checkedBoxes = sec.performancesList.querySelectorAll('input[type="checkbox"]:checked');
      const performancesString = Array.from(checkedBoxes)
        .map(cb => `• ${cb.value}`)
        .join('\n');

      // Asignar al payload según los marcadores de la plantilla (soporta con o sin sufijo 1)
      if (num === 1) {
        if (detectedMarkers.includes('AREA')) payload['AREA'] = areaName;
        if (detectedMarkers.includes('AREA1')) payload['AREA1'] = areaName;
        if (detectedMarkers.includes('COMPETENCIA')) payload['COMPETENCIA'] = skillName;
        if (detectedMarkers.includes('COMPETENCIA1')) payload['COMPETENCIA1'] = skillName;
        if (detectedMarkers.includes('ESTANDAR')) payload['ESTANDAR'] = sec.selectedStandard;
        if (detectedMarkers.includes('ESTANDAR1')) payload['ESTANDAR1'] = sec.selectedStandard;
        if (detectedMarkers.includes('CAPACIDADES')) payload['CAPACIDADES'] = abilitiesString;
        if (detectedMarkers.includes('CAPACIDADES1')) payload['CAPACIDADES1'] = abilitiesString;
        if (detectedMarkers.includes('DESEMPEÑOS')) payload['DESEMPEÑOS'] = performancesString;
        if (detectedMarkers.includes('DESEMPEÑOS1')) payload['DESEMPEÑOS1'] = performancesString;
      } else {
        if (detectedMarkers.includes(`AREA${num}`)) payload[`AREA${num}`] = areaName;
        if (detectedMarkers.includes(`COMPETENCIA${num}`)) payload[`COMPETENCIA${num}`] = skillName;
        if (detectedMarkers.includes(`ESTANDAR${num}`)) payload[`ESTANDAR${num}`] = sec.selectedStandard;
        if (detectedMarkers.includes(`CAPACIDADES${num}`)) payload[`CAPACIDADES${num}`] = abilitiesString;
        if (detectedMarkers.includes(`DESEMPEÑOS${num}`)) payload[`DESEMPEÑOS${num}`] = performancesString;
      }
    });

    // Generar archivo
    const outputBlob = generateDocument(templateBuffer, payload);

    // Descargar en navegador
    const downloadUrl = URL.createObjectURL(outputBlob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `Sesion_de_Aprendizaje_${sessionDateInput.value}.docx`;
    document.body.appendChild(a);
    a.click();
    
    // Limpieza
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
    
    console.log('¡Documento generado exitosamente!');
    clearForm();
  } catch (error) {
    console.error('Error al generar el documento:', error);
    showToast('Ocurrió un error al procesar y rellenar la plantilla.', 'error');
  } finally {
    generateDocBtn.textContent = '⚡ Generar y Descargar Documento';
    checkFormValidity();
  }
});

// Utilidad para formatear fecha a Español
function formatDate(dateString) {
  const parts = dateString.split('-');
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return date.toLocaleDateString('es-ES', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

// Limpiar el formulario pero mantener la plantilla en memoria
function clearForm() {
  sessionDateInput.value = '';
  cycleSelect.value = '';
  ageSelect.value = '';
  ageSelect.disabled = true;

  [1, 2].forEach(num => {
    const sec = sections[num];
    sec.areaSelect.value = '';
    sec.skillSelect.value = '';
    sec.skillSelect.disabled = true;
    sec.selectedAbilities = [];
    sec.selectedStandard = '';
    sec.selectedPerformances = [];
    
    // Esconder vistas de previsualización
    document.getElementById(`standardPreview${num}`).classList.add('hidden');
    document.getElementById(`standardText${num}`).textContent = '';
    document.getElementById(`abilitiesPreview${num}`).classList.add('hidden');
    document.getElementById(`abilitiesList${num}`).innerHTML = '';
    
    // Resetear lista de desempeños
    sec.performancesList.innerHTML = '<p class="placeholder-text">Selecciona una competencia y edad para ver los desempeños.</p>';
    sec.performancesList.classList.add('disabled-list');
  });

  checkFormValidity();
}

// --- Lógica del Tema (Oscuro / Claro) ---
const themeToggleIcon = themeToggleBtn.querySelector('.theme-toggle-icon');

// Cargar preferencia local guardada
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

// Cargar el tema desde Supabase
async function loadUserTheme(userId) {
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

// --- Gestión de Pestañas de Autenticación ---
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

    // Supabase puede requerir confirmación por email
    if (data.session) {
      showToast('¡Registro exitoso!', 'success');
    } else {
      showToast('¡Cuenta creada! Por favor revisa tu correo electrónico para verificar tu cuenta.', 'info');
      // Limpiar campos e ir a pestaña de login
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
    // Limpiar caché o estado local si es necesario
    clearForm();
    if (templateBuffer) {
      // Limpiar plantilla cargada para seguridad
      templateBuffer = null;
      fileInfo.textContent = '';
      markerPreviewContainer.classList.add('hidden');
      formSection.classList.add('disabled');
    }
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

// --- Notificaciones Flotantes Estéticas (Toasts) ---
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = '✨';
  if (type === 'error') {
    icon = '❌';
  } else if (type === 'info') {
    icon = 'ℹ️';
  }

  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-message">${message}</span>
  `;

  container.appendChild(toast);

  // Forzar reflow para animación
  toast.offsetHeight;
  toast.classList.add('show');

  // Remover después de 4 segundos
  setTimeout(() => {
    toast.classList.remove('show');
    
    // Función auxiliar para remover del DOM de forma segura
    const removeToast = () => {
      toast.removeEventListener('transitionend', removeToast);
      toast.remove();
    };
    
    toast.addEventListener('transitionend', removeToast);
    
    // Backup por si la animación no dispara transitionend
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 500);
  }, 4000);
}
