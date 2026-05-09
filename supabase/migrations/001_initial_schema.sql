-- ============================================================
-- OBRA360 - Schema inicial
-- ============================================================

-- Extensiones necesarias
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES (extiende auth.users de Supabase)
-- ============================================================
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text not null,
  email text not null,
  role text not null default 'architect' check (role in ('admin', 'architect')),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles visibles para usuarios autenticados"
  on public.profiles for select
  using (auth.role() = 'authenticated');

create policy "Usuarios pueden actualizar su propio perfil"
  on public.profiles for update
  using (auth.uid() = id);

-- Trigger para crear perfil automáticamente al registrarse
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- PROJECTS
-- ============================================================
create table public.projects (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  address text,
  client_name text,
  client_email text,
  status text not null default 'active' check (status in ('active', 'completed', 'paused')),
  cover_image_url text,
  share_token text unique not null default encode(gen_random_bytes(16), 'hex'),
  share_enabled boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects enable row level security;

-- El equipo autenticado puede ver y gestionar todos los proyectos
create policy "Equipo puede ver proyectos"
  on public.projects for select
  using (auth.role() = 'authenticated');

create policy "Equipo puede crear proyectos"
  on public.projects for insert
  with check (auth.role() = 'authenticated');

create policy "Equipo puede actualizar proyectos"
  on public.projects for update
  using (auth.role() = 'authenticated');

create policy "Equipo puede eliminar proyectos"
  on public.projects for delete
  using (auth.role() = 'authenticated');

-- Acceso público por share_token
create policy "Acceso público por share_token"
  on public.projects for select
  using (share_enabled = true);

-- ============================================================
-- FLOORS (plantas / sectores por proyecto)
-- ============================================================
create table public.floors (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  description text,
  pdf_url text,
  pdf_filename text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.floors enable row level security;

create policy "Equipo puede gestionar floors"
  on public.floors for all
  using (auth.role() = 'authenticated');

create policy "Acceso público a floors de proyectos compartidos"
  on public.floors for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.share_enabled = true
    )
  );

-- ============================================================
-- CAMERA POINTS (puntos sobre el plano)
-- ============================================================
create table public.camera_points (
  id uuid primary key default uuid_generate_v4(),
  floor_id uuid not null references public.floors(id) on delete cascade,
  name text not null,
  description text,
  -- Posición como porcentaje del ancho/alto del plano (0-100)
  x_percent numeric(6,3) not null check (x_percent >= 0 and x_percent <= 100),
  y_percent numeric(6,3) not null check (y_percent >= 0 and y_percent <= 100),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.camera_points enable row level security;

create policy "Equipo puede gestionar camera_points"
  on public.camera_points for all
  using (auth.role() = 'authenticated');

create policy "Acceso público a camera_points de proyectos compartidos"
  on public.camera_points for select
  using (
    exists (
      select 1 from public.floors f
      join public.projects p on p.id = f.project_id
      where f.id = floor_id and p.share_enabled = true
    )
  );

-- ============================================================
-- PHOTO VISITS (fotos 360 por punto y fecha)
-- ============================================================
create table public.photo_visits (
  id uuid primary key default uuid_generate_v4(),
  camera_point_id uuid not null references public.camera_points(id) on delete cascade,
  photo_url text not null,
  photo_filename text,
  photo_size_bytes bigint,
  taken_at date not null default current_date,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.photo_visits enable row level security;

create policy "Equipo puede gestionar photo_visits"
  on public.photo_visits for all
  using (auth.role() = 'authenticated');

create policy "Acceso público a photo_visits de proyectos compartidos"
  on public.photo_visits for select
  using (
    exists (
      select 1 from public.camera_points cp
      join public.floors f on f.id = cp.floor_id
      join public.projects p on p.id = f.project_id
      where cp.id = camera_point_id and p.share_enabled = true
    )
  );

-- ============================================================
-- ÍNDICES para performance
-- ============================================================
create index idx_floors_project_id on public.floors(project_id);
create index idx_camera_points_floor_id on public.camera_points(floor_id);
create index idx_photo_visits_camera_point_id on public.photo_visits(camera_point_id);
create index idx_photo_visits_taken_at on public.photo_visits(taken_at desc);
create index idx_projects_share_token on public.projects(share_token);

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
-- Ejecutar esto en el Dashboard de Supabase > Storage:

-- Bucket: pdfs (privado, solo equipo)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pdfs',
  'pdfs',
  false,
  52428800, -- 50MB
  array['application/pdf']
) on conflict (id) do nothing;

-- Bucket: photos360 (público para visualización)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photos360',
  'photos360',
  true,
  104857600, -- 100MB
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
) on conflict (id) do nothing;

-- Políticas de storage para pdfs
create policy "Equipo puede subir PDFs"
  on storage.objects for insert
  with check (bucket_id = 'pdfs' and auth.role() = 'authenticated');

create policy "Equipo puede ver PDFs"
  on storage.objects for select
  using (bucket_id = 'pdfs' and auth.role() = 'authenticated');

create policy "Equipo puede eliminar PDFs"
  on storage.objects for delete
  using (bucket_id = 'pdfs' and auth.role() = 'authenticated');

-- Políticas de storage para fotos 360
create policy "Equipo puede subir fotos 360"
  on storage.objects for insert
  with check (bucket_id = 'photos360' and auth.role() = 'authenticated');

create policy "Fotos 360 son públicas"
  on storage.objects for select
  using (bucket_id = 'photos360');

create policy "Equipo puede eliminar fotos 360"
  on storage.objects for delete
  using (bucket_id = 'photos360' and auth.role() = 'authenticated');

-- ============================================================
-- FUNCIÓN: updated_at automático
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger handle_updated_at before update on public.profiles
  for each row execute procedure public.handle_updated_at();

create trigger handle_updated_at before update on public.projects
  for each row execute procedure public.handle_updated_at();

create trigger handle_updated_at before update on public.floors
  for each row execute procedure public.handle_updated_at();

create trigger handle_updated_at before update on public.camera_points
  for each row execute procedure public.handle_updated_at();
