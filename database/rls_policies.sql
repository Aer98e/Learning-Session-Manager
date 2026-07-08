-- Políticas de Seguridad a Nivel de Fila (RLS) para Supabase
-- Este script habilita RLS y permite lectura pública (SELECT de forma anónima) en todas las tablas.

-- 1. Tabla: learning_curriculums
alter table learning_curriculums enable row level security;
drop policy if exists "Permitir lectura pública en learning_curriculums" on learning_curriculums;
create policy "Permitir lectura pública en learning_curriculums" 
on learning_curriculums for select 
using (true);

-- 2. Tabla: areas
alter table areas enable row level security;
drop policy if exists "Permitir lectura pública en areas" on areas;
create policy "Permitir lectura pública en areas" 
on areas for select 
using (true);

-- 3. Tabla: skills
alter table skills enable row level security;
drop policy if exists "Permitir lectura pública en skills" on skills;
create policy "Permitir lectura pública en skills" 
on skills for select 
using (true);

-- 4. Tabla: abilities
alter table abilities enable row level security;
drop policy if exists "Permitir lectura pública en abilities" on abilities;
create policy "Permitir lectura pública en abilities" 
on abilities for select 
using (true);

-- 5. Tabla: cycles
alter table cycles enable row level security;
drop policy if exists "Permitir lectura pública en cycles" on cycles;
create policy "Permitir lectura pública en cycles" 
on cycles for select 
using (true);

-- 6. Tabla: ages
alter table ages enable row level security;
drop policy if exists "Permitir lectura pública en ages" on ages;
create policy "Permitir lectura pública en ages" 
on ages for select 
using (true);

-- 7. Tabla: performances
alter table performances enable row level security;
drop policy if exists "Permitir lectura pública en performances" on performances;
create policy "Permitir lectura pública en performances" 
on performances for select 
using (true);

-- 8. Tabla: standards
alter table standards enable row level security;
drop policy if exists "Permitir lectura pública en standards" on standards;
create policy "Permitir lectura pública en standards" 
on standards for select 
using (true);
