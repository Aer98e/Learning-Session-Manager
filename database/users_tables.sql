-- Tablas para gestión de usuarios y preferencias en Supabase (PostgreSQL)

-- 1. Tabla: users
-- Almacena información del perfil del usuario vinculada a auth.users de Supabase
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  email text UNIQUE,
  role text DEFAULT 'user' CONSTRAINT chk_role CHECK (role IN ('user', 'admin')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Tabla: user_preferences
-- Almacena las preferencias del usuario (tema y plantillas personalizadas)
CREATE TABLE IF NOT EXISTS user_preferences (
  id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme text CHECK (theme IN ('light','dark')) DEFAULT 'light',
  template jsonb DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilitación de RLS (Row Level Security)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- 3. Políticas RLS para la tabla: users
-- Permite que los usuarios lean su propio perfil
CREATE POLICY "Permitir lectura del propio perfil" ON users
  FOR SELECT
  USING (auth.uid() = id);

-- Permite que los usuarios actualicen su propio perfil (ej. cambiar nombre)
CREATE POLICY "Permitir actualización del propio perfil" ON users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 4. Políticas RLS para la tabla: user_preferences
-- Permite que los usuarios lean sus propias preferencias
CREATE POLICY "Permitir lectura de las propias preferencias" ON user_preferences
  FOR SELECT
  USING (auth.uid() = id);

-- Permite que los usuarios actualicen sus propias preferencias
CREATE POLICY "Permitir actualización de las propias preferencias" ON user_preferences
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Permite que los usuarios inserten sus propias preferencias (si no se crearan automáticamente por trigger)
CREATE POLICY "Permitir inserción de las propias preferencias" ON user_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 5. Trigger y Función: handle_new_auth_user
-- Se ejecuta automáticamente cuando se crea un nuevo usuario en auth.users
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS trigger 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name')
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      name = COALESCE(EXCLUDED.name, public.users.name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger en auth.users (si no existe)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_auth_user();

-- 6. Trigger y Función: handle_new_user
-- Se ejecuta automáticamente cuando se inserta un perfil en public.users
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_preferences (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger en public.users (si no existe)
DROP TRIGGER IF EXISTS on_user_created ON public.users;
CREATE TRIGGER on_user_created
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
