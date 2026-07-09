import { extractMarkers } from '../utils/docxParser.js';
import { state } from '../utils/state.js';
import { showToast } from './toast.js';

let dropZone = null;
let templateFileInput = null;
let fileInfo = null;
let markerPreviewContainer = null;
let markersList = null;
let formSection = null;

export function initTemplateLoader() {
  dropZone = document.getElementById('dropZone');
  templateFileInput = document.getElementById('templateFileInput');
  fileInfo = document.getElementById('fileInfo');
  markerPreviewContainer = document.getElementById('markerPreviewContainer');
  markersList = document.getElementById('markersList');
  formSection = document.getElementById('formSection');

  // Configurar eventos de arrastre
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

  // Escuchar logout para limpiar la plantilla
  document.addEventListener('app:logout', () => {
    resetTemplateLoader();
  });
}

function handleFile(file) {
  if (!file.name.toLowerCase().endsWith('.docx')) {
    showToast('Por favor carga un archivo Word válido (.docx)', 'error');
    return;
  }

  fileInfo.textContent = `Archivo cargado: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
  
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      state.templateBuffer = e.target.result;
      
      // Extraer marcadores
      state.detectedMarkers = extractMarkers(state.templateBuffer);
      renderMarkersPreview(state.detectedMarkers);

      // Activar Formulario (Paso 2)
      formSection.classList.remove('disabled');

      // Notificar a otros componentes que la plantilla está lista
      document.dispatchEvent(new CustomEvent('app:template-loaded'));
    } catch (err) {
      showToast(err.message, 'error');
      resetTemplateLoader();
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
    if (marker.startsWith('AREA') || marker.startsWith('COMPETENCIA') || marker.startsWith('DESEMPEÑOS')) {
      span.classList.add('primary-marker');
    }
    span.textContent = `{${marker}}`;
    markersList.appendChild(span);
  });
}

function resetTemplateLoader() {
  state.templateBuffer = null;
  state.detectedMarkers = [];
  if (fileInfo) fileInfo.textContent = '';
  if (markerPreviewContainer) markerPreviewContainer.classList.add('hidden');
  if (templateFileInput) templateFileInput.value = '';
  if (formSection) formSection.classList.add('disabled');
}
