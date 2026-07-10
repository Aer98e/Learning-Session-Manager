import { showToast } from './toast.js';

// Mapa para guardar la instancia de momentos de cada blockId
export const cardTimelines = {};

// Referencias del Modal global de timeline
let timelineModal = null;
let modalTitle = null;
let modalMomentTitle = null;
let modalSubhorariosContainer = null;
let btnModalAddSubhorario = null;
let btnDeleteModal = null;
let btnCancelModal = null;
let btnSaveModal = null;
let btnCloseModal = null;
let modalBlockId = null;
let modalMomentIdx = null;

// Variable global para recordar qué submomento está seleccionado en el Paso 3 para cada momento
// Estructura: { [blockId]: { [momentIdx]: activeSubmomIdx } }
const activeSubmoments = {};

/**
 * Inicializa la línea de tiempo interactiva v9.
 */
export function setupTimeline(timelineContainer, contentContainer, blockId, initialMoments = null, type = 'principal') {
  const defaultStart = type === 'principal' ? '08:30' : '11:45';
  const defaultEnd = type === 'principal' ? '11:45' : '12:30';

  cardTimelines[blockId] = {
    startTime: defaultStart,
    endTime: defaultEnd,
    moments: [] 
  };

  activeSubmoments[blockId] = {};

  // Inicializar modal
  initModalReferences();

  // 1. Inyectar HTML del Paso 2
  timelineContainer.innerHTML = `
    <div class="timeline-wrapper">
      <h4 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 1rem; color: var(--color-primary-light);">
        ${type === 'taller' ? '🎨 Taller / Actividad Secundaria' : '📖 Actividad Principal'}
      </h4>

      <div class="timeline-range-inputs">
        <div class="form-group">
          <label>Hora Inicio del Bloque</label>
          <input type="time" class="general-start-time" value="${defaultStart}">
        </div>
        <div class="form-group">
          <label>Hora Fin del Bloque</label>
          <input type="time" class="general-end-time" value="${defaultEnd}">
        </div>
      </div>

      <!-- Barra de la línea de tiempo con círculos -->
      <div class="timeline-track-container">
        <div class="timeline-track">
          <!-- Los círculos se dibujan aquí -->
        </div>
      </div>
      <p class="timeline-hint">💡 Haz clic en cualquier parte de la línea para crear una nueva división horaria. Haz clic en un círculo para editar todos sus horarios.</p>
    </div>

    <!-- Lista compacta de momentos y horarios definidos -->
    <div class="moments-summary-list"></div>
  `;

  // 2. Inyectar HTML del Paso 3
  contentContainer.innerHTML = `
    <div class="moment-content-editor-wrapper">
      <h4 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem; color: var(--color-primary-light);">
        Contenido: ${type === 'taller' ? 'Taller / Actividad' : 'Actividad Principal'}
      </h4>
      <p class="subtitle" style="font-size: 0.85rem; margin-bottom: 1rem; color: var(--color-text-muted);">
        Selecciona un momento principal para redactar su secuencia y recursos:
      </p>

      <div class="moment-cards-list"></div>
      
      <!-- Selector de Submomentos (Pestañas de Horarios) -->
      <div class="submoment-tabs-container"></div>

      <div class="moment-details-panel"></div>
    </div>
  `;

  const trackContainer = timelineContainer.querySelector('.timeline-track-container');
  const startTimeInput = timelineContainer.querySelector('.general-start-time');
  const endTimeInput = timelineContainer.querySelector('.general-end-time');

  // Registrar listeners de horas generales
  startTimeInput.addEventListener('change', () => {
    cardTimelines[blockId].startTime = startTimeInput.value;
    rebuildAndSortTimeline(blockId);
    renderTimeline(timelineContainer, contentContainer, blockId, type);
  });

  endTimeInput.addEventListener('change', () => {
    cardTimelines[blockId].endTime = endTimeInput.value;
    rebuildAndSortTimeline(blockId);
    renderTimeline(timelineContainer, contentContainer, blockId, type);
  });

  // Clic en la barra para agregar una división
  trackContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('timeline-node') || e.target.classList.contains('node-time-label')) {
      return;
    }

    const rect = trackContainer.querySelector('.timeline-track').getBoundingClientRect();
    const isMobile = window.innerWidth <= 600;
    let percentage = 0;

    if (isMobile) {
      const clickY = e.clientY - rect.top;
      percentage = Math.max(0, Math.min(100, (clickY / rect.height) * 100));
    } else {
      const clickX = e.clientX - rect.left;
      percentage = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
    }

    const startMin = timeToMinutes(cardTimelines[blockId].startTime);
    const endMin = timeToMinutes(cardTimelines[blockId].endTime);
    const duration = endMin - startMin;

    if (duration <= 0) {
      showToast('La hora de inicio debe ser menor que la hora de fin.', 'warning');
      return;
    }

    const clickMinutes = (percentage / 100) * duration;
    const timeVal = minutesToTime(startMin + clickMinutes);

    openModalForNewNode(timelineContainer, contentContainer, blockId, timeVal, type);
  });

  // Cargar momentos iniciales
  if (initialMoments && initialMoments.length > 0) {
    const sortedInit = [...initialMoments];
    const firstMomData = sortedInit[0]?.moments_data?.[0];
    const lastMomData = sortedInit[sortedInit.length - 1]?.moments_data?.slice(-1)[0];

    const startHour = firstMomData?.start_time || defaultStart;
    const endHour = lastMomData?.end_time || defaultEnd;

    cardTimelines[blockId].startTime = startHour;
    cardTimelines[blockId].endTime = endHour;
    startTimeInput.value = startHour;
    endTimeInput.value = endHour;

    cardTimelines[blockId].moments = sortedInit.map(mom => {
      // Cargar moments_data unificado v9
      let dataList = mom.moments_data || [];
      if (dataList.length === 0) {
        dataList = [{
          start_time: defaultStart,
          end_time: defaultEnd,
          subtitle: '',
          application: [{ section_title: '', items: [], resources: [] }]
        }];
      }

      // Sanitizar submomentos
      const moments_data = dataList.map(sub => {
        let application = sub.application || [];
        if (application.length === 0) {
          application = [{ section_title: '', items: [], resources: sub.resources || [] }];
        } else {
          // Migrar recursos si venían de forma global en el submomento
          application = application.map(sec => ({
            section_title: sec.section_title || '',
            items: sec.items || [],
            resources: sec.resources || sub.resources || []
          }));
        }

        return {
          start_time: sub.start_time,
          end_time: sub.end_time,
          subtitle: sub.subtitle || '',
          application
        };
      });

      return {
        id: mom.id || null,
        title: mom.title,
        moments_data
      };
    });
  } else {
    // Por defecto
    cardTimelines[blockId].moments = [{
      id: null,
      title: type === 'principal' ? 'ACTIVIDAD DEL DÍA' : 'TALLER',
      moments_data: [{
        start_time: defaultStart,
        end_time: defaultEnd,
        subtitle: '',
        application: [{ section_title: '', items: [], resources: [] }]
      }]
    }];
  }

  // Render inicial
  rebuildAndSortTimeline(blockId);
  renderTimeline(timelineContainer, contentContainer, blockId, type);
}

// --- Referencias del Modal ---

function initModalReferences() {
  if (timelineModal) return;
  
  timelineModal = document.getElementById('timelineModal');
  modalTitle = document.getElementById('modalTitle');
  modalMomentTitle = document.getElementById('modalMomentTitle');
  modalSubhorariosContainer = document.getElementById('modalSubhorariosContainer');
  btnModalAddSubhorario = document.getElementById('btnModalAddSubhorario');
  btnDeleteModal = document.getElementById('btnDeleteModal');
  btnCancelModal = document.getElementById('btnCancelModal');
  btnSaveModal = document.getElementById('btnSaveModal');
  btnCloseModal = document.getElementById('btnCloseModal');
  modalBlockId = document.getElementById('modalBlockId');
  modalMomentIdx = document.getElementById('modalMomentIdx');

  const closeModal = () => {
    timelineModal.classList.add('hidden-screen');
  };

  btnCancelModal.addEventListener('click', closeModal);
  btnCloseModal.addEventListener('click', closeModal);
}

// --- Filas de subhorarios del modal ---

function createModalSubhorarioRow(container, start_time = '', subtitle = '', isFirst = false) {
  const row = document.createElement('div');
  row.className = 'submoment-editor-row';

  row.innerHTML = `
    <div class="form-group" style="margin-bottom:0;">
      <input type="time" class="modal-sub-start-time" value="${start_time}" required ${isFirst ? 'disabled' : ''}>
    </div>
    <div class="form-group" style="margin-bottom:0;">
      <input type="text" class="modal-sub-subtitle" placeholder="Subtítulo opcional (ej: Inicio)" value="${subtitle}">
    </div>
    ${isFirst ? '' : `<button type="button" class="remove-bullet-btn" style="padding: 0.35rem 0.6rem;">🗑️</button>`}
  `;

  if (!isFirst) {
    row.querySelector('.remove-bullet-btn').addEventListener('click', () => {
      row.remove();
      updateModalDeleteButtonVisibility(container);
    });
  }

  container.appendChild(row);
  updateModalDeleteButtonVisibility(container);
}

function updateModalDeleteButtonVisibility(container) {
  const rows = container.querySelectorAll('.submoment-editor-row');
  rows.forEach((row) => {
    const btn = row.querySelector('.remove-bullet-btn');
    if (btn) {
      btn.style.display = rows.length > 1 ? 'block' : 'none';
    }
  });
}

// --- Apertura del Modal ---

function openModalForNewNode(timelineContainer, contentContainer, blockId, timeVal, type) {
  modalTitle.textContent = "Nueva División de Horario";
  modalBlockId.value = blockId;
  modalMomentIdx.value = "";
  modalMomentTitle.value = "";
  modalSubhorariosContainer.innerHTML = "";

  createModalSubhorarioRow(modalSubhorariosContainer, timeVal, "", false);
  btnDeleteModal.style.display = "none";

  btnModalAddSubhorario.onclick = () => {
    createModalSubhorarioRow(modalSubhorariosContainer, cardTimelines[blockId].startTime, "", false);
  };

  btnSaveModal.onclick = () => {
    const momName = modalMomentTitle.value.trim();
    if (!momName) {
      showToast('Por favor escribe el nombre del momento.', 'warning');
      return;
    }

    const rows = modalSubhorariosContainer.querySelectorAll('.submoment-editor-row');
    const moments_data = [];
    let hasEmptyTime = false;

    rows.forEach(row => {
      const timeVal = row.querySelector('.modal-sub-start-time').value;
      const subtitle = row.querySelector('.modal-sub-subtitle').value.trim();
      if (!timeVal) hasEmptyTime = true;
      moments_data.push({
        start_time: timeVal,
        end_time: timeVal,
        subtitle,
        application: [{ section_title: '', items: [], resources: [] }]
      });
    });

    if (hasEmptyTime) {
      showToast('Todas las filas de subhorarios deben tener una hora asignada.', 'warning');
      return;
    }

    const timeline = cardTimelines[blockId];
    timeline.moments.push({
      id: null,
      title: momName,
      moments_data
    });

    rebuildAndSortTimeline(blockId);
    renderTimeline(timelineContainer, contentContainer, blockId, type);
    timelineModal.classList.add('hidden-screen');
    showToast('Momento añadido con éxito.', 'success');
  };

  timelineModal.classList.remove('hidden-screen');
}

function openModalForEditNode(timelineContainer, contentContainer, blockId, momIdx, type) {
  const timeline = cardTimelines[blockId];
  const moment = timeline.moments[momIdx];

  modalTitle.textContent = "Editar Horarios del Momento";
  modalBlockId.value = blockId;
  modalMomentIdx.value = momIdx;
  modalMomentTitle.value = moment.title;
  modalSubhorariosContainer.innerHTML = "";

  moment.moments_data.forEach((range, idx) => {
    const isFirstNode = momIdx === 0 && idx === 0;
    createModalSubhorarioRow(modalSubhorariosContainer, range.start_time, range.subtitle, isFirstNode);
  });

  btnDeleteModal.style.display = timeline.moments.length > 1 ? "block" : "none";

  btnModalAddSubhorario.onclick = () => {
    createModalSubhorarioRow(modalSubhorariosContainer, timeline.startTime, "", false);
  };

  btnSaveModal.onclick = () => {
    const momName = modalMomentTitle.value.trim();
    if (!momName) {
      showToast('Por favor escribe el nombre del momento.', 'warning');
      return;
    }

    const rows = modalSubhorariosContainer.querySelectorAll('.submoment-editor-row');
    const moments_data = [];
    let hasEmptyTime = false;

    rows.forEach((row, idx) => {
      const input = row.querySelector('.modal-sub-start-time');
      const timeVal = input.value || (momIdx === 0 && idx === 0 ? timeline.startTime : '');
      const subtitle = row.querySelector('.modal-sub-subtitle').value.trim();
      
      if (!timeVal) hasEmptyTime = true;
      
      // Intentar preservar aplicación y recursos de los submomentos anteriores si el índice es compatible
      const prevSub = moment.moments_data[idx];
      const application = prevSub ? prevSub.application : [{ section_title: '', items: [], resources: [] }];

      moments_data.push({
        start_time: timeVal,
        end_time: timeVal,
        subtitle,
        application
      });
    });

    if (hasEmptyTime) {
      showToast('Todos los subhorarios deben tener una hora asignada.', 'warning');
      return;
    }

    moment.title = momName;
    moment.moments_data = moments_data;

    rebuildAndSortTimeline(blockId);
    renderTimeline(timelineContainer, contentContainer, blockId, type);
    timelineModal.classList.add('hidden-screen');
    showToast('Momentos y horarios actualizados.', 'success');
  };

  btnDeleteModal.onclick = () => {
    const confirm = window.confirm(`¿Estás seguro de que deseas eliminar el momento "${moment.title.toUpperCase()}" y todos sus horarios asociados?`);
    if (confirm) {
      timeline.moments.splice(momIdx, 1);
      rebuildAndSortTimeline(blockId);
      renderTimeline(timelineContainer, contentContainer, blockId, type);
      timelineModal.classList.add('hidden-screen');
      showToast('Momento eliminado.', 'success');
    }
  };

  timelineModal.classList.remove('hidden-screen');
}

// --- Lógica de Ordenación y Cálculo de Fin (rebuildAndSortTimeline) ---

function rebuildAndSortTimeline(blockId) {
  const timeline = cardTimelines[blockId];
  if (!timeline) return;

  // 1. Recopilar todos los submomentos sueltos
  const flatSubmoments = [];
  timeline.moments.forEach(mom => {
    mom.moments_data.forEach(r => {
      flatSubmoments.push({
        momTitle: mom.title,
        id: mom.id || null,
        start_time: r.start_time,
        subtitle: r.subtitle || '',
        application: r.application || [{ section_title: '', items: [], resources: [] }]
      });
    });
  });

  if (flatSubmoments.length === 0) return;

  // 2. Ordenar cronológicamente
  flatSubmoments.sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));

  // Forzar inicio exacto de la sesión
  flatSubmoments[0].start_time = timeline.startTime;

  // 3. Asignar horas fin automáticamente
  for (let i = 0; i < flatSubmoments.length - 1; i++) {
    flatSubmoments[i].end_time = flatSubmoments[i+1].start_time;
  }
  flatSubmoments[flatSubmoments.length - 1].end_time = timeline.endTime;

  // 4. Agrupar de vuelta bajo momentos principales
  const groupedMoments = [];

  flatSubmoments.forEach(sub => {
    const normTitle = sub.momTitle.trim().toUpperCase();
    let existing = groupedMoments.find(m => m.title.trim().toUpperCase() === normTitle);

    if (!existing) {
      existing = {
        id: sub.id,
        title: sub.momTitle,
        moments_data: []
      };
      groupedMoments.push(existing);
    }

    existing.moments_data.push({
      start_time: sub.start_time,
      end_time: sub.end_time,
      subtitle: sub.subtitle,
      application: sub.application
    });
  });

  timeline.moments = groupedMoments;
}

// --- Renderizado de UI ---

export function renderTimeline(timelineContainer, contentContainer, blockId, type = 'principal') {
  const timeline = cardTimelines[blockId];
  const track = timelineContainer.querySelector('.timeline-track');
  const summaryList = timelineContainer.querySelector('.moments-summary-list');

  track.querySelectorAll('.timeline-node').forEach(n => n.remove());

  const startMin = timeToMinutes(timeline.startTime);
  const endMin = timeToMinutes(timeline.endTime);
  const duration = endMin - startMin;

  if (duration <= 0) return;

  // 1. Dibujar círculos interactivos en la barra (Intercalados)
  const nodes = [];
  timeline.moments.forEach((mom, momIdx) => {
    mom.moments_data.forEach((range, rangeIdx) => {
      nodes.push({
        time: range.start_time,
        title: mom.title,
        subtitle: range.subtitle,
        momIdx
      });
    });
  });

  nodes.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

  nodes.forEach((node, nodeIdx) => {
    const nodeMin = timeToMinutes(node.time);
    const percentage = ((nodeMin - startMin) / duration) * 100;

    const nodeEl = document.createElement('div');
    
    // !!! APLICAR INTERCALADO VERTICAL: pares arriba, impares abajo !!!
    const labelPosClass = nodeIdx % 2 === 0 ? 'label-pos-top' : 'label-pos-bottom';
    nodeEl.className = `timeline-node ${type === 'taller' ? 'taller-node' : ''} ${labelPosClass}`;
    
    nodeEl.style.setProperty('--percentage', percentage);

    nodeEl.innerHTML = `
      <span class="node-time-label">${node.time}</span>
      <span class="node-title-label">
        ${node.title.toUpperCase()}
        ${node.subtitle ? `<br><span style="font-size:7pt; font-style:italic; font-weight:normal;">(${node.subtitle})</span>` : ''}
      </span>
    `;

    nodeEl.addEventListener('click', (e) => {
      e.stopPropagation();
      openModalForEditNode(timelineContainer, contentContainer, blockId, node.momIdx, type);
    });

    track.appendChild(nodeEl);
  });

  // 2. Resumen compacto Paso 2
  summaryList.innerHTML = '';
  timeline.moments.forEach((mom) => {
    const item = document.createElement('div');
    item.className = 'moment-summary-item';

    const rangeStrings = mom.moments_data.map(r => `${r.start_time} – ${r.end_time}${r.subtitle ? ` (${r.subtitle})` : ''}`).join(', ');

    item.innerHTML = `
      <div class="moment-summary-color ${type === 'taller' ? 'taller-node-color' : ''}"></div>
      <div class="moment-summary-info">
        <span class="moment-summary-title">${mom.title.toUpperCase()}</span>
        <span class="moment-summary-times">⏱️ ${rangeStrings}</span>
      </div>
    `;

    summaryList.appendChild(item);
  });

  // 3. Renderizar Paso 3
  renderStep3Cards(contentContainer, blockId, type);
}

// --- Renderizado del Paso 3 ---

function renderStep3Cards(contentContainer, blockId, type) {
  const timeline = cardTimelines[blockId];
  const cardsList = contentContainer.querySelector('.moment-cards-list');
  const detailsPanel = contentContainer.querySelector('.moment-details-panel');
  const tabsContainer = contentContainer.querySelector('.submoment-tabs-container');

  const activeCard = cardsList.querySelector('.moment-card.active');
  const activeIdx = activeCard ? parseInt(activeCard.dataset.idx) : 0;

  cardsList.innerHTML = '';

  timeline.moments.forEach((mom, idx) => {
    const timeSummary = mom.moments_data.map(r => `${r.start_time}-${r.end_time}`).join(', ');

    const card = document.createElement('div');
    card.className = 'moment-card';
    card.dataset.idx = idx;

    card.innerHTML = `
      <div class="moment-card-color ${type === 'taller' ? 'taller-node-color' : ''}"></div>
      <div class="moment-card-info">
        <span class="moment-card-title">${mom.title.toUpperCase()}</span>
        <span class="moment-card-time">${timeSummary}</span>
      </div>
    `;

    card.addEventListener('click', () => {
      cardsList.querySelectorAll('.moment-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      
      // Renderizar pestañas de submomentos
      renderSubmomentTabs(contentContainer, blockId, idx, type);
    });

    cardsList.appendChild(card);
  });

  const cards = cardsList.querySelectorAll('.moment-card');
  if (cards.length > 0) {
    const targetCard = cards[activeIdx] || cards[0];
    targetCard.click();
  } else {
    tabsContainer.innerHTML = '';
    detailsPanel.innerHTML = '<p class="placeholder-text">Define los horarios en el Paso 2 para redactar contenidos aquí.</p>';
  }
}

// Renderizar pestañas de submomentos (Horarios Internos)
function renderSubmomentTabs(contentContainer, blockId, momIdx, type) {
  const timeline = cardTimelines[blockId];
  const moment = timeline.moments[momIdx];
  const tabsContainer = contentContainer.querySelector('.submoment-tabs-container');
  
  tabsContainer.innerHTML = '';

  // Recuperar submomento activo recordado en el estado local de UI
  if (activeSubmoments[blockId][momIdx] === undefined || activeSubmoments[blockId][momIdx] >= moment.moments_data.length) {
    activeSubmoments[blockId][momIdx] = 0;
  }

  const activeSubIdx = activeSubmoments[blockId][momIdx];

  moment.moments_data.forEach((sub, idx) => {
    const tab = document.createElement('div');
    tab.className = `submoment-tab ${idx === activeSubIdx ? 'active' : ''}`;
    
    tab.innerHTML = `
      ${sub.subtitle ? `<strong>${sub.subtitle.toUpperCase()}</strong> ` : ''}
      <span>(${sub.start_time} - ${sub.end_time})</span>
    `;

    tab.addEventListener('click', () => {
      tabsContainer.querySelectorAll('.submoment-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      activeSubmoments[blockId][momIdx] = idx;
      openMomentDetailsEditor(contentContainer, blockId, momIdx, idx);
    });

    tabsContainer.appendChild(tab);
  });

  // Autocargar el submomento activo
  openMomentDetailsEditor(contentContainer, blockId, momIdx, activeSubIdx);
}

// !!! EDICIÓN DE CONTENIDO PEDAGÓGICO A NIVEL DE SUBMOMENTO CON RECURSOS INTERNOS POR SUBSECCIÓN !!!
function openMomentDetailsEditor(contentContainer, blockId, momIdx, subIdx) {
  const timeline = cardTimelines[blockId];
  const moment = timeline.moments[momIdx];
  const submoment = moment.moments_data[subIdx];
  const panel = contentContainer.querySelector('.moment-details-panel');

  if (!submoment) {
    panel.innerHTML = '<p class="placeholder-text">Selecciona un submomento para redactar su contenido.</p>';
    return;
  }

  panel.innerHTML = `
    <div class="moment-details-header">
      <h4>REDACCIÓN DEL CONTENIDO PEDAGÓGICO</h4>
      <span>${moment.title.toUpperCase()} ${submoment.subtitle ? `(${submoment.subtitle})` : ''} - [${submoment.start_time} a ${submoment.end_time}]</span>
    </div>

    <!-- TARJETA ÚNICA DE SECUENCIA Y RECURSOS INTEGRADOS POR SECCIÓN -->
    <div class="details-section-card">
      <h5>📋 Secuencia de la Aplicación y Recursos</h5>
      <div class="form-group" style="margin-bottom: 0;">
        <label style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.75rem;">
          Redacta los pasos del procedimiento y asigna sus recursos por sección:
          <button type="button" class="add-bullet-btn add-subsection-trigger">➕ Agregar Subsección</button>
        </label>
        <div class="subsections-container">
          <!-- Subsecciones dinámicas inyectadas -->
        </div>
      </div>
    </div>
  `;

  const subContainer = panel.querySelector('.subsections-container');
  panel.querySelector('.add-subsection-trigger').addEventListener('click', () => {
    createSubsectionBlock(subContainer, blockId, momIdx, subIdx);
  });

  // Cargar subsecciones existentes
  if (submoment.application && submoment.application.length > 0) {
    submoment.application.forEach(sub => {
      createSubsectionBlock(subContainer, blockId, momIdx, subIdx, sub);
    });
  } else {
    createSubsectionBlock(subContainer, blockId, momIdx, subIdx);
  }
}

function createSubsectionBlock(container, blockId, mIdx, sIdx, subData = null) {
  const timeline = cardTimelines[blockId];
  const moment = timeline.moments[mIdx];
  const submoment = moment.moments_data[sIdx];

  const subBlock = document.createElement('div');
  subBlock.className = 'subsection-block';

  subBlock.innerHTML = `
    <div class="subsection-header" style="justify-content: space-between;">
      <input type="text" class="subsection-title-input" placeholder="Título Opcional (ej: Inicio, Psicomotriz)" value="${subData?.section_title || ''}">
      <button type="button" class="remove-subsection-btn">Eliminar Bloque</button>
    </div>
    
    <!-- Lado de la Secuencia de la Aplicación -->
    <div class="form-group" style="margin-top: 0.5rem;">
      <label style="font-size:0.8rem; font-weight:600; color: var(--color-text-muted);">Procedimiento / Pasos de Aplicación</label>
      <div class="bullet-input-list app-bullets">
        <!-- Viñetas de aplicación -->
      </div>
      <button type="button" class="add-bullet-btn add-app-bullet" style="margin-top: 0.25rem;">➕ Agregar viñeta</button>
    </div>

    <!-- Lado de Recursos por Subsección -->
    <div class="form-group" style="margin-top: 1rem; border-top: 1px dashed var(--border-color); padding-top: 0.75rem;">
      <label style="font-size:0.8rem; font-weight:600; color: var(--color-text-muted);">Recursos y Materiales específicos</label>
      <div class="bullet-input-list res-bullets">
        <!-- Viñetas de recursos -->
      </div>
      <button type="button" class="add-bullet-btn add-res-bullet" style="margin-top: 0.25rem;">➕ Agregar recurso</button>
    </div>
  `;

  const appBulletsContainer = subBlock.querySelector('.app-bullets');
  const resBulletsContainer = subBlock.querySelector('.res-bullets');
  const titleInput = subBlock.querySelector('.subsection-title-input');

  subBlock.querySelector('.remove-subsection-btn').addEventListener('click', () => {
    subBlock.remove();
    updateApplicationState(container, submoment);
  });

  subBlock.querySelector('.add-app-bullet').addEventListener('click', () => {
    createAppBulletInput(appBulletsContainer, container, submoment);
  });

  subBlock.querySelector('.add-res-bullet').addEventListener('click', () => {
    createResourceBulletInput(resBulletsContainer, container, submoment);
  });

  titleInput.addEventListener('input', () => {
    updateApplicationState(container, submoment);
  });

  // Cargar viñetas de aplicación
  if (subData && subData.items && subData.items.length > 0) {
    subData.items.forEach(text => {
      createAppBulletInput(appBulletsContainer, container, submoment, text);
    });
  } else {
    createAppBulletInput(appBulletsContainer, container, submoment);
  }

  // Cargar viñetas de recursos
  if (subData && subData.resources && subData.resources.length > 0) {
    subData.resources.forEach(text => {
      createResourceBulletInput(resBulletsContainer, container, submoment, text);
    });
  } else {
    createResourceBulletInput(resBulletsContainer, container, submoment);
  }

  container.appendChild(subBlock);
  updateApplicationState(container, submoment);
}

function createAppBulletInput(container, mainContainer, submoment, value = '') {
  const item = document.createElement('div');
  item.className = 'bullet-item';
  item.innerHTML = `
    <input type="text" class="bullet-input" placeholder="Describe el paso o acción..." value="${value}">
    <button type="button" class="remove-bullet-btn">🗑️</button>
  `;

  item.querySelector('input').addEventListener('input', () => {
    updateApplicationState(mainContainer, submoment);
  });

  item.querySelector('.remove-bullet-btn').addEventListener('click', () => {
    if (container.querySelectorAll('.bullet-item').length > 1) {
      item.remove();
      updateApplicationState(mainContainer, submoment);
    } else {
      item.querySelector('input').value = '';
      updateApplicationState(mainContainer, submoment);
    }
  });

  container.appendChild(item);
  updateApplicationState(mainContainer, submoment);
}

function createResourceBulletInput(container, mainContainer, submoment, value = '') {
  const item = document.createElement('div');
  item.className = 'bullet-item';
  item.innerHTML = `
    <input type="text" class="bullet-input" placeholder="Ej. Parlantes, hojas de colores..." value="${value}">
    <button type="button" class="remove-bullet-btn">🗑️</button>
  `;

  item.querySelector('input').addEventListener('input', () => {
    updateApplicationState(mainContainer, submoment);
  });

  item.querySelector('.remove-bullet-btn').addEventListener('click', () => {
    if (container.querySelectorAll('.bullet-item').length > 1) {
      item.remove();
      updateApplicationState(mainContainer, submoment);
    } else {
      item.querySelector('input').value = '';
      updateApplicationState(mainContainer, submoment);
    }
  });

  container.appendChild(item);
  updateApplicationState(mainContainer, submoment);
}

function updateApplicationState(mainContainer, submoment) {
  const blocks = mainContainer.querySelectorAll('.subsection-block');
  const application = [];

  blocks.forEach(block => {
    const section_title = block.querySelector('.subsection-title-input').value.trim();
    
    const appBulletInputs = block.querySelectorAll('.app-bullets .bullet-input');
    const items = Array.from(appBulletInputs).map(inp => inp.value.trim()).filter(val => val !== '');

    const resBulletInputs = block.querySelectorAll('.res-bullets .bullet-input');
    const resources = Array.from(resBulletInputs).map(inp => inp.value.trim()).filter(val => val !== '');

    application.push({
      section_title, 
      items,
      resources
    });
  });

  submoment.application = application;
}

// --- Helpers de Tiempo ---

function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}
