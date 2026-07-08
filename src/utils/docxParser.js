import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

/**
 * Extrae todas las variables/marcadores (ej. FECHA, AREA1, etc.) de un archivo .docx.
 * @param {ArrayBuffer} arrayBuffer - El buffer de bytes del archivo Word.
 * @returns {string[]} Lista de nombres de marcadores encontrados.
 */
export function extractMarkers(arrayBuffer) {
  try {
    const zip = new PizZip(arrayBuffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });
    
    // doc.getVariables() analiza el XML del Word y retorna un objeto 
    // cuyas propiedades son los marcadores {{ ... }} encontrados.
    const variablesObj = doc.getVariables();
    return Object.keys(variablesObj).map(tag => tag.trim());
  } catch (error) {
    console.error('Error al extraer marcadores del archivo .docx:', error);
    throw new Error('No se pudo procesar la plantilla Word. Asegúrate de que sea un archivo .docx válido.');
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
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
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
