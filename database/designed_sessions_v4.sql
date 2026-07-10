-- 1. Eliminar tablas antiguas de momentos y sus enlaces para migrar tipos a JSONB
drop table if exists moment_components_session cascade;
drop table if exists moments cascade;

-- 2. Recrear catálogo o biblioteca de Momentos reutilizables con múltiples rangos y subsecciones en JSONB
create table if not exists moments (
    id uuid default gen_random_uuid() primary key,
    user_id uuid not null references users(id) on delete cascade,
    title varchar(255) not null,
    time_ranges jsonb not null default '[]'::jsonb, -- Array de rangos: [{"start_time": "8:30", "end_time": "9:40", "subtitle": ""}]
    application jsonb not null default '[]'::jsonb, -- Array de secciones: [{"section_title": "Inicio", "items": ["..."]}]
    resources jsonb not null default '[]'::jsonb,  -- Array de recursos: ["Pañales", "Toallas"]
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Recrear tabla de enlace del Componente con sus Momentos
create table if not exists moment_components_session (
    component_id uuid not null references components_sessions(id) on delete cascade,
    moment_id uuid not null references moments(id) on delete cascade,
    order_index int not null default 0,
    primary key (component_id, moment_id)
);

-- =========================================================================
-- HABILITACIÓN DE RLS Y POLÍTICAS DE SEGURIDAD EN SUPABASE
-- =========================================================================

alter table moments enable row level security;
alter table moment_components_session enable row level security;

-- Políticas de seguridad para momentos (CRUD para el creador)
create policy "Dueño CRUD en moments v4" on moments for all using (auth.uid() = user_id);

-- Políticas RLS basadas en propiedad de la sesión del componente
create policy "Dueño CRUD en moment_components_session v4" on moment_components_session for all using (
    exists (
        select 1 from components_sessions cs
        join learning_sessions ls on ls.id = cs.session_id
        where cs.id = component_id and ls.user_id = auth.uid()
    )
);
