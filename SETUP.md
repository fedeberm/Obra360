# Obra360 — Guía de Setup

## 1. Instalar Node.js

Bajalo desde: https://nodejs.org/en/download  
Elegí la versión **LTS (22.x)**. Instalá con el .pkg de macOS y reiniciá la terminal.

Verificar instalación:
```bash
node --version   # debe mostrar v22.x
npm --version    # debe mostrar 10.x
```

---

## 2. Crear cuenta en Supabase

1. Ir a https://supabase.com y crear cuenta gratuita
2. Crear un nuevo proyecto (elegí región **South America** para latencia)
3. Guardar la contraseña del proyecto

---

## 3. Configurar la base de datos

En el dashboard de Supabase → **SQL Editor** → pegá y ejecutá todo el contenido de:
```
supabase/migrations/001_initial_schema.sql
```

Esto crea todas las tablas, políticas de seguridad, y los buckets de storage.

---

## 4. Obtener las credenciales de Supabase

En el dashboard → **Settings** → **API**:
- Copiá el **Project URL** (ej: `https://abcdefgh.supabase.co`)
- Copiá el **anon public key**
- Copiá el **service_role secret key** (bajo "Service Role")

---

## 5. Configurar variables de entorno

En la carpeta del proyecto, copiá el archivo de ejemplo:
```bash
cp .env.local.example .env.local
```

Editá `.env.local` con tus datos:
```
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 6. Instalar dependencias y ejecutar

Abrí una terminal en la carpeta `obra360`:
```bash
cd ~/Desktop/obra360
npm install
npm run dev
```

Luego abrí http://localhost:3000 en el browser.

---

## 7. Crear tu primera cuenta

1. Abrí http://localhost:3000/auth/register
2. Completá nombre, email y contraseña
3. ¡Listo! Ya podés crear proyectos.

---

## 8. Deploy en producción (Vercel)

1. Subí el proyecto a GitHub (creá un repo privado)
2. Importalo en https://vercel.com
3. En la configuración del proyecto en Vercel, agregá las mismas variables de entorno
4. En `NEXT_PUBLIC_APP_URL` poné la URL de Vercel que te asignaron
5. Deploy automático con cada push

---

## Configuración de Storage en Supabase

El script SQL ya crea los buckets. Si necesitás ajustar manualmente:

**Dashboard → Storage:**
- `pdfs` → Privado (solo el equipo)
- `photos360` → Público (para que los clientes vean las fotos)

---

## Plan de uso y costos estimados

| Servicio | Plan | Costo |
|----------|------|-------|
| Vercel | Hobby (gratis) | $0/mes |
| Supabase | Free (500MB DB, 1GB storage) | $0/mes |
| Supabase | Pro (si superás 1GB de fotos) | $25/mes |

Con fotos de 15-20MB cada una, el límite de 1GB de Supabase Free cubre ~50-60 fotos.
Para proyectos reales, recomendamos el plan Pro ($25/mes = 100GB de storage).

---

## Estructura del proyecto

```
obra360/
├── src/
│   ├── app/
│   │   ├── auth/login          → Login del equipo
│   │   ├── auth/register       → Registro del equipo
│   │   ├── dashboard/          → Panel del equipo
│   │   │   └── project/[id]   → Detalle del proyecto
│   │   └── share/[token]       → Vista pública para clientes
│   ├── components/
│   │   ├── dashboard/          → Cards y dialogs del dashboard
│   │   ├── floor-plan/         → Visor del plano y panel de puntos
│   │   ├── project/            → Gestión de plantas y sharing
│   │   ├── viewer/             → Visor 360 equirectangular
│   │   └── ui/                 → Componentes base (shadcn/ui)
│   └── lib/
│       ├── actions/            → Server actions (proyectos, plantas, puntos)
│       └── supabase/           → Clientes de Supabase
└── supabase/
    └── migrations/             → SQL para crear la DB
```
