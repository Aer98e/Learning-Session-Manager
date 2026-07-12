import { 
  getCycles, 
  getAgesByCycle, 
  getAreas, 
  getSkillsByArea, 
  getAbilitiesBySkill, 
  getStandardBySkillAndCycle, 
  getPerformancesBySkillAndAge,
  getMyMoments,
  getSessions,
  getSessionDetails,
  saveSession,
  deleteSession
} from '../api/queries.js';
import { state } from '../utils/state.js';
import { showToast } from './toast.js';
import { printSessionPDF } from '../utils/pdfGenerator.js';
import { supabase } from '../api/supabase.js';
import { setupTimeline, cardTimelines } from './timelineManager.js';

// Estado Local de la UI
let userId = null;
let currentCycles = [];
let currentAreas = [];
let userMomentsCatalog = []; 
let currentWizardStep = 1;
let userSessionsList = []; // Lista local de sesiones para usar como plantillas

// Elementos del DOM
let appMain = null;
let sessionsListSection = null;
let sessionsGrid = null;
let createNewSessionBtn = null;
let editorSection = null;
let editorTitle = null;
let cancelEditBtn = null;

// Elementos del Modal de Plantillas (v11)
let templateSelectionModal = null;
let btnCancelTemplateModal = null;
let btnCancelTemplateModalActions = null;
let btnConfirmTemplate = null;
let templateSessionSelect = null;
let templateSessionSelectGroup = null;
let sessionForm = null;
let editSessionIdInput = null;
let sessionTitleInput = null;
let sessionDateInput = null;
let cycleSelect = null;
let ageSelect = null;
let componentsContainer = null;
let addComponentBtn = null;
let saveSessionBtn = null;

// Elementos del Wizard
let wizardSteps = null;
let timelineStepContainer = null;
let contentStepContainer = null;
let btnNextToStep2 = null;
let btnNextToStep3 = null;
let btnPrevToStep1 = null;
let btnPrevToStep2 = null;

export function initFormManager() {
  appMain = document.getElementById('appMain');
  sessionsListSection = document.getElementById('sessionsListSection');
  sessionsGrid = document.getElementById('sessionsGrid');
  createNewSessionBtn = document.getElementById('createNewSessionBtn');
  editorSection = document.getElementById('editorSection');
  editorTitle = document.getElementById('editorTitle');
  cancelEditBtn = document.getElementById('cancelEditBtn');
  sessionForm = document.getElementById('sessionForm');
  editSessionIdInput = document.getElementById('editSessionId');
  sessionTitleInput = document.getElementById('sessionTitle');
  sessionDateInput = document.getElementById('sessionDate');
  cycleSelect = document.getElementById('cycleSelect');
  ageSelect = document.getElementById('ageSelect');
  componentsContainer = document.getElementById('componentsContainer');
  addComponentBtn = document.getElementById('addComponentBtn');
  saveSessionBtn = document.getElementById('saveSessionBtn');

  // Inicialización de elementos del Modal de Plantillas (v11)
  templateSelectionModal = document.getElementById('templateSelectionModal');
  btnCancelTemplateModal = document.getElementById('btnCancelTemplateModal');
  btnCancelTemplateModalActions = document.getElementById('btnCancelTemplateModalActions');
  btnConfirmTemplate = document.getElementById('btnConfirmTemplate');
  templateSessionSelect = document.getElementById('templateSessionSelect');
  templateSessionSelectGroup = document.getElementById('templateSessionSelectGroup');

  // Inicialización de elementos del Wizard
  wizardSteps = document.getElementById('wizardSteps');
  timelineStepContainer = document.getElementById('timelineStepContainer');
  contentStepContainer = document.getElementById('contentStepContainer');
  btnNextToStep2 = document.getElementById('btnNextToStep2');
  btnNextToStep3 = document.getElementById('btnNextToStep3');
  btnPrevToStep1 = document.getElementById('btnPrevToStep1');
  btnPrevToStep2 = document.getElementById('btnPrevToStep2');

  // --- Registrar Eventos Generales ---

  document.addEventListener('app:login', async (e) => {
    userId = e.detail?.user?.id;
    if (userId) {
      appMain.classList.remove('hidden');
      await loadInitialData();
      await loadSessionsList();
    }
  });

  document.addEventListener('app:logout', () => {
    userId = null;
    appMain.classList.add('hidden');
    clearForm();
  });

  // Nueva Sesión abre el Modal de Selección de Modo (En Blanco / Plantilla)
  createNewSessionBtn.addEventListener('click', () => {
    openTemplateSelectionModal();
  });

  // Cancelar Modal de Plantillas
  const closeTemplateModal = () => {
    templateSelectionModal.classList.add('hidden-screen');
  };
  btnCancelTemplateModal.addEventListener('click', closeTemplateModal);
  btnCancelTemplateModalActions.addEventListener('click', closeTemplateModal);

  // Alternar visualización del selector de sesiones pasadas según el modo elegido
  templateSelectionModal.querySelectorAll('input[name="startMode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.value === 'template') {
        templateSessionSelectGroup.classList.remove('hidden-screen');
      } else {
        templateSessionSelectGroup.classList.add('hidden-screen');
      }
    });
  });

  // Confirmar Selección de Modal de Plantillas
  btnConfirmTemplate.addEventListener('click', async () => {
    const mode = templateSelectionModal.querySelector('input[name="startMode"]:checked').value;
    if (mode === 'blank') {
      templateSelectionModal.classList.add('hidden-screen');
      openEditor(null);
    } else {
      const templateId = templateSessionSelect.value;
      if (!templateId) {
        showToast('Selecciona una sesión de la lista para usar como plantilla.', 'warning');
        return;
      }
      templateSelectionModal.classList.add('hidden-screen');
      await loadSessionAsTemplate(templateId);
    }
  });;

  cancelEditBtn.addEventListener('click', () => {
    const confirmExit = window.confirm("¿Estás seguro de que deseas regresar a la lista? Se perderán todos los cambios no guardados en esta sesión.");
    if (confirmExit) {
      showSessionsList();
    }
  });

  addComponentBtn.addEventListener('click', () => {
    createComponentCard();
  });
  cycleSelect.addEventListener('change', async (e) => {
    await loadAgesForCycle(e.target.value);
  });

  ageSelect.addEventListener('change', () => {
    const ageId = ageSelect.value;
    const cards = componentsContainer.querySelectorAll('.component-block');
    
    cards.forEach(card => {
      const skillSelect = card.querySelector('.skill-select');
      const blockNum = card.dataset.blockId;
      if (skillSelect && skillSelect.value) {
        loadPerformancesForCard(card, blockNum, skillSelect.value, ageId);
      }
    });
  });

  // --- Lógica del Wizard (Paso a Paso) ---

  // Clic en la barra superior de pasos (solo si son válidos)
  wizardSteps.querySelectorAll('.wizard-step').forEach(stepEl => {
    stepEl.addEventListener('click', () => {
      const step = parseInt(stepEl.dataset.step);
      if (step === currentWizardStep) return;

      if (step > currentWizardStep) {
        // Validar paso por paso si intentamos avanzar
        if (currentWizardStep === 1 && !validateStep1()) return;
        if (currentWizardStep === 2 && !validateStep2()) return;
      }
      setWizardStep(step);
    });
  });

  // Navegación con botones
  btnNextToStep2.addEventListener('click', () => {
    if (validateStep1()) setWizardStep(2);
  });

  btnNextToStep3.addEventListener('click', () => {
    if (validateStep2()) setWizardStep(3);
  });

  btnPrevToStep1.addEventListener('click', () => {
    setWizardStep(1);
  });

  btnPrevToStep2.addEventListener('click', () => {
    setWizardStep(2);
  });

  sessionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (validateStep1() && validateStep2()) {
      await saveCurrentSession();
    }
  });
}

function setWizardStep(stepNumber) {
  currentWizardStep = stepNumber;
  
  // Cambiar barra superior
  wizardSteps.querySelectorAll('.wizard-step').forEach(stepEl => {
    const step = parseInt(stepEl.dataset.step);
    if (step === stepNumber) {
      stepEl.classList.add('active');
    } else {
      stepEl.classList.remove('active');
    }
  });

  // Cambiar visualización de los paneles de pasos
  document.querySelectorAll('.step-pane').forEach(pane => {
    pane.classList.remove('active');
  });
  document.getElementById(`stepPane${stepNumber}`).classList.add('active');
}

// --- Validaciones de Wizard ---

function validateStep1() {
  if (!sessionTitleInput.value.trim()) {
    showToast('El título de la sesión es obligatorio.', 'warning');
    sessionTitleInput.focus();
    return false;
  }
  if (!sessionDateInput.value) {
    showToast('La fecha de ejecución es obligatoria.', 'warning');
    sessionDateInput.focus();
    return false;
  }
  if (!cycleSelect.value) {
    showToast('Selecciona el ciclo curricular.', 'warning');
    cycleSelect.focus();
    return false;
  }
  if (!ageSelect.value) {
    showToast('Selecciona la edad / grado.', 'warning');
    ageSelect.focus();
    return false;
  }

  // Validar que los componentes del Paso 1 tengan Área y Competencia
  const cards = componentsContainer.querySelectorAll('.component-block');
  if (cards.length === 0) {
    showToast('Debes agregar al menos una actividad pedagógica.', 'warning');
    return false;
  }

  let ok = true;
  cards.forEach(card => {
    const area = card.querySelector('.area-select').value;
    const skill = card.querySelector('.skill-select').value;
    const type = card.dataset.type;
    const title = card.querySelector('.comp-title-input')?.value || '';

    if (type === 'taller' && !title.trim()) {
      showToast('Los talleres deben tener un título.', 'warning');
      card.querySelector('.comp-title-input').focus();
      ok = false;
    } else if (!area || !skill) {
      showToast('Selecciona el área y la competencia para todas las actividades.', 'warning');
      ok = false;
    }
  });

  return ok;
}

function validateStep2() {
  // En la v5, el Paso 2 sólo define los momentos y submomentos, lo cual se autogestiona
  return true;
}

// --- Listado de Sesiones ---

async function loadSessionsList() {
  if (!userId) return;
  
  try {
    sessionsGrid.innerHTML = '<p class="placeholder-text">Cargando tus sesiones guardadas...</p>';
    const sessions = await getSessions(userId);
    userSessionsList = sessions || [];
    userMomentsCatalog = await getMyMoments(userId);
    renderSessionCards(sessions);
    populateMomentsDatalist(); // Cargar catálogo predictivo en datalist (v12)
  } catch (error) {
    console.error('Error al cargar sesiones:', error);
    showToast('Error al conectar con la base de datos.', 'error');
  }
}

function renderSessionCards(sessions) {
  sessionsGrid.innerHTML = '';
  
  if (!sessions || sessions.length === 0) {
    sessionsGrid.innerHTML = `
      <div class="placeholder-text" style="grid-column: 1 / -1; padding: 3rem 0;">
        <span style="font-size: 2.5rem; display: block; margin-bottom: 1rem;">📅</span>
        <p>No tienes sesiones guardadas todavía.</p>
        <p style="font-size: 0.85rem; margin-top: 0.25rem;">¡Presiona "Nueva Sesión" para comenzar a planificar!</p>
      </div>
    `;
    return;
  }

  sessions.forEach(session => {
    const card = document.createElement('div');
    card.className = 'session-card';
    
    const formattedDate = new Date(session.session_date).toLocaleDateString('es-ES', { 
      year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' 
    });

    card.innerHTML = `
      <div class="session-card-header">
        <span class="session-card-date">${formattedDate}</span>
        <h3 class="session-card-title">${session.title}</h3>
      </div>
      <div class="session-card-actions">
        <button class="action-btn edit" data-id="${session.id}">✏️ Editar</button>
        <button class="action-btn pdf" data-id="${session.id}">📄 Imprimir PDF</button>
        <button class="action-btn delete" data-id="${session.id}">🗑️ Borrar</button>
      </div>
    `;

    card.querySelector('.edit').addEventListener('click', () => editSession(session.id));
    card.querySelector('.pdf').addEventListener('click', () => printSession(session.id));
    card.querySelector('.delete').addEventListener('click', () => confirmDeleteSession(session.id, session.title));

    sessionsGrid.appendChild(card);
  });
}

function showSessionsList() {
  editorSection.classList.add('hidden');
  sessionsListSection.classList.remove('hidden');
}

function showEditor() {
  sessionsListSection.classList.add('hidden');
  editorSection.classList.remove('hidden');
}

async function loadInitialData() {
  try {
    currentCycles = await getCycles();
    cycleSelect.innerHTML = '<option value="">Selecciona un ciclo...</option>';
    currentCycles.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      cycleSelect.appendChild(opt);
    });

    currentAreas = await getAreas();
  } catch (error) {
    console.error('Error al inicializar datos:', error);
    showToast('Error al conectar con Supabase. Verifica tu conexión.', 'error');
  }
}

function openEditor(sessionData = null) {
  clearForm();
  showEditor();
  setWizardStep(1);

  if (sessionData) {
    editorTitle.textContent = 'Editar Sesión de Aprendizaje';
    editSessionIdInput.value = sessionData.id;
    sessionTitleInput.value = sessionData.title;
    sessionDateInput.value = sessionData.session_date;
  } else {
    editorTitle.textContent = 'Crear Nueva Sesión de Aprendizaje';
    createComponentCard({ type: 'principal', title: '' });
  }
}

function clearForm() {
  editSessionIdInput.value = '';
  sessionTitleInput.value = '';
  sessionDateInput.value = '';
  cycleSelect.value = '';
  ageSelect.value = '';
  ageSelect.disabled = true;
  ageSelect.innerHTML = '<option value="">Selecciona la edad...</option>';
  componentsContainer.innerHTML = '';
  timelineStepContainer.innerHTML = '';
  contentStepContainer.innerHTML = '';
  
for (const key in cardTimelines) {
    delete cardTimelines[key];
  }
}

// --- Creación Dinámica de Componentes por Pasos del Wizard ---

let blockCounter = 0;

function createComponentCard(compData = null) {
  blockCounter++;
  const blockId = `block_${blockCounter}`;

  // 1. INYECTAR EN PASO 1 (PROPOSITOS CURRICULARES)
  const curricularCard = document.createElement('div');
  const initialType = compData?.type || (blockCounter === 1 ? 'principal' : 'taller');
  curricularCard.className = `component-block ${initialType === 'taller' ? 'taller' : ''}`;
  curricularCard.id = `curricular_${blockId}`;
  curricularCard.dataset.blockId = blockId;
  curricularCard.dataset.type = initialType;

  curricularCard.innerHTML = `
    <div class="component-header">
      <h4>
        <span class="comp-icon">${initialType === 'taller' ? '🎨' : '📖'}</span>
        <select class="comp-type-select" style="margin-left: 0.5rem; padding: 0.35rem 0.6rem; font-size: 0.85rem; font-weight: 700; border-radius: 6px; background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); color: var(--color-text-main);">
          <option value="principal" ${initialType === 'principal' ? 'selected' : ''}>📖 Actividad Principal</option>
          <option value="taller" ${initialType === 'taller' ? 'selected' : ''}>🎨 Taller / Actividad Secundaria</option>
        </select>
      </h4>
      <button type="button" class="remove-comp-btn">Eliminar Actividad</button>
    </div>

    <div class="form-group component-title-group ${initialType === 'taller' ? '' : 'hidden'}">
      <label>Título de la Actividad / Taller</label>
      <input type="text" class="comp-title-input" placeholder="Ej. Jugamos a ser indiecitos" value="${compData?.title || ''}">
    </div>

    <div class="curricular-settings">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.75rem;">
        <h5 class="form-subtitle" style="font-size: 1rem; margin: 0;">Propósito de Aprendizaje</h5>
        <button type="button" class="add-bullet-btn clear-purpose-btn" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; background: rgba(255,255,255,0.03);">🧹 Limpiar Propósito</button>
      </div>
      
      <div class="form-grid">
        <div class="form-group">
          <label>Área Curricular</label>
          <select class="area-select">
            <option value="">Selecciona el área...</option>
          </select>
        </div>

        <div class="form-group">
          <label>Competencia</label>
          <select class="skill-select" disabled>
            <option value="">Selecciona la competencia...</option>
          </select>
        </div>
      </div>

      <div class="preview-box standard-preview hidden">
        <strong>Estándar de Aprendizaje:</strong>
        <p class="preview-text standard-text"></p>
      </div>

      <div class="preview-box abilities-preview hidden">
        <strong>Capacidades:</strong>
        <ul class="preview-list abilities-list"></ul>
      </div>

      <div class="form-group">
        <label>Desempeños a Evaluar</label>
        <div class="performances-list disabled-list">
          <p class="placeholder-text">Selecciona una competencia y edad para ver los desempeños.</p>
        </div>
      </div>
    </div>
  `;

  // Poblar selectores de áreas
  const areaSelect = curricularCard.querySelector('.area-select');
  currentAreas.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.id;
    opt.textContent = a.name;
    areaSelect.appendChild(opt);
  });

  // 2. INYECTAR EN PASO 2 (HORARIOS Y MOMENTOS - TIMELINE)
  const timelineCard = document.createElement('div');
  timelineCard.className = `timeline-component-card`;
  timelineCard.id = `timeline_${blockId}`;

  // 3. INYECTAR EN PASO 3 (CONTENIDO PEDAGÓGICO - DETALLES)
  const contentCard = document.createElement('div');
  contentCard.className = `content-component-card`;
  contentCard.id = `content_${blockId}`;

  // Eliminar componente
  const removeBtn = curricularCard.querySelector('.remove-comp-btn');
  removeBtn.addEventListener('click', () => {
    const totalComps = componentsContainer.querySelectorAll('.component-block').length;
    if (totalComps > 1) {
      const confirmDel = window.confirm('¿Estás seguro de que deseas eliminar este componente de la sesión? Se borrarán sus propósitos y horarios.');
      if (confirmDel) {
        curricularCard.remove();
        timelineCard.remove();
        contentCard.remove();
        delete cardTimelines[blockId];
        showToast('Actividad eliminada.', 'success');
      }
    } else {
      showToast('Debe haber al menos una actividad o taller en la sesión.', 'warning');
    }
  });

  // Limpiar Propósito
  curricularCard.querySelector('.clear-purpose-btn').addEventListener('click', () => {
    areaSelect.value = '';
    resetCurricularPreview(curricularCard, true);
    showToast('Propósito curricular limpiado.', 'info');
  });

  // Evento del selector de Tipo de Componente
  const typeSelect = curricularCard.querySelector('.comp-type-select');
  typeSelect.addEventListener('change', (e) => {
    const selectedType = e.target.value;
    curricularCard.dataset.type = selectedType;

    const iconSpan = curricularCard.querySelector('.comp-icon');
    iconSpan.textContent = selectedType === 'taller' ? '🎨' : '📖';

    const titleGroup = curricularCard.querySelector('.component-title-group');
    if (selectedType === 'taller') {
      curricularCard.classList.add('taller');
      titleGroup.classList.remove('hidden');
    } else {
      curricularCard.classList.remove('taller');
      titleGroup.classList.add('hidden');
    }

    // Refrescar renderizado del timeline con la configuración adecuada
    setupTimeline(timelineCard, contentCard, blockId, cardTimelines[blockId]?.moments, selectedType);
    showToast(`Componente cambiado a ${selectedType === 'taller' ? 'Taller / Secundario' : 'Actividad Principal'}.`, 'info');
  });

  // Cambio de Área en Paso 1
  areaSelect.addEventListener('change', async (e) => {
    const areaId = e.target.value;
    const skillSelect = curricularCard.querySelector('.skill-select');
    resetCurricularPreview(curricularCard);
    
    skillSelect.disabled = !areaId;
    if (areaId) {
      try {
        const skills = await getSkillsByArea(areaId);
        skillSelect.innerHTML = '<option value="">Selecciona la competencia...</option>';
        skills.forEach(s => {
          const opt = document.createElement('option');
          opt.value = s.id;
          opt.textContent = s.name;
          skillSelect.appendChild(opt);
        });
      } catch (error) {
        console.error('Error al cargar competencias:', error);
        showToast('Error al cargar competencias.', 'error');
      }
    }
  });

  // Cambio de Competencia en Paso 1
  const skillSelect = curricularCard.querySelector('.skill-select');
  skillSelect.addEventListener('change', async (e) => {
    const skillId = e.target.value;
    const cycleId = cycleSelect.value;
    const ageId = ageSelect.value;
    
    resetCurricularPreview(curricularCard, false);

    if (skillId) {
      try {
        if (cycleId) {
          const standardText = await getStandardBySkillAndCycle(skillId, cycleId);
          if (standardText) {
            curricularCard.querySelector('.standard-text').textContent = standardText;
            curricularCard.querySelector('.standard-preview').classList.remove('hidden');
          }
        }

        const abilities = await getAbilitiesBySkill(skillId);
        const abilitiesList = curricularCard.querySelector('.abilities-list');
        abilitiesList.innerHTML = '';
        if (abilities && abilities.length > 0) {
          abilities.forEach(a => {
            const li = document.createElement('li');
            li.textContent = a.name;
            abilitiesList.appendChild(li);
          });
          curricularCard.querySelector('.abilities-preview').classList.remove('hidden');
        }

        if (ageId) {
          await loadPerformancesForCard(curricularCard, blockId, skillId, ageId);
        } else {
          curricularCard.querySelector('.performances-list').innerHTML = '<p class="placeholder-text">Selecciona una edad en la cabecera para cargar los desempeños.</p>';
        }
      } catch (error) {
        console.error('Error al cargar datos curriculares:', error);
        showToast('Error al cargar datos de competencia.', 'error');
      }
    }
  });

  componentsContainer.appendChild(curricularCard);
  timelineStepContainer.appendChild(timelineCard);
  contentStepContainer.appendChild(contentCard);

  // Inicializar línea de tiempo y momentos (v9)
  setupTimeline(timelineCard, contentCard, blockId, compData?.moments, initialType);

  // Cargar datos curriculares previos de forma secuencial y determinista (v11)
  if (compData && compData.area_id) {
    (async () => {
      try {
        // 1. Asignar área
        areaSelect.value = compData.area_id;
        
        // 2. Cargar competencias de forma explícita
        const skills = await getSkillsByArea(compData.area_id);
        skillSelect.innerHTML = '<option value="">Selecciona la competencia...</option>';
        skills.forEach(s => {
          const opt = document.createElement('option');
          opt.value = s.id;
          opt.textContent = s.name;
          skillSelect.appendChild(opt);
        });
        skillSelect.disabled = false;
        
        // 3. Asignar competencia
        skillSelect.value = compData.skill_id;
        
        // 4. Cargar capacidades y estándar correspondientes
        const abilities = await getAbilitiesBySkill(compData.skill_id);
        const abPreview = curricularCard.querySelector('.abilities-preview');
        const abList = curricularCard.querySelector('.abilities-list');
        abList.innerHTML = '';
        if (abilities && abilities.length > 0) {
          abilities.forEach(a => {
            const li = document.createElement('li');
            li.textContent = a.name;
            abList.appendChild(li);
          });
          abPreview.classList.remove('hidden');
        } else {
          abPreview.classList.add('hidden');
        }

        const cycleId = cycleSelect.value;
        const stdPreview = curricularCard.querySelector('.standard-preview');
        const stdText = curricularCard.querySelector('.standard-text');
        if (cycleId) {
          const standard = await getStandardBySkillAndCycle(compData.skill_id, cycleId);
          stdText.textContent = standard || 'No hay estándar registrado para esta competencia y ciclo.';
          stdPreview.classList.remove('hidden');
        } else {
          stdPreview.classList.add('hidden');
          stdText.textContent = '';
        }

        // 5. Cargar desempeños para la edad
        const ageId = ageSelect.value;
        if (ageId) {
          await loadPerformancesForCard(curricularCard, blockId, compData.skill_id, ageId);
          
          // 6. Marcar desempeños seleccionados
          if (compData.performances) {
            compData.performances.forEach(perfId => {
              const cb = curricularCard.querySelector(`#perf_${blockId}_${perfId}`);
              if (cb) cb.checked = true;
            });
          }
        }
      } catch (error) {
        console.error('Error al precargar datos curriculares del componente:', error);
      }
    })();
  }
}

async function loadPerformancesForCard(card, blockId, skillId, ageId) {
  const perfList = card.querySelector('.performances-list');
  perfList.innerHTML = '<p class="placeholder-text">Cargando desempeños...</p>';
  perfList.classList.remove('disabled-list');

  try {
    const performances = await getPerformancesBySkillAndAge(skillId, ageId);
    perfList.innerHTML = '';
    
    if (performances && performances.length > 0) {
      performances.forEach(p => {
        const item = document.createElement('div');
        item.className = 'perf-item';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = p.id;
        cb.id = `perf_${blockId}_${p.id}`;
        cb.className = 'perf-checkbox';

        const lbl = document.createElement('label');
        lbl.setAttribute('for', cb.id);
        lbl.textContent = p.description;

        item.appendChild(cb);
        item.appendChild(lbl);
        
        item.addEventListener('click', (e) => {
          if (e.target !== cb && e.target !== lbl) {
            cb.checked = !cb.checked;
          }
        });

        perfList.appendChild(item);
      });
    } else {
      perfList.innerHTML = '<p class="placeholder-text">No hay desempeños registrados para esta edad.</p>';
    }
  } catch (error) {
    console.error('Error al cargar desempeños:', error);
    perfList.innerHTML = '<p class="placeholder-text">Error al cargar desempeños de la base de datos.</p>';
  }
}

function resetCurricularPreview(card, resetSkillSelect = true) {
  const stdPreview = card.querySelector('.standard-preview');
  const stdText = card.querySelector('.standard-text');
  const abPreview = card.querySelector('.abilities-preview');
  const abList = card.querySelector('.abilities-list');
  const perfList = card.querySelector('.performances-list');

  stdPreview.classList.add('hidden');
  stdText.textContent = '';
  abPreview.classList.add('hidden');
  abList.innerHTML = '';
  perfList.innerHTML = '<p class="placeholder-text">Selecciona una competencia y edad para ver los desempeños.</p>';
  perfList.classList.add('disabled-list');

  if (resetSkillSelect) {
    const skillSelect = card.querySelector('.skill-select');
    skillSelect.innerHTML = '<option value="">Selecciona la competencia...</option>';
    skillSelect.disabled = true;
  }
}

// Función helper asíncrona para cargar edades y evitar pérdidas de sincronía
async function loadAgesForCycle(cycleId) {
  ageSelect.value = '';
  ageSelect.disabled = !cycleId;
  
  const perfContainers = componentsContainer.querySelectorAll('.performances-list');
  perfContainers.forEach(container => {
    container.innerHTML = '<p class="placeholder-text">Selecciona una competencia y edad para ver los desempeños.</p>';
    container.classList.add('disabled-list');
  });

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
}

// --- Operaciones de Base de Datos ---

// Función común para inicializar el editor y poblarlo con datos (v11)
async function populateEditorWithSession(details, isTemplate = false) {
  // 1. Abrir el editor en modo plantilla o edición
  const sessionData = {
    ...details,
    id: isTemplate ? null : details.id,
    title: isTemplate ? `${details.title} (Copia)` : details.title,
    session_date: isTemplate ? "" : details.session_date
  };
  
  openEditor(sessionData);

  // 2. Cargar ciclo y edad
  const comp0 = details.components_sessions?.[0];
  let cycleId = '';
  let ageId = '';
  
  if (comp0 && comp0.performance_components_session && comp0.performance_components_session.length > 0) {
    const firstPerfId = comp0.performance_components_session[0].performance_id;
    
    const { data: perfData } = await supabase
      .from('performances')
      .select('age_id, ages(cycle_id)')
      .eq('id', firstPerfId)
      .single();
    
    if (perfData) {
      ageId = perfData.age_id;
      cycleId = perfData.ages?.cycle_id;
    }
  }

  if (cycleId) {
    cycleSelect.value = cycleId;
    await loadAgesForCycle(cycleId);
    
    if (ageId) {
      ageSelect.value = ageId;
      ageSelect.disabled = false;
    }

    if (details.components_sessions && details.components_sessions.length > 0) {
      const sortedComps = details.components_sessions.sort((a, b) => a.order_index - b.order_index);
      
      for (const comp of sortedComps) {
        const compPayload = {
          id: isTemplate ? null : comp.id, // Si es plantilla, limpiamos el id del componente para forzar inserción
          type: comp.type,
          title: comp.title,
          area_id: comp.purpose_components_session?.[0]?.learning_purposes?.area_id || null,
          skill_id: comp.purpose_components_session?.[0]?.learning_purposes?.skill_id || null,
          performances: comp.performance_components_session?.map(p => p.performance_id) || [],
          moments: comp.moment_components_session?.sort((a, b) => a.order_index - b.order_index).map(m => ({
            id: m.moment_id,
            title: m.moments?.title,
            moments_data: m.moments?.moments_data
          })) || []
        };
        
        createComponentCard(compPayload);
      }
    }
  }
}

async function editSession(sessionId) {
  try {
    showToast('Cargando detalles de la sesión...', 'info');
    const details = await getSessionDetails(sessionId);
    await populateEditorWithSession(details, false);
  } catch (error) {
    console.error('Error al editar sesión:', error);
    showToast('Error al cargar la información de la sesión.', 'error');
  }
}

async function saveCurrentSession() {
  if (!userId) return;

  saveSessionBtn.disabled = true;
  saveSessionBtn.textContent = '⏳ Guardando sesión...';

  try {
    const sessionData = {
      id: editSessionIdInput.value || null,
      title: cleanTextForSave(sessionTitleInput.value),
      session_date: sessionDateInput.value,
      components: []
    };

    const cardBlocks = componentsContainer.querySelectorAll('.component-block');
    
    cardBlocks.forEach((card, index) => {
      const blockId = card.dataset.blockId;
      const type = card.dataset.type;
      const title = card.querySelector('.comp-title-input')?.value || '';
      const areaId = card.querySelector('.area-select').value;
      const skillId = card.querySelector('.skill-select').value;

      const checkedBoxes = card.querySelectorAll('.perf-checkbox:checked');
      const performances = Array.from(checkedBoxes).map(cb => parseInt(cb.value));

      // !!! COMPARACIÓN ESTRUCTURAL PROFUNDA PARA EL RECICLAJE CON COPY-ON-WRITE (v10/v12) !!!
      const moments = (cardTimelines[blockId]?.moments || []).map((m, idx) => {
        // Normalizar en caliente los textos de moments_data antes de comparar y guardar
        const cleanMomentsData = (m.moments_data || []).map(sub => ({
          start_time: sub.start_time,
          end_time: sub.end_time,
          subtitle: cleanTextForSave(sub.subtitle),
          application: (sub.application || []).map(app => ({
            section_title: cleanTextForSave(app.section_title),
            items: (app.items || []).map(item => cleanTextForSave(item)),
            resources: (app.resources || []).map(res => cleanTextForSave(res))
          }))
        }));

        const momentPayload = {
          title: cleanTextForSave(m.title),
          moments_data: cleanMomentsData
        };

        // Intentar buscar match semántico exacto en la biblioteca local del usuario
        const catalogMatch = userMomentsCatalog.find(catMom => areMomentsEqual(momentPayload, catMom));
        return {
          id: catalogMatch ? catalogMatch.id : null, // Si coincide, reutiliza el ID, si no, se guarda como plantilla nueva (inmutabilidad)
          title: momentPayload.title,
          moments_data: momentPayload.moments_data,
          order_index: idx
        };
      });

      sessionData.components.push({
        type,
        title: cleanTextForSave(type === 'taller' ? title : sessionData.title),
        order_index: index,
        area_id: areaId ? parseInt(areaId) : null,
        skill_id: skillId ? parseInt(skillId) : null,
        performances,
        moments
      });
    });

    await saveSession(userId, sessionData);
    
    showToast('¡Sesión guardada exitosamente!', 'success');
    clearForm();
    showSessionsList();
    await loadSessionsList();
  } catch (error) {
    console.error('Error al guardar sesión:', error);
    showToast('Error al guardar la sesión en Supabase.', 'error');
  } finally {
    saveSessionBtn.disabled = false;
    saveSessionBtn.textContent = '💾 Guardar en Supabase';
  }
}

async function confirmDeleteSession(sessionId, title) {
  const confirm = window.confirm(`¿Estás seguro de que deseas eliminar la sesión "${title}"? esta acción no se puede deshacer.`);
  if (confirm) {
    try {
      showToast('Eliminando sesión...', 'info');
      await deleteSession(sessionId);
      showToast('Sesión eliminada.', 'success');
      await loadSessionsList();
    } catch (error) {
      console.error('Error al borrar sesión:', error);
      showToast('Error al eliminar la sesión.', 'error');
    }
  }
}

async function printSession(sessionId) {
  try {
    showToast('Generando vista de impresión...', 'info');
    const details = await getSessionDetails(sessionId);
    printSessionPDF(details);
  } catch (error) {
    console.error('Error al preparar impresión:', error);
    showToast('Error al generar el PDF de la sesión.', 'error');
  }
}

// Función helper de comparación profunda estructural para la inmutabilidad de la biblioteca de momentos (v12 semántica)
function areMomentsEqual(momA, momB) {
  if (normalizeText(momA.title) !== normalizeText(momB.title)) return false;
  
  const dataA = momA.moments_data || [];
  const dataB = momB.moments_data || [];
  
  if (dataA.length !== dataB.length) return false;
  
  for (let i = 0; i < dataA.length; i++) {
    const subA = dataA[i];
    const subB = dataB[i];
    
    if (subA.start_time !== subB.start_time) return false;
    if (subA.end_time !== subB.end_time) return false;
    if (normalizeText(subA.subtitle) !== normalizeText(subB.subtitle)) return false;
    
    // Comparar secuencia de aplicación
    const appA = subA.application || [];
    const appB = subB.application || [];
    if (appA.length !== appB.length) return false;
    
    for (let j = 0; j < appA.length; j++) {
      const secA = appA[j];
      const secB = appB[j];
      
      if (normalizeText(secA.section_title) !== normalizeText(secB.section_title)) return false;
      
      // Viñetas de aplicación
      const itemsA = secA.items || [];
      const itemsB = secB.items || [];
      if (itemsA.length !== itemsB.length) return false;
      if (itemsA.some((val, idx) => normalizeText(val) !== normalizeText(itemsB[idx]))) return false;
      
      // Viñetas de recursos
      const resA = secA.resources || [];
      const resB = secB.resources || [];
      if (resA.length !== resB.length) return false;
      if (resA.some((val, idx) => normalizeText(val) !== normalizeText(resB[idx]))) return false;
    }
  }
  
  return true;
}

// Abre el modal flotante para seleccionar modo de inicio (v11)
function openTemplateSelectionModal() {
  // Resetear el formulario del modal
  templateSelectionModal.querySelector('input[name="startMode"][value="blank"]').checked = true;
  templateSessionSelectGroup.classList.add('hidden-screen');
  templateSessionSelect.innerHTML = '<option value="">Selecciona la sesión...</option>';

  if (userSessionsList.length === 0) {
    const opt = document.createElement('option');
    opt.value = "";
    opt.textContent = "No tienes sesiones guardadas todavía";
    templateSessionSelect.appendChild(opt);
  } else {
    userSessionsList.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      const fmtDate = new Date(s.session_date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
      opt.textContent = `${s.title.toUpperCase()} (${fmtDate})`;
      templateSessionSelect.appendChild(opt);
    });
  }

  templateSelectionModal.classList.remove('hidden-screen');
}

// Carga los detalles de una sesión guardada y la clona como plantilla para la nueva sesión (v11)
async function loadSessionAsTemplate(templateId) {
  try {
    showToast('Cargando plantilla...', 'info');
    const details = await getSessionDetails(templateId);
    await populateEditorWithSession(details, true);
    showToast('Plantilla cargada. Selecciona la nueva fecha para guardar.', 'success');
  } catch (error) {
    console.error('Error al cargar plantilla:', error);
    showToast('Error al cargar los datos de la sesión plantilla.', 'error');
  }
}

// Helper para normalizar textos temporalmente con fines de comparación semántica (v12)
function normalizeText(str) {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remover tildes y diacríticos
    .replace(/^[\s.,-]+|[\s.,-]+$/g, '') // Quitar puntuación en los extremos
    .replace(/\s+/g, ' '); // Colapsar múltiples espacios
}

// Helper para sanitizar y formatear ortográficamente los textos al guardar (v12)
function cleanTextForSave(str) {
  if (!str) return '';
  let cleaned = str.trim().replace(/\s+/g, ' ');
  if (cleaned.length > 0) {
    // Capitalizar la primera letra
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  return cleaned;
}

// Poblar el datalist dinámico de títulos de momentos para autocompletado (v12)
function populateMomentsDatalist() {
  const datalist = document.getElementById('momentTitlesDatalist');
  if (!datalist) return;
  datalist.innerHTML = '';
  
  if (userMomentsCatalog && userMomentsCatalog.length > 0) {
    // Extraer títulos únicos de moments catalog
    const uniqueTitles = Array.from(new Set(userMomentsCatalog.map(m => m.title.trim())));
    uniqueTitles.forEach(title => {
      const opt = document.createElement('option');
      opt.value = title;
      datalist.appendChild(opt);
    });
  }
}
