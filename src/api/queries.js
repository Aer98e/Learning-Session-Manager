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
