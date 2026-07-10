import { supabase } from '../api/supabase.js';

/**
 * Orquesta la recolección de textos curriculares y genera la impresión del PDF.
 */
export async function printSessionPDF(sessionDetails) {
  try {
    const formattedDate = new Date(sessionDetails.session_date).toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC'
    });

    // 1. Obtener información de usuario (docente) para la cabecera
    const { data: { user } } = await supabase.auth.getUser();
    const userName = user?.user_metadata?.name || user?.user_metadata?.full_name || user?.email || 'Docente';

    // 2. Procesar cada componente pedagógico en paralelo para enriquecerlo con textos curriculares
    const enrichedComponents = await Promise.all(
      sessionDetails.components_sessions.map(async (comp) => {
        // Datos curriculares a recuperar
        let areaName = '';
        let skillName = '';
        let standardText = '';
        let abilities = [];
        let performances = [];

        // Obtener el propósito si está asociado
        const purpose = comp.purpose_components_session?.[0]?.learning_purposes;
        if (purpose) {
          // a. Obtener Área
          const { data: areaData } = await supabase
            .from('areas')
            .select('name')
            .eq('id', purpose.area_id)
            .single();
          areaName = areaData?.name || '';

          // b. Obtener Competencia
          const { data: skillData } = await supabase
            .from('skills')
            .select('name')
            .eq('id', purpose.skill_id)
            .single();
          skillName = skillData?.name || '';

          // c. Obtener Capacidades
          const { data: abData } = await supabase
            .from('abilities')
            .select('name')
            .eq('skill_id', purpose.skill_id)
            .order('name', { ascending: true });
          abilities = abData?.map(a => a.name) || [];
        }

        // d. Obtener Desempeños seleccionados y deducir ciclo/edad
        const selectedPerfIds = comp.performance_components_session?.map(p => p.performance_id) || [];
        if (selectedPerfIds.length > 0) {
          const { data: perfData } = await supabase
            .from('performances')
            .select('description, age_id, ages(cycle_id)')
            .in('id', selectedPerfIds);

          performances = perfData?.map(p => p.description) || [];

          // e. Deducir ciclo para el Estándar
          const firstPerf = perfData?.[0];
          if (firstPerf && purpose) {
            const cycleId = firstPerf.ages?.cycle_id;
            if (cycleId) {
              const { data: stdData } = await supabase
                .from('standards')
                .select('description')
                .eq('skill_id', purpose.skill_id)
                .eq('cycle_id', cycleId)
                .maybeSingle();
              standardText = stdData?.description || '';
            }
          }
        }

        // f. Formatear momentos del componente (v9)
        const sortedMoments = (comp.moment_components_session || [])
          .sort((a, b) => a.order_index - b.order_index)
          .map(m => ({
            title: m.moments?.title || '',
            moments_data: m.moments?.moments_data || []
          }));

        return {
          ...comp,
          areaName,
          skillName,
          standardText,
          abilities,
          performances,
          moments: sortedMoments
        };
      })
    );

    // 3. Renderizar el HTML para la vista de impresión
    renderPrintHTML(sessionDetails.title, formattedDate, userName, enrichedComponents);

    // 4. Disparar impresión nativa del navegador
    setTimeout(() => {
      window.print();
    }, 250);

  } catch (error) {
    console.error('Error al generar impresión:', error);
    throw error;
  }
}

/**
 * Construye e inyecta la estructura HTML de impresión en el contenedor designado.
 */
function renderPrintHTML(sessionTitle, sessionDate, teacherName, components) {
  const container = document.getElementById('printPreviewSection');
  container.innerHTML = ''; // Limpiar previo

  // Título e info general
  let html = `
    <div class="print-page-wrapper">
      <header class="print-header">
        <div class="print-header-top">
          <!-- Logo visual corporativo idéntico al PDF de referencia -->
          <div class="print-logo-circle">
            <span class="logo-emoji">🎨</span>
          </div>
          <div class="print-header-titles">
            <h1 class="print-main-title">“${sessionTitle.toUpperCase()}”</h1>
            <p class="print-meta-info"><strong>Docente:</strong> ${teacherName}</p>
            <p class="print-meta-info"><strong>Fecha:</strong> ${sessionDate}</p>
          </div>
        </div>
      </header>
  `;

  // Renderizar componentes secuencialmente
  components.forEach((comp) => {
    const isTaller = comp.type === 'taller';

    // Si es Taller, agregamos un separador destacado con su título
    if (isTaller) {
      html += `
        <div class="print-taller-banner">
          <h2>“${(comp.title || 'TALLER').toUpperCase()}”</h2>
        </div>
      `;
    }

    // Bloque de Propósitos de Aprendizaje
    if (comp.skillName) {
      html += `
        <table class="print-table print-purposes-table">
          <thead>
            <tr>
              <th colspan="2">Propósitos de aprendizaje:</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="col-label"><strong>Área:</strong></td>
              <td>${comp.areaName.toUpperCase()}</td>
            </tr>
            <tr>
              <td class="col-label"><strong>Competencia:</strong></td>
              <td>${comp.skillName}</td>
            </tr>
            ${comp.standardText ? `
            <tr>
              <td class="col-label"><strong>Estándar:</strong></td>
              <td class="text-justify">${comp.standardText}</td>
            </tr>` : ''}
            ${comp.abilities.length > 0 ? `
            <tr>
              <td class="col-label"><strong>Capacidades:</strong></td>
              <td>
                <ul class="print-bullet-list">
                  ${comp.abilities.map(ab => `<li>${ab}</li>`).join('')}
                </ul>
              </td>
            </tr>` : ''}
            ${comp.performances.length > 0 ? `
            <tr>
              <td class="col-label"><strong>Desempeños:</strong></td>
              <td class="text-justify">
                <ul class="print-bullet-list">
                  ${comp.performances.map(perf => `<li>${perf}</li>`).join('')}
                </ul>
              </td>
            </tr>` : ''}
          </tbody>
        </table>
      `;
    }

    // Tabla de Momentos de este Componente (v9 consolidado)
    if (comp.moments.length > 0) {
      html += `
        <table class="print-table print-moments-table">
          <thead>
            <tr>
              <th style="width: 20%;">MOMENTOS</th>
              <th style="width: 12%;">TIEMPO</th>
              <th style="width: 43%;">APLICACIÓN</th>
              <th style="width: 25%;">RECURSOS</th>
            </tr>
          </thead>
          <tbody>
            ${comp.moments.map(mom => {
              // Formatear rango horario de múltiples bloques
              const timeHtml = mom.moments_data && mom.moments_data.length > 0
                ? mom.moments_data.map(tr => `${tr.start_time} – ${tr.end_time}${tr.subtitle ? `<br><span style="font-size:7.5pt;font-weight:normal;color:#4a5568;">(${tr.subtitle})</span>` : ''}`).join('<br>')
                : '';

              // Formatear aplicación estructurada en subsecciones
              const appHtml = mom.moments_data && mom.moments_data.length > 0
                ? mom.moments_data.map(sub => {
                    return sub.application.map(sec => `
                      ${sub.subtitle || sec.section_title ? `
                        <p style="margin:0.25rem 0 0.15rem 0;font-size:8.5pt;font-weight:700;color:#2d3748;">
                          ${sub.subtitle ? `${sub.subtitle.toUpperCase()}` : ''}
                          ${sub.subtitle && sec.section_title ? ` - ` : ''}
                          ${sec.section_title ? `${sec.section_title}` : ''}:
                        </p>
                      ` : ''}
                      <ul class="print-bullet-list">
                        ${sec.items.map(item => `<li>${item}</li>`).join('')}
                      </ul>
                    `).join('');
                  }).join('')
                : '';

              // Formatear recursos asociados por subsección de aplicación
              const resHtml = mom.moments_data && mom.moments_data.length > 0
                ? mom.moments_data.map(sub => {
                    return sub.application.map(sec => {
                      if (!sec.resources || sec.resources.length === 0) return '';
                      return `
                        ${sub.subtitle || sec.section_title ? `
                          <p style="margin:0.25rem 0 0.15rem 0;font-size:8pt;font-weight:700;color:#4a5568;">
                            ${sub.subtitle ? `${sub.subtitle.toUpperCase()}` : ''}
                            ${sub.subtitle && sec.section_title ? ` - ` : ''}
                            ${sec.section_title ? `${sec.section_title}` : ''}:
                          </p>
                        ` : ''}
                        <ul class="print-bullet-list">
                          ${sec.resources.map(res => `<li>${res}</li>`).join('')}
                        </ul>
                      `;
                    }).join('');
                  }).join('')
                : '';

              return `
              <tr>
                <td class="moment-title-cell font-semibold">${mom.title.toUpperCase()}</td>
                <td class="center-text">${timeHtml}</td>
                <td>${appHtml}</td>
                <td>${resHtml}</td>
              </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
    }
  });

  html += `
    </div>
  `;

  container.innerHTML = html;
}
