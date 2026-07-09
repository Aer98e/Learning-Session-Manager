import { 
  getCycles, 
  getAgesByCycle, 
  getAreas, 
  getSkillsByArea, 
  getAbilitiesBySkill, 
  getStandardBySkillAndCycle, 
  getPerformancesBySkillAndAge 
} from '../api/queries.js';
import { generateDocument } from '../utils/docxParser.js';
import { state } from '../utils/state.js';
import { showToast } from './toast.js';

// Elementos del DOM
let sessionForm = null;
let sessionDateInput = null;
let cycleSelect = null;
let ageSelect = null;
let generateDocBtn = null;

let sections = {};

export function initFormManager() {
  sessionForm = document.getElementById('sessionForm');
  sessionDateInput = document.getElementById('sessionDate');
  cycleSelect = document.getElementById('cycleSelect');
  ageSelect = document.getElementById('ageSelect');
  generateDocBtn = document.getElementById('generateDocBtn');

  // Configuración de los bloques de competencias
  sections = {
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

  // --- Registrar Eventos ---

  // Escuchar cuando la plantilla es cargada
  document.addEventListener('app:template-loaded', async () => {
    toggleSection2ByMarkers(state.detectedMarkers);
    await loadInitialFormData();
  });

  // Escuchar cuando el usuario cierra sesión
  document.addEventListener('app:logout', () => {
    clearForm();
  });

  // Cambios generales de fecha
  sessionDateInput.addEventListener('change', () => checkFormValidity());

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
        console.error('Error al cargar edades:', error);
        showToast('Error al cargar las edades del ciclo.', 'error');
      }
    } else {
      ageSelect.innerHTML = '<option value="">Selecciona la edad...</option>';
    }
    checkFormValidity();
  });

  // Escuchar cambios en la Edad
  ageSelect.addEventListener('change', () => {
    // Al cambiar la edad, se deben recargar los desempeños si ya hay competencia seleccionada
    [1, 2].forEach(num => {
      const skillId = sections[num].skillSelect.value;
      if (skillId) {
        loadPerformances(num, skillId, ageSelect.value);
      }
    });
    checkFormValidity();
  });

  // Configurar listeners de áreas y competencias por bloque (1 y 2)
  [1, 2].forEach(num => {
    const sec = sections[num];
    
    // Cambio de Área
    sec.areaSelect.addEventListener('change', async (e) => {
      const areaId = e.target.value;
      resetSection(num);
      
      sec.skillSelect.disabled = !areaId;
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
        } catch (error) {
          console.error('Error al cargar competencias:', error);
          showToast('Error al cargar las competencias del área.', 'error');
        }
      }
      checkFormValidity();
    });

    // Cambio de Competencia
    sec.skillSelect.addEventListener('change', async (e) => {
      const skillId = e.target.value;
      const cycleId = cycleSelect.value;
      const ageId = ageSelect.value;
      
      // Limpiar datos previos del bloque
      sec.selectedAbilities = [];
      sec.selectedStandard = '';
      sec.standardPreview.classList.add('hidden');
      sec.standardText.textContent = '';
      sec.abilitiesPreview.classList.add('hidden');
      sec.abilitiesList.innerHTML = '';
      sec.performancesList.innerHTML = '<p class="placeholder-text">Cargando desempeños...</p>';
      sec.performancesList.classList.add('disabled-list');

      if (skillId) {
        try {
          // 1. Obtener Estándar de Aprendizaje
          const standardDescription = await getStandardBySkillAndCycle(skillId, cycleId);
          if (standardDescription) {
            sec.selectedStandard = standardDescription;
            sec.standardText.textContent = standardDescription;
            sec.standardPreview.classList.remove('hidden');
          }

          // 2. Obtener Capacidades
          const abilities = await getAbilitiesBySkill(skillId);
          if (abilities && abilities.length > 0) {
            sec.selectedAbilities = abilities.map(a => a.name);
            sec.abilitiesList.innerHTML = '';
            abilities.forEach(a => {
              const li = document.createElement('li');
              li.textContent = a.name;
              sec.abilitiesList.appendChild(li);
            });
            sec.abilitiesPreview.classList.remove('hidden');
          }

          // 3. Obtener Desempeños según edad seleccionada
          if (ageId) {
            await loadPerformances(num, skillId, ageId);
          } else {
            sec.performancesList.innerHTML = '<p class="placeholder-text">Selecciona una edad para ver los desempeños.</p>';
          }

        } catch (error) {
          console.error('Error al cargar detalles de la competencia:', error);
          showToast('Error al cargar los detalles de la competencia.', 'error');
          sec.performancesList.innerHTML = '<p class="placeholder-text">Error al cargar datos.</p>';
        }
      } else {
        sec.performancesList.innerHTML = '<p class="placeholder-text">Selecciona una competencia y edad para ver los desempeños.</p>';
      }
      checkFormValidity();
    });
  });

  // Procesar envío del formulario para generar Word
  sessionForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!checkFormValidity()) return;

    generateDocBtn.disabled = true;
    generateDocBtn.textContent = '⏳ Procesando plantilla y generando archivo...';

    setTimeout(() => {
      try {
        const formattedDate = formatDate(sessionDateInput.value);
        const ageName = ageSelect.options[ageSelect.selectedIndex].textContent;
        const payload = {};

        // Inyectar FECHA y EDAD
        if (state.detectedMarkers.includes('FECHA')) payload['FECHA'] = formattedDate;
        if (state.detectedMarkers.includes('EDAD')) payload['EDAD'] = ageName;

        // Inyectar datos de secciones
        [1, 2].forEach(num => {
          const sec = sections[num];
          const areaName = sec.areaSelect.options[sec.areaSelect.selectedIndex]?.textContent || '';
          const skillName = sec.skillSelect.options[sec.skillSelect.selectedIndex]?.textContent || '';
          
          const abilitiesString = sec.selectedAbilities
            .map(a => `• ${a}`)
            .join('\n');

          const checkedBoxes = sec.performancesList.querySelectorAll('input[type="checkbox"]:checked');
          const performancesString = Array.from(checkedBoxes)
            .map(cb => `• ${cb.value}`)
            .join('\n');

          if (num === 1) {
            if (state.detectedMarkers.includes('AREA')) payload['AREA'] = areaName;
            if (state.detectedMarkers.includes('AREA1')) payload['AREA1'] = areaName;
            if (state.detectedMarkers.includes('COMPETENCIA')) payload['COMPETENCIA'] = skillName;
            if (state.detectedMarkers.includes('COMPETENCIA1')) payload['COMPETENCIA1'] = skillName;
            if (state.detectedMarkers.includes('ESTANDAR')) payload['ESTANDAR'] = sec.selectedStandard;
            if (state.detectedMarkers.includes('ESTANDAR1')) payload['ESTANDAR1'] = sec.selectedStandard;
            if (state.detectedMarkers.includes('CAPACIDADES')) payload['CAPACIDADES'] = abilitiesString;
            if (state.detectedMarkers.includes('CAPACIDADES1')) payload['CAPACIDADES1'] = abilitiesString;
            if (state.detectedMarkers.includes('DESEMPEÑOS')) payload['DESEMPEÑOS'] = performancesString;
            if (state.detectedMarkers.includes('DESEMPEÑOS1')) payload['DESEMPEÑOS1'] = performancesString;
          } else {
            if (state.detectedMarkers.includes(`AREA${num}`)) payload[`AREA${num}`] = areaName;
            if (state.detectedMarkers.includes(`COMPETENCIA${num}`)) payload[`COMPETENCIA${num}`] = skillName;
            if (state.detectedMarkers.includes(`ESTANDAR${num}`)) payload[`ESTANDAR${num}`] = sec.selectedStandard;
            if (state.detectedMarkers.includes(`CAPACIDADES${num}`)) payload[`CAPACIDADES${num}`] = abilitiesString;
            if (state.detectedMarkers.includes(`DESEMPEÑOS${num}`)) payload[`DESEMPEÑOS${num}`] = performancesString;
          }
        });

        // Generar archivo
        const outputBlob = generateDocument(state.templateBuffer, payload);

        // Descargar en navegador
        const downloadUrl = URL.createObjectURL(outputBlob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `Sesion_de_Aprendizaje_${sessionDateInput.value}.docx`;
        document.body.appendChild(a);
        a.click();
        
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
        
        showToast('¡Documento generado exitosamente!', 'success');
        clearForm();
      } catch (error) {
        console.error('Error al generar el documento:', error);
        showToast('Ocurrió un error al procesar y rellenar la plantilla.', 'error');
      } finally {
        generateDocBtn.textContent = '⚡ Generar y Descargar Documento';
        checkFormValidity();
      }
    }, 100);
  });
}

// --- Métodos de Ayuda del Formulario ---

async function loadInitialFormData() {
  try {
    const cycles = await getCycles();
    cycleSelect.innerHTML = '<option value="">Selecciona un ciclo...</option>';
    cycles.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      cycleSelect.appendChild(opt);
    });

    state.availableAreas = await getAreas();
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
    state.availableAreas.forEach(a => {
      const opt = document.createElement('option');
      opt.value = a.id;
      opt.textContent = a.name;
      select.appendChild(opt);
    });
  });
}

function toggleSection2ByMarkers(markers) {
  const hasSection2 = markers.some(m => m.endsWith('2'));
  
  if (hasSection2) {
    sections[2].block.classList.remove('hidden');
    sections[2].areaSelect.required = true;
    sections[2].skillSelect.required = true;
  } else {
    sections[2].block.classList.add('hidden');
    sections[2].areaSelect.required = false;
    sections[2].skillSelect.required = false;
    sections[2].areaSelect.value = '';
    resetSection(2);
  }
}

async function loadPerformances(sectionNum, skillId, ageId) {
  const sec = sections[sectionNum];
  try {
    const performances = await getPerformancesBySkillAndAge(skillId, ageId);
    sec.performancesList.innerHTML = '';
    sec.performancesList.classList.remove('disabled-list');

    if (performances && performances.length > 0) {
      performances.forEach(p => {
        const item = document.createElement('div');
        item.className = 'perf-item';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = p.description;
        cb.id = `perf_${sectionNum}_${p.id}`;

        const lbl = document.createElement('label');
        lbl.setAttribute('for', cb.id);
        lbl.textContent = p.description;

        cb.addEventListener('change', () => checkFormValidity());
        item.addEventListener('click', (e) => {
          if (e.target !== cb && e.target !== lbl) {
            cb.checked = !cb.checked;
            checkFormValidity();
          }
        });

        item.appendChild(cb);
        item.appendChild(lbl);
        sec.performancesList.appendChild(item);
      });
    } else {
      sec.performancesList.innerHTML = '<p class="placeholder-text">No hay desempeños registrados para esta edad.</p>';
    }
  } catch (error) {
    console.error('Error al cargar desempeños:', error);
    showToast('Error al cargar los desempeños correspondientes.', 'error');
  }
}

function resetSection(num) {
  const sec = sections[num];
  if (!sec) return;

  sec.skillSelect.innerHTML = '<option value="">Selecciona la competencia...</option>';
  sec.skillSelect.disabled = true;
  sec.selectedAbilities = [];
  sec.selectedStandard = '';
  
  sec.standardPreview.classList.add('hidden');
  sec.standardText.textContent = '';
  sec.abilitiesPreview.classList.add('hidden');
  sec.abilitiesList.innerHTML = '';
  
  sec.performancesList.innerHTML = '<p class="placeholder-text">Selecciona una competencia y edad para ver los desempeños.</p>';
  sec.performancesList.classList.add('disabled-list');
}

function checkFormValidity() {
  if (!sessionForm) return false;

  const dateOk = !!sessionDateInput.value;
  const cycleOk = !!cycleSelect.value;
  const ageOk = !!ageSelect.value;

  // Validar sección 1
  const s1AreaOk = !!sections[1].areaSelect.value;
  const s1SkillOk = !!sections[1].skillSelect.value;
  const s1Checked = sections[1].performancesList.querySelectorAll('input[type="checkbox"]:checked').length > 0;
  const s1Ok = s1AreaOk && s1SkillOk && s1Checked;

  // Validar sección 2 si está visible
  const isS2Visible = !sections[2].block.classList.contains('hidden');
  let s2Ok = true;
  if (isS2Visible) {
    const s2AreaOk = !!sections[2].areaSelect.value;
    const s2SkillOk = !!sections[2].skillSelect.value;
    const s2Checked = sections[2].performancesList.querySelectorAll('input[type="checkbox"]:checked').length > 0;
    s2Ok = s2AreaOk && s2SkillOk && s2Checked;
  }

  const isValid = dateOk && cycleOk && ageOk && s1Ok && s2Ok && state.templateBuffer !== null;
  generateDocBtn.disabled = !isValid;
  return isValid;
}

function clearForm() {
  if (sessionDateInput) sessionDateInput.value = '';
  if (cycleSelect) cycleSelect.value = '';
  if (ageSelect) {
    ageSelect.value = '';
    ageSelect.disabled = true;
  }

  [1, 2].forEach(num => {
    if (sections[num]) {
      sections[num].areaSelect.value = '';
      resetSection(num);
    }
  });

  checkFormValidity();
}

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
