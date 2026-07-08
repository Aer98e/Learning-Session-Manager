import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

/**
 * Limpia el XML de Word de etiquetas de corrector ortográfico o runs fragmentados
 * que dividen o rompen los marcadores {{ ... }}.
 */
function cleanWordXml(xml) {
  // 1. Eliminar etiquetas de corrector ortográfico/gramatical de Word
  xml = xml.replace(/<w:proofErr[^>]*\/>/g, '');
  xml = xml.replace(/<w:noProof[^>]*\/>/g, '');

  // 2. Unir runs consecutivos que dividen llaves o texto de marcadores
  // Busca transiciones de fin de texto y fin de run, seguidas de inicio de run e inicio de texto
  // siempre y cuando estén rodeadas por caracteres válidos de marcadores (letras, números, llaves, guión bajo o espacios).
  const runTransition = /([a-zA-Z0-9_{}\s])<\/w:t><\/w:r><w:r[^>]*>(?:<w:rPr[^>]*>[\s\S]*?<\/w:rPr>)?<w:t[^>]*>([a-zA-Z0-9_{}\s])/g;

  // Aplicar repetidamente por si hay múltiples runs consecutivos fragmentados (ej: { </w:t>... <w:t> { )
  let previousXml;
  do {
    previousXml = xml;
    xml = xml.replace(runTransition, '$1$2');
  } while (xml !== previousXml);

  return xml;
}

/**
 * Aplica la limpieza de XML a todos los archivos de texto (documento, encabezados y pies de página) del zip.
 */
function cleanZipXmlFiles(zip) {
  Object.keys(zip.files).forEach(fileName => {
    if (
      fileName.startsWith('word/document') ||
      fileName.startsWith('word/header') ||
      fileName.startsWith('word/footer')
    ) {
      let xmlContent = zip.files[fileName].asText();
      xmlContent = cleanWordXml(xmlContent);
      zip.file(fileName, xmlContent);
    }
  });
}

/**
 * Extrae todas las variables/marcadores (ej. FECHA, AREA1, etc.) de un archivo .docx.
 * @param {ArrayBuffer} arrayBuffer - El buffer de bytes del archivo Word.
 * @returns {string[]} Lista de nombres de marcadores encontrados.
 */
export function extractMarkers(arrayBuffer) {
  try {
    const zip = new PizZip(arrayBuffer);
    
    // Limpiar archivos XML internos antes de procesar
    cleanZipXmlFiles(zip);
    
    const markers = new Set();
    const tRegex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
    const markerRegex = /\{([^{}]+)\}/g;

    // Buscar marcadores en todos los archivos XML de interés (documento, cabeceras y pies)
    Object.keys(zip.files).forEach(fileName => {
      if (
        fileName.startsWith('word/document') ||
        fileName.startsWith('word/header') ||
        fileName.startsWith('word/footer')
      ) {
        const xmlContent = zip.files[fileName].asText();
        
        let tMatch;
        tRegex.lastIndex = 0;
        while ((tMatch = tRegex.exec(xmlContent)) !== null) {
          const textNodeContent = tMatch[1];
          let mMatch;
          markerRegex.lastIndex = 0;
          while ((mMatch = markerRegex.exec(textNodeContent)) !== null) {
            markers.add(mMatch[1].trim());
          }
        }
      }
    });

    return Array.from(markers);
  } catch (error) {
    console.error('Error al extraer marcadores del archivo .docx:', error);
    throw new Error('No se pudo procesar la plantilla Word. Asegúrate de que sea un archivo .docx válido y que no tenga etiquetas dañadas.');
  }
}

/**
 * Reemplaza los marcadores en la plantilla Word y genera un nuevo archivo.
 * @param {ArrayBuffer} arrayBuffer - El buffer de bytes del archivo Word original.
 * @param {Object} data - Objeto de datos con correspondencias (ej. { FECHA: "...", AREA1: "..." }).
 * @returns {Blob} El archivo generado listo para descarga.
 */
export function generateDocument(arrayBuffer, data) {
  try {
    const zip = new PizZip(arrayBuffer);
    
    // Limpiar archivos XML internos antes de procesar
    cleanZipXmlFiles(zip);
    
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: {
        start: '{',
        end: '}'
      }
    });

    // Inyectar datos en la plantilla
    doc.setData(data);

    // Compilar el documento
    doc.render();

    // Exportar el documento como un Blob
    const out = doc.getZip().generate({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    return out;
  } catch (error) {
    console.error('Error al renderizar el documento Word:', error);
    throw error;
  }
}
