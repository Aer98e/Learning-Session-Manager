-- 1. Eliminar tablas antiguas de momentos y sus enlaces para migrar al esquema v5 unificado
drop table if exists moment_components_session cascade;
drop table if exists moments cascade;

-- 2. Recrear catálogo de Momentos con persistencia JSONB consolidada (moments_data)
create table if not exists moments (
    id uuid default gen_random_uuid() primary key,
    user_id uuid not null references users(id) on delete cascade,
    title varchar(255) not null,
    moments_data jsonb not null default '[]'::jsonb, -- Estructura jerárquica unificada de subhorarios, aplicaciones y recursos
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

-- Políticas de seguridad para momentos
create policy "Dueño CRUD en moments v5" on moments for all using (auth.uid() = user_id);

-- Políticas RLS basadas en propiedad de la sesión del componente
create policy "Dueño CRUD en moment_components_session v5" on moment_components_session for all using (
    exists (
        select 1 from components_sessions cs
        join learning_sessions ls on ls.id = cs.session_id
        where cs.id = component_id and ls.user_id = auth.uid()
    )
);
