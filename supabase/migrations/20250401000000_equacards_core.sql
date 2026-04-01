-- EquaCards: roles, user_roles, profiles, categories, cards, RBAC helpers, RLS, storage

-- ---------------------------------------------------------------------------
-- Roles (seeded)
-- ---------------------------------------------------------------------------
CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  sort_order int NOT NULL DEFAULT 0
);

INSERT INTO public.roles (slug, display_name, description, sort_order) VALUES
  ('admin', 'Administrator', 'Can manage flashcards and categories', 1),
  ('learner', 'Learner', 'Can study shared catalog', 2);

-- ---------------------------------------------------------------------------
-- Profiles (no role column)
-- ---------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- user_roles (many-to-many)
-- ---------------------------------------------------------------------------
CREATE TABLE public.user_roles (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.roles (id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX user_roles_user_id_idx ON public.user_roles (user_id);
CREATE INDEX roles_slug_idx ON public.roles (slug);

-- ---------------------------------------------------------------------------
-- New user: profile + default learner role
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  learner_role_id uuid;
BEGIN
  INSERT INTO public.profiles (id, display_name, updated_at)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    now()
  );

  SELECT r.id INTO learner_role_id FROM public.roles r WHERE r.slug = 'learner' LIMIT 1;
  IF learner_role_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (new.id, learner_role_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RBAC helpers (SECURITY DEFINER)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_has_role(_user_id uuid, _role_slug text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = _user_id AND r.slug = _role_slug
  );
$$;

CREATE OR REPLACE FUNCTION public.user_has_any_role(_user_id uuid, _slugs text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = _user_id AND r.slug = ANY (_slugs)
  );
$$;

CREATE OR REPLACE FUNCTION public.get_my_roles()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    array_agg(r.slug ORDER BY r.sort_order NULLS LAST, r.slug),
    ARRAY[]::text[]
  )
  FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.user_has_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_any_role(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_roles() TO authenticated;

-- ---------------------------------------------------------------------------
-- Categories & cards
-- ---------------------------------------------------------------------------
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX categories_sort_order_idx ON public.categories (sort_order);

CREATE TABLE public.cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.categories (id) ON DELETE RESTRICT,
  front_text text NOT NULL,
  answer text NOT NULL,
  image_url text,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cards_category_id_idx ON public.cards (category_id);

INSERT INTO public.categories (name, sort_order) VALUES
  ('General', 0),
  ('Dressage', 10),
  ('Jumping', 20);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

-- roles: readable by signed-in users (display / future admin UI)
CREATE POLICY roles_select_authenticated ON public.roles
  FOR SELECT TO authenticated
  USING (true);

-- user_roles: users see only their assignments
CREATE POLICY user_roles_select_own ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- profiles: own row
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- categories: read all authenticated; write admin
CREATE POLICY categories_select_authenticated ON public.categories
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY categories_write_admin ON public.categories
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_role(auth.uid(), 'admin'));

CREATE POLICY categories_update_admin ON public.categories
  FOR UPDATE TO authenticated
  USING (public.user_has_role(auth.uid(), 'admin'))
  WITH CHECK (public.user_has_role(auth.uid(), 'admin'));

CREATE POLICY categories_delete_admin ON public.categories
  FOR DELETE TO authenticated
  USING (public.user_has_role(auth.uid(), 'admin'));

-- cards: read all authenticated; write admin
CREATE POLICY cards_select_authenticated ON public.cards
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY cards_insert_admin ON public.cards
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_role(auth.uid(), 'admin'));

CREATE POLICY cards_update_admin ON public.cards
  FOR UPDATE TO authenticated
  USING (public.user_has_role(auth.uid(), 'admin'))
  WITH CHECK (public.user_has_role(auth.uid(), 'admin'));

CREATE POLICY cards_delete_admin ON public.cards
  FOR DELETE TO authenticated
  USING (public.user_has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- Storage: card images (public URLs; uploads restricted to admins)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('card-images', 'card-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY card_images_select_authenticated ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'card-images');

CREATE POLICY card_images_insert_admin ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'card-images'
    AND public.user_has_role(auth.uid(), 'admin')
  );

CREATE POLICY card_images_update_admin ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'card-images'
    AND public.user_has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    bucket_id = 'card-images'
    AND public.user_has_role(auth.uid(), 'admin')
  );

CREATE POLICY card_images_delete_admin ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'card-images'
    AND public.user_has_role(auth.uid(), 'admin')
  );
