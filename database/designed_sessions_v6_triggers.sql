-- =========================================================================
-- AUTOCLEANUP DE MOMENTOS HUÉRFANOS (GARBAGE COLLECTOR) EN SUPABASE
-- =========================================================================
-- Este script crea la función y el trigger para limpiar automáticamente
-- los momentos que queden huérfanos (sin ninguna sesión ni componente 
-- de sesión que los apunte) tras una desvinculación por edición o borrado.

-- 1. Crear función para eliminar momentos huérfanos tras desvinculación
create or replace function cleanup_orphan_moments()
returns trigger as $$
begin
    delete from moments
    where id = old.moment_id
      and not exists (
          select 1 
          from moment_components_session 
          where moment_id = old.moment_id
      );
    return old;
end;
$$ language plpgsql security definer;

-- 2. Crear Trigger en la tabla de relación intermedia
drop trigger if exists trg_cleanup_orphan_moments on moment_components_session;

create trigger trg_cleanup_orphan_moments
after delete or update on moment_components_session
for each row
execute function cleanup_orphan_moments();
