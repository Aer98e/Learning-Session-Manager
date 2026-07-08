-- Tablas optimizadas para Supabase (PostgreSQL) usando tipo INT

-- 1. Tabla: learning_curriculums (usando guion bajo para compatibilidad SQL)
create table if not exists learning_curriculums (
    id int generated always as identity primary key,
    name varchar(100) not null unique,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Tabla: areas (relacionada con learning_curriculums)
create table if not exists areas (
    id int generated always as identity primary key,
    learning_curriculum_id int not null references learning_curriculums(id) on delete cascade,
    name varchar(100) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    constraint unique_area_per_curriculum unique (learning_curriculum_id, name) -- Único por currículo
);

-- 3. Tabla: skills (relacionada con areas)
create table if not exists skills (
    id int generated always as identity primary key,
    area_id int not null references areas(id) on delete cascade,
    name varchar(100) not null,
    description text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    constraint unique_skill_per_area unique (area_id, name) -- Único por área
);

-- 4. Tabla: abilities (relacionada con skills)
create table if not exists abilities (
    id int generated always as identity primary key,
    skill_id int not null references skills(id) on delete cascade,
    name varchar(100) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    constraint unique_ability_per_skill unique (skill_id, name) -- Único por competencia
);

-- 5. Tabla: cycles
create table if not exists cycles (
    id int generated always as identity primary key,
    name varchar(100) not null unique,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Tabla: ages (relacionada con cycles)
create table if not exists ages (
    id int generated always as identity primary key,
    name varchar(100) not null,
    cycle_id int not null references cycles(id) on delete cascade,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    constraint unique_age_per_cycle unique (cycle_id, name) -- Único por ciclo
);

-- 7. Tabla: performances (relacionada con skills y ages)
create table if not exists performances (
    id int generated always as identity primary key,
    skill_id int not null references skills(id) on delete cascade,
    age_id int not null references ages(id) on delete cascade,
    description text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 8. Tabla: standards (relaciona skills y cycles para estándares de aprendizaje por ciclo)
create table if not exists standards (
    id int generated always as identity primary key,
    skill_id int not null references skills(id) on delete cascade,
    cycle_id int not null references cycles(id) on delete cascade,
    description text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    constraint unique_standard_per_skill_cycle unique (skill_id, cycle_id)
);

-- Habilitación de RLS (Row Level Security) para Supabase
alter table learning_curriculums enable row level security;
alter table areas enable row level security;
alter table skills enable row level security;
alter table abilities enable row level security;
alter table cycles enable row level security;
alter table ages enable row level security;
alter table performances enable row level security;
alter table standards enable row level security;

-- Ejemplo de políticas básicas de lectura (opcional, descomentar si es necesario)
-- alter table learning_curriculums create policy "Permitir lectura pública" on learning_curriculums for select using (true);
-- alter table areas create policy "Permitir lectura pública" on areas for select using (true);
-- alter table skills create policy "Permitir lectura pública" on skills for select using (true);
-- alter table abilities create policy "Permitir lectura pública" on abilities for select using (true);
-- alter table cycles create policy "Permitir lectura pública" on cycles for select using (true);
-- alter table ages create policy "Permitir lectura pública" on ages for select using (true);
-- alter table performances create policy "Permitir lectura pública" on performances for select using (true);