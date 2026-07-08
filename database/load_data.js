const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Validar variables de entorno
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey || supabaseUrl.includes('your-project-id')) {
  console.error('\x1b[31m%s\x1b[0m', 'Error: Configura SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el archivo .env primero.');
  process.exit(1);
}

// Crear cliente de Supabase (usamos la service role key para saltarse políticas RLS en la carga de semillas)
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false
  }
});

// Cache local para IDs de ciclos y edades para optimizar consultas
const ageCache = {}; // clave: "cicloName_ageName" => valor: ageId
const cycleCache = {}; // clave: "cicloName" => valor: cycleId

async function getOrCreateCycle(name) {
  if (cycleCache[name]) return cycleCache[name];

  const { data, error } = await supabase
    .from('cycles')
    .insert({ name })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') { // unique_violation en Postgres
      const { data: existing, error: selectError } = await supabase
        .from('cycles')
        .select('id')
        .eq('name', name)
        .single();
      if (selectError) throw selectError;
      cycleCache[name] = existing.id;
      return existing.id;
    }
    throw error;
  }
  cycleCache[name] = data.id;
  return data.id;
}

async function getOrCreateAge(cycleId, cycleName, ageName) {
  const cacheKey = `${cycleName}_${ageName}`;
  if (ageCache[cacheKey]) return ageCache[cacheKey];

  const { data, error } = await supabase
    .from('ages')
    .insert({ cycle_id: cycleId, name: ageName })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      const { data: existing, error: selectError } = await supabase
        .from('ages')
        .select('id')
        .eq('cycle_id', cycleId)
        .eq('name', ageName)
        .single();
      if (selectError) throw selectError;
      ageCache[cacheKey] = existing.id;
      return existing.id;
    }
    throw error;
  }
  ageCache[cacheKey] = data.id;
  return data.id;
}

async function getOrCreateCurriculum(name) {
  const { data, error } = await supabase
    .from('learning_curriculums')
    .insert({ name })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      const { data: existing, error: selectError } = await supabase
        .from('learning_curriculums')
        .select('id')
        .eq('name', name)
        .single();
      if (selectError) throw selectError;
      return existing.id;
    }
    throw error;
  }
  return data.id;
}

async function getOrCreateArea(curriculumId, name) {
  const { data, error } = await supabase
    .from('areas')
    .insert({ learning_curriculum_id: curriculumId, name })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      const { data: existing, error: selectError } = await supabase
        .from('areas')
        .select('id')
        .eq('learning_curriculum_id', curriculumId)
        .eq('name', name)
        .single();
      if (selectError) throw selectError;
      return existing.id;
    }
    throw error;
  }
  return data.id;
}

async function getOrCreateSkill(areaId, name, description) {
  const { data, error } = await supabase
    .from('skills')
    .insert({ area_id: areaId, name, description })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      const { data: existing, error: selectError } = await supabase
        .from('skills')
        .select('id')
        .eq('area_id', areaId)
        .eq('name', name)
        .single();
      if (selectError) throw selectError;
      
      // Actualizar descripción si ha cambiado
      const { error: updateError } = await supabase
        .from('skills')
        .update({ description })
        .eq('id', existing.id);
      if (updateError) throw updateError;

      return existing.id;
    }
    throw error;
  }
  return data.id;
}

async function createStandardIfNotExists(skillId, cycleId, description) {
  const { data: existing, error: selectError } = await supabase
    .from('standards')
    .select('id')
    .eq('skill_id', skillId)
    .eq('cycle_id', cycleId)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) {
    const { error: updateError } = await supabase
      .from('standards')
      .update({ description })
      .eq('id', existing.id);
    if (updateError) throw updateError;
    return existing.id;
  }

  const { data, error } = await supabase
    .from('standards')
    .insert({ skill_id: skillId, cycle_id: cycleId, description })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

async function getOrCreateAbility(skillId, name) {
  const { data, error } = await supabase
    .from('abilities')
    .insert({ skill_id: skillId, name })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      const { data: existing, error: selectError } = await supabase
        .from('abilities')
        .select('id')
        .eq('skill_id', skillId)
        .eq('name', name)
        .single();
      if (selectError) throw selectError;
      return existing.id;
    }
    throw error;
  }
  return data.id;
}

async function createPerformanceIfNotExists(skillId, ageId, description) {
  // En PostgreSQL no pusimos constraint unique en performances para description, 
  // así que verificamos manualmente si ya existe para evitar duplicar en re-ejecuciones.
  const { data: existing, error: selectError } = await supabase
    .from('performances')
    .select('id')
    .eq('skill_id', skillId)
    .eq('age_id', ageId)
    .eq('description', description)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return existing.id;

  const { data, error } = await supabase
    .from('performances')
    .insert({ skill_id: skillId, age_id: ageId, description })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

async function main() {
  console.log('\x1b[36m%s\x1b[0m', '🚀 Iniciando carga de datos en Supabase...');

  const seedDataDir = path.join(__dirname, 'seed_data');

  // 1. Cargar ciclos y edades
  const cyclesPath = path.join(seedDataDir, 'cycles_and_ages.json');
  if (!fs.existsSync(cyclesPath)) {
    console.error('\x1b[31m%s\x1b[0m', `Error: No se encontró el archivo cycles_and_ages.json en ${seedDataDir}`);
    process.exit(1);
  }

  console.log('\x1b[33m%s\x1b[0m', '⚙️  Cargando ciclos y edades...');
  const cyclesData = JSON.parse(fs.readFileSync(cyclesPath, 'utf8'));

  for (const cycle of cyclesData.cycles) {
    const cycleId = await getOrCreateCycle(cycle.name);
    console.log(`- Ciclo registrado: ${cycle.name} (ID: ${cycleId})`);
    
    for (const age of cycle.ages) {
      const ageId = await getOrCreateAge(cycleId, cycle.name, age.name);
      console.log(`  └─ Edad registrada: ${age.name} (ID: ${ageId})`);
    }
  }

  // 2. Buscar y cargar archivos de áreas (.json)
  const files = fs.readdirSync(seedDataDir);
  const areaFiles = files.filter(f => 
    f.endsWith('.json') && 
    f !== 'cycles_and_ages.json'
  );

  if (areaFiles.length === 0) {
    console.log('\x1b[33m%s\x1b[0m', '⚠️  No se encontraron archivos de áreas para procesar.');
    return;
  }

  console.log('\x1b[33m%s\x1b[0m', `📂 Procesando ${areaFiles.length} archivos de áreas...`);

  for (const file of areaFiles) {
    const filePath = path.join(seedDataDir, file);
    console.log('\x1b[32m%s\x1b[0m', `\n📄 Cargando área desde archivo: ${file}...`);
    
    const areaData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    const curriculumId = await getOrCreateCurriculum(areaData.learning_curriculum_name);
    const areaId = await getOrCreateArea(curriculumId, areaData.area_name);
    console.log(`  Área: "${areaData.area_name}" bajo el currículo "${areaData.learning_curriculum_name}"`);

    for (const skill of areaData.skills) {
      const skillId = await getOrCreateSkill(areaId, skill.name, skill.description);
      console.log(`  ├─ Competencia: "${skill.name}"`);

      // Registrar el Estándar en la tabla 'standards' para los ciclos asociados
      const uniqueCycles = [...new Set(skill.performances.map(p => p.cycle_name))];
      for (const cycleName of uniqueCycles) {
        const cycleId = cycleCache[cycleName];
        if (cycleId) {
          await createStandardIfNotExists(skillId, cycleId, skill.description);
          console.log(`  │  ├─ Estándar registrado para el Ciclo: "${cycleName}"`);
        } else {
          console.warn('\x1b[33m%s\x1b[0m', `  │  ⚠️  Advertencia: Ciclo "${cycleName}" no encontrado en caché de ciclos al registrar estándar.`);
        }
      }

      // Cargar capacidades (abilities)
      for (const ability of skill.abilities) {
        const abilityId = await getOrCreateAbility(skillId, ability.name);
        console.log(`  │  └─ Capacidad: "${ability.name}"`);
      }

      // Cargar desempeños (performances)
      let perfCount = 0;
      for (const perfGroup of skill.performances) {
        const cacheKey = `${perfGroup.cycle_name}_${perfGroup.age_name}`;
        const ageId = ageCache[cacheKey];

        if (!ageId) {
          console.warn('\x1b[33m%s\x1b[0m', `  │  ⚠️  Advertencia: No se encontró la edad "${perfGroup.age_name}" del ciclo "${perfGroup.cycle_name}" en la base de datos. Saltando este bloque.`);
          continue;
        }

        for (const desc of perfGroup.descriptions) {
          await createPerformanceIfNotExists(skillId, ageId, desc);
          perfCount++;
        }
      }
      console.log(`  │  └─ Desempeños cargados: ${perfCount} para esta competencia.`);
    }
  }

  console.log('\x1b[32m%s\x1b[0m', '\n✅ Carga de datos completada exitosamente.');
}

main().catch(err => {
  console.error('\x1b[31m%s\x1b[0m', '❌ Error crítico ejecutando el script de carga:');
  console.error(err);
  process.exit(1);
});
