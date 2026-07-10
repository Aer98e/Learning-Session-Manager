import { supabase } from './supabase.js';

/**
 * Obtener todos los ciclos ordenados por nombre.
 */
export async function getCycles() {
  const { data, error } = await supabase
    .from('cycles')
    .select('id, name')
    .order('name', { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Obtener las edades asociadas a un ciclo específico.
 */
export async function getAgesByCycle(cycleId) {
  const { data, error } = await supabase
    .from('ages')
    .select('id, name')
    .eq('cycle_id', cycleId)
    .order('name', { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Obtener todas las áreas curriculares.
 */
export async function getAreas() {
  const { data, error } = await supabase
    .from('areas')
    .select('id, name, learning_curriculum_id')
    .order('name', { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Obtener las competencias (skills) de un área curricular específica.
 */
export async function getSkillsByArea(areaId) {
  const { data, error } = await supabase
    .from('skills')
    .select('id, name, description')
    .eq('area_id', areaId)
    .order('name', { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Obtener las capacidades (abilities) de una competencia.
 */
export async function getAbilitiesBySkill(skillId) {
  const { data, error } = await supabase
    .from('abilities')
    .select('id, name')
    .eq('skill_id', skillId)
    .order('name', { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Obtener el estándar de aprendizaje correspondiente a una competencia y ciclo específicos.
 */
export async function getStandardBySkillAndCycle(skillId, cycleId) {
  const { data, error } = await supabase
    .from('standards')
    .select('description')
    .eq('skill_id', skillId)
    .eq('cycle_id', cycleId)
    .maybeSingle();

  if (error) throw error;
  return data ? data.description : '';
}

/**
 * Obtener los desempeños (performances) para una competencia y edad/grado específicos.
 */
export async function getPerformancesBySkillAndAge(skillId, ageId) {
  const { data, error } = await supabase
    .from('performances')
    .select('id, description')
    .eq('skill_id', skillId)
    .eq('age_id', ageId)
    .order('description', { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Obtener la lista de momentos guardados en el catálogo de un usuario.
 */
export async function getMyMoments(userId) {
  const { data, error } = await supabase
    .from('moments')
    .select('id, title, moments_data')
    .eq('user_id', userId)
    .order('title', { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Obtener o crear un propósito de aprendizaje global en base al área y competencia.
 */
export async function getOrCreatePurpose(areaId, skillId) {
  // Intentar buscar el propósito existente
  const { data: existing, error: selectError } = await supabase
    .from('learning_purposes')
    .select('id')
    .eq('area_id', areaId)
    .eq('skill_id', skillId)
    .maybeSingle();
  
  if (selectError) throw selectError;
  if (existing) return existing.id;

  // Si no existe, crearlo
  const { data: inserted, error: insertError } = await supabase
    .from('learning_purposes')
    .insert([{ area_id: areaId, skill_id: skillId }])
    .select('id')
    .single();

  if (insertError) {
    // Control de condiciones de carrera (si otro usuario lo creó concurrentemente)
    if (insertError.code === '23505') {
      const { data: retry, error: retryError } = await supabase
        .from('learning_purposes')
        .select('id')
        .eq('area_id', areaId)
        .eq('skill_id', skillId)
        .single();
      if (retryError) throw retryError;
      return retry.id;
    }
    throw insertError;
  }
  return inserted.id;
}

/**
 * Obtener la lista de sesiones del docente.
 */
export async function getSessions(userId) {
  const { data, error } = await supabase
    .from('learning_sessions')
    .select('id, title, session_date, created_at')
    .eq('user_id', userId)
    .order('session_date', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Eliminar una sesión de aprendizaje (las claves foráneas en cascada limpian los hijos).
 */
export async function deleteSession(sessionId) {
  const { error } = await supabase
    .from('learning_sessions')
    .delete()
    .eq('id', sessionId);

  if (error) throw error;
  return true;
}

/**
 * Cargar el detalle completo de una sesión (con componentes, propósitos y momentos).
 */
export async function getSessionDetails(sessionId) {
  const { data, error } = await supabase
    .from('learning_sessions')
    .select(`
      id,
      title,
      session_date,
      components_sessions (
        id,
        title,
        type,
        order_index,
        purpose_components_session (
          purpose_id,
          learning_purposes (
            id,
            area_id,
            skill_id
          )
        ),
        performance_components_session (
          performance_id
        ),
        moment_components_session (
          order_index,
          moment_id,
          moments (
            id,
            title,
            moments_data
          )
        )
      )
    `)
    .eq('id', sessionId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Guardar o actualizar una sesión de aprendizaje completa y sus relaciones.
 */
export async function saveSession(userId, sessionData) {
  let sessionId = sessionData.id;
  const sessionRow = {
    user_id: userId,
    title: sessionData.title,
    session_date: sessionData.session_date,
    updated_at: new Date().toISOString()
  };

  // 1. Guardar la sesión diaria base
  if (sessionId) {
    const { error: updateError } = await supabase
      .from('learning_sessions')
      .update(sessionRow)
      .eq('id', sessionId);
    if (updateError) throw updateError;
  } else {
    const { data: insertedSession, error: insertError } = await supabase
      .from('learning_sessions')
      .insert([sessionRow])
      .select('id')
      .single();
    if (insertError) throw insertError;
    sessionId = insertedSession.id;
  }

  // 2. Si es edición, eliminamos los componentes anteriores (cascade borrará relaciones)
  if (sessionData.id) {
    const { error: deleteComponentsError } = await supabase
      .from('components_sessions')
      .delete()
      .eq('session_id', sessionId);
    if (deleteComponentsError) throw deleteComponentsError;
  }

  // 3. Insertar componentes y sus relaciones
  for (const component of sessionData.components) {
    // a. Insertar el componente de sesión
    const { data: insertedComp, error: compError } = await supabase
      .from('components_sessions')
      .insert([{
        session_id: sessionId,
        title: component.title || '',
        type: component.type,
        order_index: component.order_index
      }])
      .select('id')
      .single();

    if (compError) throw compError;
    const componentId = insertedComp.id;

    // b. Vincular propósito si está configurado
    if (component.area_id && component.skill_id) {
      const purposeId = await getOrCreatePurpose(component.area_id, component.skill_id);
      
      const { error: purposeRelError } = await supabase
        .from('purpose_components_session')
        .insert([{
          component_id: componentId,
          purpose_id: purposeId
        }]);
      if (purposeRelError) throw purposeRelError;

      // c. Vincular desempeños seleccionados
      if (component.performances && component.performances.length > 0) {
        const perfRows = component.performances.map(perfId => ({
          component_id: componentId,
          performance_id: perfId
        }));
        
        const { error: perfError } = await supabase
          .from('performance_components_session')
          .insert(perfRows);
        if (perfError) throw perfError;
      }
    }

    // d. Vincular momentos
    for (const mom of component.moments) {
      let momentId = mom.id;

      // Si es un momento nuevo, validamos catálogo
      if (!momentId) {
        // Buscar si ya existe un momento idéntico
        const { data: existingMom, error: momError } = await supabase
          .from('moments')
          .select('id')
          .eq('user_id', userId)
          .eq('title', mom.title)
          .eq('moments_data', JSON.stringify(mom.moments_data))
          .maybeSingle();

        if (momError) throw momError;

        if (existingMom) {
          momentId = existingMom.id;
        } else {
          // Insertar en biblioteca
          const { data: insertedMom, error: insertMomError } = await supabase
            .from('moments')
            .insert([{
              user_id: userId,
              title: mom.title,
              moments_data: mom.moments_data
            }])
            .select('id')
            .single();

          if (insertMomError) throw insertMomError;
          momentId = insertedMom.id;
        }
      }

      // Crear enlace de momento en la sesión
      const { error: momRelError } = await supabase
        .from('moment_components_session')
        .insert([{
          component_id: componentId,
          moment_id: momentId,
          order_index: mom.order_index
        }]);

      if (momRelError) throw momRelError;
    }
  }

  return sessionId;
}

