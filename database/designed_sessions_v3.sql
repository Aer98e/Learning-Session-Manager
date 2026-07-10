-- 1. Tabla principal de Sesiones diarias
create table if not exists learning_sessions (
    id uuid default gen_random_uuid() primary key,
    user_id uuid not null references users(id) on delete cascade,
    title varchar(255) not null, -- Ej. "CONOCEMOS EL SONIDO FONÉTICO (U)"
    session_date date not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Componentes o Bloques Pedagógicos dentro de una sesión
create table if not exists components_sessions (
    id uuid default gen_random_uuid() primary key,
    session_id uuid not null references learning_sessions(id) on delete cascade,
    title varchar(255), -- Ej. "JUGAMOS A SER INIDEICITOS" para talleres, o vacío para la actividad principal
    type varchar(50) not null constraint chk_component_type check (type in ('principal', 'taller')),
    order_index int not null default 0
);

-- 3. Catálogo o Biblioteca de Propósitos de Aprendizaje globales (compartidos)
create table if not exists learning_purposes (
    id uuid default gen_random_uuid() primary key,
    area_id int not null references areas(id) on delete restrict,
    skill_id int not null references skills(id) on delete restrict,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    constraint unique_purpose_area_skill unique (area_id, skill_id) -- Evita duplicados en catálogo global
);

-- 4. Catálogo o Biblioteca de Momentos reutilizables (específico por docente)
create table if not exists moments (
    id uuid default gen_random_uuid() primary key,
    user_id uuid not null references users(id) on delete cascade,
    title varchar(255) not null, -- Ej. "RECEPCIÓN Y ACOGIDA", "DESARROLLO DE LA ACTIVIDAD"
    time_range varchar(50) not null, -- Ej. "8:30 – 9:40"
    application jsonb not null default '[]'::jsonb, -- Viñetas de aplicación
    resources jsonb not null default '[]'::jsonb, -- Viñetas de recursos
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- =========================================================================
-- TABLAS DE RELACIONES (CON COMPUESTAS PRIMARY KEYS PARA EVITAR DUPLICADOS)
-- =========================================================================

-- 5. Relación: Componente de Sesión con su Propósito de Aprendizaje
create table if not exists purpose_components_session (
    component_id uuid not null references components_sessions(id) on delete cascade,
    purpose_id uuid not null references learning_purposes(id) on delete cascade,
    primary key (component_id, purpose_id)
);

-- 6. Relación: Componente de Sesión con sus Desempeños evaluados
create table if not exists performance_components_session (
    component_id uuid not null references components_sessions(id) on delete cascade,
    performance_id int not null references performances(id) on delete cascade,
    primary key (component_id, performance_id)
);

-- 7. Relación: Componente de Sesión con sus Momentos de catálogo
create table if not exists moment_components_session (
    component_id uuid not null references components_sessions(id) on delete cascade,
    moment_id uuid not null references moments(id) on delete cascade,
    order_index int not null default 0,
    primary key (component_id, moment_id)
);

-- =========================================================================
-- HABILITACIÓN DE RLS Y POLÍTICAS DE SEGURIDAD EN SUPABASE
-- =========================================================================

alter table learning_sessions enable row level security;
alter table components_sessions enable row level security;
alter table learning_purposes enable row level security;
alter table moments enable row level security;
alter table purpose_components_session enable row level security;
alter table performance_components_session enable row level security;
alter table moment_components_session enable row level security;

-- Políticas para tablas base del usuario
create policy "Dueño CRUD en learning_sessions" on learning_sessions for all using (auth.uid() = user_id);
create policy "Dueño CRUD en moments" on moments for all using (auth.uid() = user_id);

-- Políticas para catálogo global de propósitos (lectura y creación libre)
create policy "Lectura pública en learning_purposes" on learning_purposes for select using (true);
create policy "Inserción pública en learning_purposes" on learning_purposes for insert with check (true);

-- Políticas RLS basadas en propiedad de la sesión padre
create policy "Dueño CRUD en components_sessions" on components_sessions for all using (
    exists (select 1 from learning_sessions ls where ls.id = session_id and ls.user_id = auth.uid())
);

create policy "Dueño CRUD en purpose_components_session" on purpose_components_session for all using (
    exists (
        select 1 from components_sessions cs
        join learning_sessions ls on ls.id = cs.session_id
        where cs.id = component_id and ls.user_id = auth.uid()
    )
);

create policy "Dueño CRUD en performance_components_session" on performance_components_session for all using (
    exists (
        select 1 from components_sessions cs
        join learning_sessions ls on ls.id = cs.session_id
        where cs.id = component_id and ls.user_id = auth.uid()
    )
);

create policy "Dueño CRUD en moment_components_session" on moment_components_session for all using (
    exists (
        select 1 from components_sessions cs
        join learning_sessions ls on ls.id = cs.session_id
        where cs.id = component_id and ls.user_id = auth.uid()
    )
);
