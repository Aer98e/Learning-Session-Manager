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
    alert('Por favor carga un archivo Word válido (.docx)');
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
      alert(err.message);
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
    span.textContent = `{{${marker}}}`;
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
    alert('Error al conectar con Supabase. Revisa las variables de entorno.');
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

      // Asignar al payload según los marcadores de la plantilla
      if (detectedMarkers.includes(`AREA${num}`)) payload[`AREA${num}`] = areaName;
      if (detectedMarkers.includes(`COMPETENCIA${num}`)) payload[`COMPETENCIA${num}`] = skillName;
      if (detectedMarkers.includes(`ESTANDAR${num}`)) payload[`ESTANDAR${num}`] = sec.selectedStandard;
      if (detectedMarkers.includes(`CAPACIDADES${num}`)) payload[`CAPACIDADES${num}`] = abilitiesString;
      if (detectedMarkers.includes(`DESEMPEÑOS${num}`)) payload[`DESEMPEÑOS${num}`] = performancesString;
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
  } catch (error) {
    console.error('Error al generar el documento:', error);
    alert('Ocurrió un error al procesar y rellenar la plantilla.');
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
