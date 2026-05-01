-- ═══════════════════════════════════════════════════════════════
-- TOMATEN-ARCHIV – Supabase Datenbankschema
-- Dieses Script im Supabase SQL-Editor ausführen
-- ═══════════════════════════════════════════════════════════════

-- 1. PROFILES Tabelle (erweitert die auth.users von Supabase)
CREATE TABLE IF NOT EXISTS public.profiles (
  id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email     TEXT,
  name      TEXT,
  role      TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. TOMATOES Tabelle
CREATE TABLE IF NOT EXISTS public.tomatoes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name              TEXT NOT NULL,
  year              INTEGER,
  source            TEXT,
  color             TEXT,
  size              TEXT,
  type              TEXT,
  taste             INTEGER CHECK (taste BETWEEN 1 AND 5),
  taste_notes       TEXT,
  harvest_rating    INTEGER CHECK (harvest_rating BETWEEN 1 AND 5),
  care_notes        TEXT,
  germination_days  INTEGER,
  harvest_days      INTEGER,
  diseases          TEXT,
  location          TEXT,
  image_url         TEXT,
  tags              TEXT[] DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- 3. Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tomatoes_updated_at
  BEFORE UPDATE ON public.tomatoes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 4. Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    'user'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ═══════════════════════════════════════════════════════════════
-- 5. ROW LEVEL SECURITY (RLS) – Zugriffskontrolle
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tomatoes ENABLE ROW LEVEL SECURITY;

-- Profiles: jeder sieht alle, nur eigenes bearbeiten
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Tomatoes: alle angemeldeten Nutzer lesen
CREATE POLICY "tomatoes_select" ON public.tomatoes
  FOR SELECT USING (auth.role() = 'authenticated');

-- Eintragen: alle angemeldeten Nutzer
CREATE POLICY "tomatoes_insert" ON public.tomatoes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Bearbeiten: eigene Einträge ODER Admin
CREATE POLICY "tomatoes_update" ON public.tomatoes
  FOR UPDATE USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Löschen: eigene Einträge ODER Admin
CREATE POLICY "tomatoes_delete" ON public.tomatoes
  FOR DELETE USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Admin darf Rollen ändern
CREATE POLICY "profiles_admin_update" ON public.profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ═══════════════════════════════════════════════════════════════
-- 6. STORAGE Bucket für Bilder
-- ═══════════════════════════════════════════════════════════════
-- Im Supabase Dashboard: Storage → New Bucket
-- Name: tomato-images
-- Public: JA (Haken setzen)
--
-- Danach diese Storage Policies ausführen:

INSERT INTO storage.buckets (id, name, public)
VALUES ('tomato-images', 'tomato-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "images_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'tomato-images' AND auth.role() = 'authenticated'
  );

CREATE POLICY "images_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'tomato-images');

CREATE POLICY "images_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'tomato-images' AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ═══════════════════════════════════════════════════════════════
-- FERTIG! Führe nun npm run dev aus und teste die App lokal.
-- ═══════════════════════════════════════════════════════════════
