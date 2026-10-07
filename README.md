# NOVA — Portal Institucional · Frontend

**NOVA** (Núcleo de Operaciones Virtuales Académicas) es la plataforma digital centralizada de la **Uniautónoma del Cauca**. Desarrollada en React + TypeScript + Vite, conectada a un backend Django REST Framework. Permite a ciudadanos acceder a servicios institucionales, radicar PQRSF, solicitar certificados y consultar el directorio de contactos; a funcionarios de área gestionar solicitudes; y a administradores supervisar y configurar el sistema completo.

---

## Tabla de contenidos

1. [Características principales](#características-principales)
2. [Stack tecnológico](#stack-tecnológico)
3. [Arquitectura del proyecto](#arquitectura-del-proyecto)
4. [Roles y permisos](#roles-y-permisos)
5. [Rutas de la aplicación](#rutas-de-la-aplicación)
6. [Módulos principales](#módulos-principales)
7. [Variables de entorno](#variables-de-entorno)
8. [Instalación y ejecución](#instalación-y-ejecución)
9. [Build para producción](#build-para-producción)
10. [Comunicación con el backend](#comunicación-con-el-backend)
11. [Modo offline / Mock](#modo-offline--mock)
12. [Scripts disponibles](#scripts-disponibles)
13. [Cambios recientes](#cambios-recientes)

---

## Características principales

- **Radicación de PQRSF** pública (ciudadano anónimo o autenticado), con adjunto de archivos y verificación reCAPTCHA.
- **Consulta de radicado** pública por número de radicado sin necesidad de cuenta.
- **Dashboard de ciudadano** para seguimiento de PQRSF propias.
- **Dashboard de área** para gestión de PQRSF asignadas a una dependencia.
- **Dashboard de administrador** con visión global: asignación, respuesta, escalamiento, SLA y estadísticas.
- **Gestión de áreas, roles y SLA** exclusiva para administradores.
- Protección de rutas basada en roles con redirección automática.
- Refresco silencioso de JWT (access + refresh token) sin cerrar sesión.
- Soporte para envío **anónimo** de PQRSF (campos de remitente opcionales).
- Animaciones fluidas con **Framer Motion** y retroalimentación con **Sonner toasts**.

---

## Stack tecnológico

| Categoría | Tecnología |
|---|---|
| Framework UI | React 19 + TypeScript |
| Build tool | Vite 6 |
| Estilos | Tailwind CSS v4 |
| Componentes base | Radix UI + shadcn/ui |
| Iconos | Lucide React + MUI Icons |
| Formularios | React Hook Form |
| Animaciones | Motion (Framer Motion) |
| Routing | React Router v7 (data router) |
| Notificaciones | Sonner |
| CAPTCHA | react-google-recaptcha |
| HTTP | Fetch nativo con wrapper centralizado |
| Backend | Django REST Framework (externo) |

---

## Arquitectura del proyecto

```
src/
├── main.tsx                   # Punto de entrada — monta <App />
└── app/
    ├── App.tsx                # Raíz: provee RouterProvider
    ├── routes.tsx             # Definición de rutas + guardias de acceso
    ├── context/
    │   └── AuthContext.tsx    # Estado global de autenticación (JWT + perfil)
    ├── lib/
    │   ├── api.ts             # Capa HTTP completa (todos los endpoints)
    │   ├── useTicketChat.ts   # Hook WebSocket para chat de ticket en tiempo real
    │   ├── useSpeech.ts       # Hooks `useTTS` (síntesis de voz) y `useSpeechToText` (reconocimiento de voz)
    │   ├── config.ts          # Variables de entorno centralizadas
    │   ├── utils.ts           # Helpers de formato y utilidades
    │   └── mockData.ts        # Datos de prueba para desarrollo
    ├── pages/
    │   ├── NovaLanding.tsx    # Landing page NOVA (carrusel hero, módulos, chatbot CTA)
    │   ├── Home.tsx           # Página PQRS (formulario de radicación)
    │   ├── Login.tsx          # Inicio de sesión
    │   ├── Register.tsx       # Registro de usuarios
    │   ├── Contactos.tsx      # Directorio público de contactos
    │   ├── PoliticaTratamientoDatos.tsx # Política de datos (pública)
    │   ├── PoliticaPQRS.tsx   # Política PQRS (pública)
    │   ├── Perfil.tsx         # Perfil del usuario autenticado
    │   ├── NotFound.tsx       # Página 404
    │   ├── pqrs/              # Módulo PQRS ciudadanas
    │   │   ├── CrearPQRS.tsx      # Formulario de radicación (autenticado)
    │   │   ├── ConsultaRadicado.tsx # Búsqueda pública por radicado
    │   │   ├── UserDashboard.tsx  # Panel del ciudadano
    │   │   ├── AdminDashboard.tsx # Panel del administrador
    │   │   └── RadicarPresencial.tsx # Formulario de radicación presencial/verbal para funcionarios de área
    │   ├── tickets/           # Módulo Tickets internos
    │   │   └── AreaDashboard.tsx  # Panel de la dependencia/área
    │   └── admin/             # Módulo Administración
    │       ├── GestionAreas.tsx   # CRUD de dependencias
    │       ├── GestionRoles.tsx   # Gestión de usuarios y roles
    │       ├── GestionSLA.tsx     # Configuración de SLA
    │       ├── GestionContactos.tsx # CRUD de contactos del directorio
    │       ├── GestionHeroImages.tsx # Gestión de imágenes del carrusel hero de NOVA
    │       └── GestionChatbot.tsx # Configuración del chatbot IA: datos institucionales, documentos RAG subidos y **fuentes web públicas** (agregar URL, re-extraer texto, activar/desactivar)
    ├── components/
    │   ├── layout/            # Navbar institucional y Layout wrapper
    │   ├── ui/                # Componentes base shadcn/ui (Radix wrapped)
    │   ├── tickets/           # Componentes específicos de tickets
    │   │   └── TicketChat.tsx     # Chat WebSocket para tickets internos
    │   ├── ChatBot.tsx        # Asistente virtual integrado con renderizado Markdown (negrillas, listas) y soporte RAG
    │   ├── VoiceFormWizard.tsx# Asistente de voz guiado (TTS + STT) para radicar PQRSF por voz
    │   ├── PageTransition.tsx # Wrapper de animaciones entre páginas
    │   ├── TerminosModal.tsx  # Modal de términos y condiciones
    │   └── DiagonalStripes.tsx# Decorativo de fondo
    └── styles/                # CSS global, fuentes y tema
```

---

## Roles y permisos

El sistema define tres roles derivados automáticamente del perfil del backend:

| Rol | Condición de asignación | Acceso |
|---|---|---|
| `admin` | `is_staff === true` | Panel admin, gestión de áreas/roles/SLA, todas las PQRSF |
| `area` | Tiene `dependency` asignada y no es staff | Panel de área, PQRSF de su dependencia |
| `usuario` | Ninguno de los anteriores (ciudadano) | Panel de usuario, sus propias PQRSF |

Las rutas protegidas usan el componente `ProtectedRoute` en [src/app/routes.tsx](src/app/routes.tsx) que redirige automáticamente según el rol activo.

---

## Rutas de la aplicación

| Ruta | Componente | Acceso |
|---|---|---|
| `/` | `NovaLanding` | Público — landing NOVA con carrusel hero |
| `/pqrs` | `Home` | Público — formulario de radicación PQRSF |
| `/login` | `Login` | Público (redirige si ya autenticado) |
| `/register` | `Register` | Público |
| `/consulta` | `ConsultaRadicado` | Público |
| `/crear-pqrs` | `CrearPQRS` | Autenticado |
| `/dashboard` | `UserDashboard` | Rol `usuario` |
| `/admin` | `AdminDashboard` | Rol `admin` |
| `/area` | `AreaDashboard` | Rol `area` |
| `/area/radicar-presencial` | `RadicarPresencial` | Rol `area` |
| `/admin/areas` | `GestionAreas` | Rol `admin` |
| `/admin/roles` | `GestionRoles` | Rol `admin` |
| `/admin/sla` | `GestionSLA` | Rol `admin` |
| `/gestion-contactos` | `GestionContactos` | Rol `admin` |
| `/gestion-hero` | `GestionHeroImages` | Rol `admin` |
| `/gestion-chatbot` | `GestionChatbot` | Rol `admin` |
| `/contactos` | `Contactos` | Público |
| `/politica-datos` | `PoliticaTratamientoDatos` | Público |
| `/politica-pqrs` | `PoliticaPQRS` | Público |
| `/perfil` | `Perfil` | Autenticado |
| `*` | `NotFound` | Público |

---

## Módulos principales

### `AuthContext` — [src/app/context/AuthContext.tsx](src/app/context/AuthContext.tsx)

Gestiona el ciclo de vida de la sesión:

- `access_token` se almacena en `sessionStorage` (no persiste entre pestañas ni al cerrar el navegador, reduciendo exposición XSS). `refresh_token` permanece en `localStorage`.
- Al iniciar, verifica el token y carga el perfil desde el backend. El backend siempre es **fuente de verdad** para roles y permisos; los valores de `localStorage` no elevan privilegios.
- Escucha el evento `auth:session-expired` (emitido por `apiFetch` al recibir un 401 irrecuperable) para limpiar sesión y redirigir al login de forma segura (sin `window.location.href`).
- `login()` y `loginWithGoogle()` retornan `{ ok, rol?, error? }` para que el componente de login pueda navegar al destino correcto sin leer `localStorage`.
- Expone `usuario`, `isAuthenticated`, `loading`, `login()`, `loginWithGoogle()`, `logout()` y `refreshPerfil()`.

### `api.ts` — [src/app/lib/api.ts](src/app/lib/api.ts)

Capa HTTP centralizada:

- **`tokens`**: helpers que almacenan el `access_token` en `sessionStorage` y el `refresh_token` en `localStorage`. `tokens.clear()` limpia ambos almacenamientos al cerrar sesión.
- `apiFetch<T>()`: wrapper con adjunto de JWT Bearer, refresco automático en 401, y ante fallo del refresco emite el evento `auth:session-expired` (en lugar de redirigir con `window.location.href`) para que `AuthContext` realice la navegación de forma segura dentro del router.
- `apiFetchBlob()`: variante especializada para respuestas binarias (`Blob`) con el mismo mecanismo de refresco, usada en la exportación de reportes.
- Endpoints de exportación: `apiExportCSV`, `apiExportExcel` (admin, todos las PQRSF) y `apiExportCSVArea`, `apiExportExcelArea` (área, PQRSF de la dependencia propia). Todos aceptan `ExportFilters` opcionales (estado, tipo, prioridad, fechas).
- Endpoints del chatbot IA: `apiChatBot()` (enviar mensaje), `apiGetChatBotConfig()` (leer configuración), `apiUpdateChatBotConfig()` (PATCH con `FormData`), `apiUploadChatBotDocuments()` (POST multi-archivo), `apiDeleteChatBotDocument(id)` (eliminar documento), `apiCreateChatBotWebSource(data)` (agregar fuente web), `apiUpdateChatBotWebSource(id, data)` (PATCH título/activo), `apiDeleteChatBotWebSource(id)` (eliminar fuente), `apiRefetchChatBotWebSource(id)` (re-extraer texto desde la URL). Tipos exportados: `ChatBotConfigAPI`, `ChatBotKnowledgeDocumentAPI`, `ChatBotWebSourceAPI`.
- Todos los endpoints del backend exportados como funciones nombradas: `apiLogin`, `apiCreatePQRS`, `apiListPQRS`, `apiAssignPQRS`, `apiRespondPQRS`, `apiEscalatePQRS`, `apiConsultarRadicado`, `apiGetDashboard`, `apiGetAttachments`, `apiUploadAttachment`, etc.
- `formatApiError()`: traduce errores de la API a mensajes legibles para el usuario.

### `AdminDashboard` — [src/app/pages/AdminDashboard.tsx](src/app/pages/AdminDashboard.tsx)

Panel completo para administradores con:

- Listado y filtrado de todas las PQRSF.
- Detalle con pestañas: **Responder**, **Asignar**, **Escalar**, **Historial**, **Adjuntos** (subir/descargar archivos adjuntos de la PQRS).
- Acciones: asignar dependencia/responsable, responder (CITIZEN / FINAL / INTERNAL), escalar a otra área, cambiar estado.
- Estadísticas de conteo por estado.
- **Vista Analytics** (toggle «Ver Analytics»): KPI cards, dona interactiva por estado, barras por tipo, área chart de tendencia diaria, barras horizontales por área, dona de prioridad, panel de comparativa temporal (mensual / año-vs-año / mes-vs-mes) con delta automático. Filtrado por período (7/30/90 días o todo). Métricas de SLA y perfil de solicitantes cargadas desde `apiGetDashboard`.
- **Panel de Exportación**: descarga de reportes CSV o Excel con filtros opcionales de estado, tipo, prioridad, rango de fechas y dependencia.
  - **CSV** → endpoint backend `apiExportCSV`.
  - **Excel** → generado íntegramente en el frontend con `exceljs` mediante `generateAdminReport` (`src/app/lib/generateAdminReport.ts`). Produce un workbook multi-hoja elaborado de 6 hojas: Portada, Resumen Ejecutivo, Tendencia Diaria, Detalle PQRS (con columnas Solicitante, Tipo Solicitante y Email), Por Dependencia, Tickets Internos.

### `Home` — [src/app/pages/Home.tsx](src/app/pages/Home.tsx)

Landing pública con modal de radicación inline:

- Formulario de envío de PQRSF sin necesidad de cuenta (anónimo).
- Validación reCAPTCHA (bypass automático en entorno local).
- Aceptación de términos y condiciones (modal con links a **Política de Datos** y **Política PQRS**).
- Bajo el checkbox de términos: micro-links directos a `/politica-datos` y `/politica-pqrs`.
- Soporte para adjuntar archivos.
- Muestra el número de radicado generado al completarse.

### `AreaDashboard` — [src/app/pages/AreaDashboard.tsx](src/app/pages/AreaDashboard.tsx)

> _Actualizado el 2026-05-19._

Panel de gestión de PQRSF para funcionarios de dependencia/área. Permite visualizar, filtrar y responder las PQRSF asignadas a la dependencia del usuario autenticado.

- **Vista Analytics** (toggle «Ver Gráficas»): KPI cards, dona interactiva por estado, barras por tipo, área chart de tendencia diaria, dona de prioridad. Filtrado por período (7/30/90 días).
- **Panel de Exportación**: descarga de reportes CSV o Excel del área propia.
  - **CSV** → endpoint backend `apiExportCSVArea` con filtros opcionales (estado, tipo, prioridad, fechas).
  - **Excel** → generado íntegramente en el frontend con `exceljs` mediante `generateAreaReport` (`src/app/lib/generateAreaReport.ts`). Produce un workbook multi-hoja elaborado (ver sección [Reporte Excel elaborado](#reporte-excel-elaborado)).
- **Bitácora de actividades**: sección colapsable «Bitácora» en el panel de detalle de cada PQRS. Carga lazy vía `apiGetActivities` al expandir el panel; muestra cada evento con badge de color e ícono según tipo, fecha y autor. Incluye botón «Actualizar» para recargar.
- **Notificaciones en tiempo real (campana)**: polling global cada 10 s via `apiGetTicketActivityFeed`. Al recibir actividad nueva de otro usuario, muestra un toast y acumula el contador en la campana. Las notificaciones tienen TTL de 1 hora y un máximo de 200 entradas; se limpian automáticamente cada 5 minutos.
- **Hilo unificado del ticket**: pestaña "Hilo" combina comentarios, notas internas y eventos de sistema en una única línea temporal cronológica. Los eventos (cambio de estado, asignación, escalación, SLA) se renderizan como píldoras centradas coloreadas por tipo; los comentarios y notas internas se renderizan como tarjetas con avatar. El hilo hace auto-scroll al mensaje más reciente al abrirse o al recibir mensajes nuevos.

#### Estrategia de carga de datos

La función `cargarPQRS` utiliza `Promise.allSettled` para ejecutar dos consultas en paralelo:

1. **Consulta primaria** — PQRSF filtradas por el campo `dependency` del usuario.
2. **Consulta secundaria** — Lista global de asignaciones activas (falla silenciosamente si el endpoint no está disponible).

Las PQRSF referenciadas en asignaciones pero ausentes de la consulta primaria se recuperan de forma individual. El resultado final se **desduplicha por `id`** y se ordena de más reciente a más antigua.

#### Estados del componente

| Estado | Tipo | Descripción |
|---|---|---|
| `pqrsList` | `PqrsAPI[]` | Lista completa de PQRSF asignadas al área |
| `selected` | `PqrsAPI \| null` | PQRS actualmente abierta en el panel de detalle |
| `loading` | `boolean` | Indica si la carga/recarga está en curso |
| `submitting` | `boolean` | Indica si el formulario de respuesta está enviándose |
| `filtroEstado` | `string` | Filtro de estado activo (`"todos"` muestra todas) |
| `pqrsActivities` | `PQRSActivity[]` | Actividades de la PQRS seleccionada (bitácora) |
| `pqrsActivitiesLoading` | `boolean` | Indica si la bitácora está cargando |
| `showBitacora` | `boolean` | Controla la visibilidad del panel de bitácora |

#### Funciones principales

| Función | Descripción |
|---|---|
| `cargarPQRS()` | Carga (o recarga) todas las PQRSF del área con la estrategia de 3 pasos |
| `onResponder(data)` | Registra la respuesta/nota y opcionalmente cambia el estado de la PQRS |
| `openDetail(p)` | Abre el panel de detalle de una PQRS; resetea adjuntos y bitácora |
| `getStatusBadge(status)` | Genera una etiqueta visual coloreada según el código de estado (`RAD`, `PRO`, `RES`, `CER`) |
| `contactName(p)` | Resuelve el nombre del remitente con fallback: usuario registrado → anónimo → `"Anónimo"` |

#### Tipos de respuesta (`response_type`)

| Valor | Descripción |
|---|---|
| `CITIZEN` | Respuesta dirigida al ciudadano |
| `FINAL` | Respuesta final / cierre del caso |
| `INTERNAL` | Nota interna (no visible para el ciudadano) |

#### Layout responsivo

- **Escritorio (≥ 1024 px):** columna izquierda con la lista + columna derecha fija de 440 px para el detalle.
- **Móvil (< 1024 px):** lista y panel de detalle se alternan; al abrir detalle se bloquea el scroll del `body`.

### `Login` — [src/app/pages/Login.tsx](src/app/pages/Login.tsx)

Página de inicio de sesión con dos vías:

1. **Credenciales clásicas** (usuario + contraseña). Bloqueo temporal de 30 s tras 5 intentos fallidos consecutivos.
2. **OAuth 2.0 con Google** vía `@react-oauth/google` y el componente `<GoogleLogin />`. Al recibir el `id_token` de Google, lo envía a `apiGoogleLogin` en el backend para validar y obtener los tokens JWT propios.
- Soporte del parámetro `?redirect=` para redirigir al destino original tras el inicio de sesión.

### `GestionAreas` — [src/app/pages/GestionAreas.tsx](src/app/pages/GestionAreas.tsx)

CRUD de dependencias/áreas organizacionales. Solo accesible por administradores.

- Crear, editar, activar/desactivar y eliminar áreas.
- Modal **"Gestionar Usuarios"** — asigna `user.dependency` (membresía organizacional). Muestra banner informativo: esta acción **no** otorga acceso a PQRSF.
- Modal **"Encargados PQRS"** — crea registros `DependencyManager` via `POST /api/pqrs/dependencies/{depId}/managers/`. Esta es la única acción que concede visibilidad sobre las PQRSF del área. Al asignar, también actualiza `user.dependency` para que el frontend detecte el rol `"area"`. Al desactivar, limpia `user.dependency` si el usuario ya no tiene managers activos.

### `GestionRoles` — [src/app/pages/GestionRoles.tsx](src/app/pages/GestionRoles.tsx)

Gestión de usuarios y roles del sistema. Solo accesible por administradores.

- Listado de todos los usuarios registrados.
- Capacidad de promover/revocar privilegios de staff (`is_staff`) para conceder o retirar el rol `admin`.
- Visualización del rol actual derivado de cada perfil.

### `GestionSLA` — [src/app/pages/GestionSLA.tsx](src/app/pages/GestionSLA.tsx)

Configuración de los Acuerdos de Nivel de Servicio (SLA) por tipo de PQRSF. Solo accesible por administradores.

- Listado y edición de los plazos máximos de respuesta para cada tipo (Petición, Queja, Reclamo, Sugerencia, Felicitación).
- Los valores configurados son utilizados por el backend para calcular vencimientos y alertas de SLA.

### `index.html`

- `lang="es"`, `translate="no"` y `<meta name="google" content="notranslate">` para prevenir el error `removeChild` causado por extensiones de traducción que modifican el DOM fuera del ciclo de React.
- Cabeceras HTTP de seguridad vía meta tags: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Content-Security-Policy`.

Página de gestión del perfil del usuario autenticado, accesible en `/perfil`. Vinculada desde el nombre de usuario en la Navbar.

- **Pestaña «Datos personales»**: edición de nombre, apellido, nombre de usuario, teléfono, dirección y ciudad mediante `apiUpdatePerfil`.
- **Pestaña «Cambiar contraseña»**: validación de contraseña actual y nueva (con confirmación) mediante `apiChangePassword`.
- Recarga automática del perfil en `AuthContext` tras guardar.

---

## Variables de entorno

Crear un archivo `.env.local` en la raíz del proyecto:

```env
# URL base de la API Django (sin barra final)
VITE_API_URL=http://localhost:8000

# Deshabilitar reCAPTCHA en desarrollo local (false en producción)
VITE_DISABLE_CAPTCHA=false

# Site key de Google reCAPTCHA v2 (requerido en producción)
VITE_RECAPTCHA_SITE_KEY=your_site_key_here

# Client ID de Google OAuth 2.0 (requerido para "Iniciar con Google")
VITE_GOOGLE_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
```

> En producción omitir `VITE_DISABLE_CAPTCHA` o establecerlo en `false`.  
> `VITE_GOOGLE_CLIENT_ID` se obtiene desde [Google Cloud Console](https://console.cloud.google.com/) → Credenciales → OAuth 2.0.

---

## Instalación y ejecución

### Requisitos previos

- Node.js ≥ 18
- npm ≥ 9
- Backend Django corriendo en `http://localhost:8000` (o la URL configurada en `VITE_API_URL`)

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/DavidM3-M/App_PQRSF_ft.git
cd "Sistema PQRS Institucional"

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env.local   # editar con los valores correctos

# 4. Iniciar el servidor de desarrollo
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`.

---

## Build para producción

```bash
npm run build
```

Los archivos compilados se generan en `dist/`. Servir con cualquier servidor estático (Nginx, served, Vercel, etc.).

---

## Comunicación con el backend

El frontend espera un backend Django REST Framework con los siguientes prefijos de endpoint:

| Prefijo | Descripción |
|---|---|
| `/api/login/` | Autenticación JWT |
| `/api/token/refresh/` | Refresco de access token |
| `/api/users/` | Registro y perfil de usuarios |
| `/api/pqrs/` | CRUD y acciones sobre PQRSF |
| `/api/dependencies/` | Gestión de dependencias/áreas |
| `/api/sla/` | Configuración de SLA |
| `ws(s)://<host>/ws/tickets/<id>/` | WebSocket de chat por ticket (Django Channels + Daphne) |

Todas las peticiones autenticadas incluyen el header `Authorization: Bearer <access_token>`. El refresco de token es transparente para el usuario. La conexión WebSocket autentica mediante `?token=<access_jwt>` en la query string.

---

## Modo offline / Mock

Cuando el backend **no está disponible** (error de red `TypeError`), la aplicación activa automáticamente un modo de datos locales definido en `mockData.ts`:

- **Login / Registro**: valida contra usuarios precargados en `SEED_USERS` y datos guardados en `localStorage`.
- **Perfil**: devuelve el perfil almacenado en `mock_profile`.
- El token `mock_access_offline` identifica la sesión como offline y evita intentos de refresco al backend.
- Las lecturas de `localStorage` están envueltas en `try/catch` con limpieza automática ante datos corruptos.

---

## Scripts disponibles

| Script | Descripción |
|---|---|
| `npm run dev` | Inicia el servidor de desarrollo (Vite HMR) en `http://localhost:5173` |
| `npm run build` | Verifica tipos TypeScript y compila para producción en `dist/` |
| `npm run typecheck` | Verificación de tipos TypeScript sin emitir archivos |

---

## Cambios recientes

### 2026-04-17 — Radicación presencial y verbal desde el panel de área

#### Descripción

Los funcionarios de área ahora pueden registrar PQRS que llegan físicamente o de forma verbal a la institución, sin requerir que el ciudadano realice el trámite en línea.

#### Nuevos archivos

**`src/app/pages/pqrs/RadicarPresencial.tsx`**

Formulario completo para radicación en nombre de un ciudadano:

- Selección de canal de ingreso: **Presencial** o **Verbal** (radio buttons).
- Sección de datos del ciudadano: nombre, apellido, tipo de documento, número de documento, email, teléfono, ciudad — todos opcionales.
- Sección de detalles PQRS: tipo, prioridad, asunto, descripción, adjuntos.
- Header con nombre del funcionario y dependencia activa.
- Modal de confirmación con número de radicado generado + botón copiar al portapapeles.
- Envía `canal_ingreso: "PRESENCIAL" | "VERBAL"` junto con los datos del ciudadano como campos anónimos.

#### Cambios en archivos existentes

| Archivo | Cambio |
|---|---|
| `src/app/lib/api.ts` | `PqrsAPI`: nuevos campos `canal_ingreso`, `canal_ingreso_display`, `registrado_por_nombre`. `CreatePqrsPayload`: nuevo campo `canal_ingreso`. Nueva constante `PQRS_CANAL_LABEL`. |
| `src/app/routes.tsx` | Nueva ruta `area/radicar-presencial` protegida con guardia `areaOnly`. |
| `src/app/pages/tickets/AreaDashboard.tsx` | El botón "Radicar Presencial / Verbal" (icono `FilePlus`) ya existía; apunta a la nueva ruta. |

#### Flujo de uso

1. Iniciar sesión como usuario de área.
2. En el panel `/area`, hacer clic en **"Radicar Presencial / Verbal"**.
3. Seleccionar canal (Presencial / Verbal).
4. Completar los datos del ciudadano (opcionales) y los detalles de la PQRS.
5. Enviar → se muestra el número de radicado generado.

---

### 2026-04-10 — Asistente de voz para radicación de PQRSF + lectura en voz alta

#### Descripción

Se añade un flujo completo de accesibilidad por voz al sistema: el ciudadano puede radicar una PQRSF íntegramente mediante habla (sin tocar el teclado), y cualquier usuario puede activar la lectura en voz alta de la página actual. Implementado con las APIs nativas del navegador (`speechSynthesis` y `SpeechRecognition`) — sin dependencias externas, sin costos de API de terceros.

#### Nuevos archivos

**`src/app/lib/useSpeech.ts`**

Hooks de accesibilidad para síntesis y reconocimiento de voz:

- `useTTS()` — Text-to-Speech con `window.speechSynthesis`. Selección inteligente de voz española (preferencia: Google ES-419 → Google ES → voz ES nativa del SO). Retorna `{ read, stop, isReading, supported }`.
- `useSpeechToText()` — Speech-to-Text con `SpeechRecognition` (Chrome/Edge). Retorna `{ startListening, stopListening, isListening, supported }`.
- Manejo de bug de Chrome: `SpeechRecognition.start()` solo se puede llamar desde un gesto directo del usuario.

**`src/app/components/VoiceFormWizard.tsx`**

Asistente conversacional guiado para radicar una PQRSF íntegramente por voz:

- Flujo paso a paso: tipo PQRSF → prioridad → asunto → descripción → (opcional) datos del remitente anónimo → confirmación.
- Cada pregunta se lee en voz alta (TTS). El usuario responde oralmente (STT). Las respuestas se parsean con tolerancia a variantes y sinónimos en español.
- Confirmación final por voz (`"sí" / "afirmativo" / "correcto"` / …) con opción de envío automático.
- Flujo de estados: `boot → asking → ready → listening → confirm → summary → yn_ready → yn_listening → done`.
- Compatible con `isAnonymous` y `skipFields` para reutilización en distintos contextos.
- Animaciones con Framer Motion.

#### Cambios en archivos existentes

| Archivo | Cambio |
|---|---|
| `src/app/pages/pqrs/CrearPQRS.tsx` | Botón micrófono en campos **Asunto** y **Descripción** para dictado inline (`useSpeechToText`). Botón «Radicar por voz» que lanza `VoiceFormWizard` si TTS + STT están disponibles. Al completar el wizard, los valores se transfieren al formulario vía `setValue` y opcionalmente se envía automáticamente. |
| `src/app/pages/Home.tsx` | Botón «Radicar por voz» en el formulario público de la landing. Integración con `VoiceFormWizard`. |
| `src/app/components/AccessibilityWidget.tsx` | Nueva sección **«Lectura en voz alta»** en el widget de accesibilidad. Usa `useTTS` para leer `document.body.innerText`; toggle Leer/Detener con feedback visual. Solo se muestra si `speechSynthesis` está disponible. |
| `nginx.conf` | Ajuste menor de headers de caché. |

#### Soporte de navegadores

| Función | Chrome | Edge | Firefox | Safari |
|---|---|---|---|---|
| TTS (`speechSynthesis`) | ✅ | ✅ | ✅ | ✅ |
| STT (`SpeechRecognition`) | ✅ | ✅ | ⚠️ limitado | ⚠️ limitado |

El botón «Radicar por voz» solo se muestra si **ambas** APIs están disponibles (`voiceWizardSupported`). El botón de dictado inline solo aparece si `SpeechRecognition` está disponible. La lectura en voz alta solo aparece si `speechSynthesis` está disponible.

---

### 2026-04-07 — Gestión de Chatbot IA + Base de conocimiento RAG

#### Descripción

Se añade la página `/gestion-chatbot` (solo admin) que permite configurar el asistente virtual y subir/eliminar documentos de conocimiento (PDF, DOCX). El backend aplica recuperación RAG con chunk-level scoring sin embeddings para responder consultas basadas en los documentos.

#### Cambios frontend

| Archivo | Cambio |
|---|---|
| `src/app/pages/admin/GestionChatbot.tsx` | **Nuevo** — formulario de configuración (nombre, prompt, avatar, activo) + gestión de documentos (lista, subida multi-archivo, eliminar) |
| `src/app/lib/api.ts` | Nuevas funciones `apiGetChatBotConfig`, `apiUpdateChatBotConfig`, `apiUploadChatBotDocuments`, `apiDeleteChatBotDocument`. Nuevos tipos `ChatBotConfigAPI`, `ChatBotKnowledgeDocumentAPI` |
| `src/app/routes.tsx` | Ruta `/gestion-chatbot` protegida con rol `admin` |
| Navbar | Enlace «Chatbot» en menú de administración |

#### Cambios backend

| Archivo | Cambio |
|---|---|
| `pqrs/models/chatbot_config.py` | `ChatBotConfig` (singleton), `ChatBotKnowledgeDocument`, `_normalize_text()`, extracción automática PyPDF2/python-docx |
| `pqrs/views/chatbot.py` | RAG chunk-level: `_chunk_text()`, `_tokenize()` con stop-words, `_select_relevant_documents()` (top-5, 5 000 chars) |
| `pqrs/views/chatbot_config.py` | **Nuevo** — 3 vistas admin para configuración y documentos |
| `pqrs/serializers/chatbot_config.py` | **Nuevo** — serializadores de config y documentos |
| `pqrs/urls.py` | `chatbot-config/`, `chatbot-config/documents/`, `chatbot-config/documents/<id>/` |

---

### 2026-03-27 — Chatbot IA integrado (Groq + Gemini)

#### Descripción

Se integra un asistente virtual con inteligencia artificial al sistema PQRS. El chatbot usa **Groq (Llama 3.3 70B)** como proveedor principal y **Google Gemini** como fallback. El frontend envía mensajes a un endpoint Django que actúa como proxy, manteniendo el historial de conversación y usando prompts específicos por sección.

#### Cambios

| Archivo | Cambio |
|---|---|
| `src/app/components/ChatBot.tsx` | Integración con API real: llamadas a `apiChatBot()`, estado de carga con spinner `Loader2`, auto-scroll al último mensaje, input habilitado en todas las secciones, fallback de error |
| `src/app/lib/api.ts` | Nueva función `apiChatBot()` + tipos `ChatSection`, `ChatMessage`, `ChatBotResponse`. Endpoint: `POST /api/pqrs/chatbot/` (sin autenticación) |

#### Cambios en backend

| Archivo | Cambio |
|---|---|
| `pqrs/views/chatbot.py` | **Nuevo** — `ChatBotView` con soporte dual Groq/Gemini, prompts por sección (info, documentos, comunicados, atención), throttle 20/min |
| `pqrs/urls.py` | Ruta `chatbot/` registrada |
| `pqrs/views/__init__.py` | Export de `ChatBotView` |
| `APP-PQRSF-BACKEND/settings.py` | Settings `GROQ_API_KEY`, `GROQ_MODEL`, `GEMINI_API_KEY`, `GEMINI_MODEL`, throttle `chatbot` |
| `requirements.txt` | Dependencias `groq>=1.0.0`, `google-genai>=1.0.0` |

---

### 2026-03-26 — Reporte Excel elaborado para administrador

#### Descripción

Se implementa un generador de Excel multi-hoja para el dashboard de administrador, análogo al del área. Se genera completamente en el frontend con `exceljs`. Incluye columna "Tipo Solicitante" (Identificado / Anónimo) basada en la presencia de nombre del solicitante, y resolución correcta de dependencias y nombres de solicitantes (registrados y anónimos).

#### Hojas generadas

| Hoja | Contenido |
|---|---|
| **Portada** | Banda institucional, metadatos (usuario, fecha, período) y 8 tarjetas KPI |
| **Resumen Ejecutivo** | Distribución por Estado / Tipo / Prioridad con barras Unicode, SLA, comparativa temporal |
| **Tendencia Diaria** | Serie día a día (90 días): Nuevas, Resueltas, Acumuladas |
| **Detalle PQRS** | Listado completo con colores por estado, Solicitante, **Tipo Solicitante** (Identificado/Anónimo), Email, Dependencia, SLA, auto-filter y freeze |
| **Por Dependencia** | Desglose por cada dependencia asignada: tabla de distribución + listado |
| **Tickets Internos** | Todos los tickets del sistema con resumen estadístico |

#### Cambios

| Archivo | Cambio |
|---|---|
| `src/app/lib/generateAdminReport.ts` | **Nuevo** — Generador Excel multi-hoja para admin (6 hojas) |
| `src/app/lib/api.ts` | Añadidos `dependency_names`, `submitter`, `submitter_email`, `is_anonymous` a `PqrsAPI` |
| `src/app/pages/pqrs/AdminDashboard.tsx` | Importa `generateAdminReport`; carga tickets on-demand; filtro por dependencia; botón "Descargar Excel Elaborado" |

#### Cambios en backend (serializer + vista)

| Archivo | Cambio |
|---|---|
| `pqrs/serializers/pqrs.py` | `PQRSListaSerializer`: añadidos campos `submitter`, `submitter_email`, `dependency_names` (SerializerMethodField) |
| `pqrs/views/pqrs.py` | `PQRSListaView.get_queryset()`: añadido Prefetch de asignaciones activas con `select_related('dependency')` y `prefetch_related('dependencies')` |

---

### 2026-03-26 — GestionSLA: formulario en modal + corrección de `is_business_days`

#### Descripción

El formulario de creación/edición de políticas SLA se convierte de un Card inline deslizable a un **Dialog modal** (Radix UI). Además se corrige la interfaz `SLAPolicy` para reflejar el campo `is_business_days` que ahora el backend serializa correctamente.

#### Cambios

| Archivo | Cambio |
|---|---|
| `GestionSLA.tsx` | Formulario migrado de `<Card>` inline a `<Dialog>` modal. El botón "Nueva Política" permanece siempre visible. El modal se cierra con la X, clic en overlay o botón "Cancelar". Botones del formulario usan `<DialogFooter>` |
| `api.ts` | Actualización de la interfaz `SLAPolicy` y funciones de API SLA |
| `AreaDashboard.tsx` | Mejoras en el panel de área |

#### Detalle técnico

- Imports: `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter` desde `components/ui/dialog`
- Se removieron imports no usados: `CardDescription`, `X` (lucide)
- Estado `showForm` ahora controla `<Dialog open={showForm}>` en lugar de un renderizado condicional de `<Card>`
- `onOpenChange` del Dialog llama a `handleCancelForm()` al cerrar, reseteando el formulario y `editingPolicy`

---

### 2026-03-25 — Previsualización de PDFs con react-pdf (PDF.js)

#### Descripción

Se reemplazó el visor de PDFs basado en `<object>` / `<iframe>` (bloqueado por headers de seguridad `X-Frame-Options: DENY` y restricciones de blob URL del navegador) por un renderizado nativo en canvas usando **react-pdf** (PDF.js).

#### Cambios

| Archivo | Cambio |
|---|---|
| `package.json` | Nueva dependencia: `react-pdf@10.4.1` (incluye `pdfjs-dist@5.4.x`) |
| `AreaDashboard.tsx` | Nuevo componente `PdfPreview` que renderiza cada página del PDF en un `<canvas>` |
| `AreaDashboard.tsx` | El fetch de adjuntos PDF ahora guarda los bytes crudos (`Uint8Array`) en estado `previewPdfData` en vez de crear una blob URL |
| `AreaDashboard.tsx` | Las imágenes siguen usando blob URL con MIME type forzado |
| `AreaDashboard.tsx` | Padding del header del modal ajustado (`pl-5 pr-12`) para evitar superposición entre el botón "Descargar" y el botón X de cerrar |

#### Detalles técnicos

- **Worker PDF.js**: se carga desde `node_modules/pdfjs-dist/build/pdf.worker.min.mjs` vía `new URL(…, import.meta.url)` (compatible con Vite).
- **Datos directos**: el PDF se pasa como `{ data: Uint8Array }` a `<Document>`, evitando blob URLs que pueden ser bloqueadas por CSP o headers de seguridad.
- **Responsive**: el componente `PdfPreview` usa `ResizeObserver` para adaptar el ancho de las páginas al contenedor.
- **Scroll por páginas**: todas las páginas del PDF se renderizan secuencialmente con scroll vertical.

---

### 2026-03-25 — Reestructuración modular: separación Tickets / PQRS / Admin

#### Descripción

Reorganización de carpetas para separar las páginas por módulo funcional, preparando la base para independizar el módulo de Tickets del de PQRS.

#### Cambios estructurales

| Antes | Después |
|---|---|
| `pages/CrearPQRS.tsx` | `pages/pqrs/CrearPQRS.tsx` |
| `pages/ConsultaRadicado.tsx` | `pages/pqrs/ConsultaRadicado.tsx` |
| `pages/UserDashboard.tsx` | `pages/pqrs/UserDashboard.tsx` |
| `pages/AdminDashboard.tsx` | `pages/pqrs/AdminDashboard.tsx` |
| `pages/AreaDashboard.tsx` | `pages/tickets/AreaDashboard.tsx` |
| `pages/GestionAreas.tsx` | `pages/admin/GestionAreas.tsx` |
| `pages/GestionRoles.tsx` | `pages/admin/GestionRoles.tsx` |
| `pages/GestionSLA.tsx` | `pages/admin/GestionSLA.tsx` |
| `pages/GestionContactos.tsx` | `pages/admin/GestionContactos.tsx` |
| `components/TicketChat.tsx` | `components/tickets/TicketChat.tsx` |

#### Compatibilidad

- Todos los imports relativos actualizados (`../` → `../../`)
- `routes.tsx` actualizado con las nuevas rutas de importación
- Validación: `vite build` → 2752 módulos, 0 errores

---

### 2026-05-19 — Notificaciones en tiempo real + hilo unificado en `AreaDashboard`

#### Descripción

Se añade un sistema completo de notificaciones en tiempo real para el panel de área, junto con un hook WebSocket para el chat de tickets y una vista de hilo unificada que combina comentarios y eventos en una sola línea temporal.

---

#### Nuevos archivos

**`src/app/lib/useTicketChat.ts`**

Hook custom que gestiona el ciclo de vida de la conexión WebSocket de un ticket:

- URL: `ws(s)://host/ws/tickets/<ticket_id>/?token=<access_jwt>`
- Reconexión automática con backoff exponencial (1 s → 2 s → 5 s → 10 s → 30 s).
- Retorna `{ messages, status, sendMessage, disconnect }`.
- Tipo `ChatMessage`: `{ id, ticket, activity_type, detail, created_at, performed_by? }`.

**`src/app/components/TicketChat.tsx`**

Componente de interfaz de chat que consume `useTicketChat`.

---

#### Cambios en `src/app/lib/api.ts`

| Elemento | Descripción |
|---|---|
| `apiGetTicketActivityFeed(since)` | `GET /api/pqrs/tickets/activity-feed/?since=<ISO>` — devuelve actividades `COMMENT` / `INTERNAL_NOTE` de todos los tickets visibles creadas después de `since`. Usado para polling global de notificaciones. |

---

#### Cambios en `src/app/pages/AreaDashboard.tsx`

**Sistema de notificaciones (campana):**

- `allTicketsRef` — ref estable que espeja `[...ticketsRecibidos, ...ticketsEnviados]` sin afectar los efectos de polling.
- Poll global (`useEffect`) con warmup de 3 s y ciclo de 10 s; llama a `apiGetTicketActivityFeed` y emite un toast + acumula la notificación si la actividad es de otro usuario y no fue vista antes (`globalSeenActivities` Set).
- Notificaciones con TTL de 1 hora; limpieza automática cada 5 minutos. Máximo 200 entradas.
- Las dependencias del `useEffect` son solo `[usuario?.email, addNotification]` — nunca incluyen los arrays de tickets, evitando reinicios del intervalo al recargar datos.

**Hilo unificado del ticket:**

- `ticketActivities` se ordena cronológicamente (`created_at.localeCompare`) antes de renderizar.
- Un único `.map()` combina comentarios, notas internas y eventos del sistema en orden de llegada.
- Comentarios (`COMMENT`) y notas internas (`INTERNAL_NOTE`) → tarjeta con avatar e indicador visual de tipo.
- Adjuntos (`ATTACHMENT_ADDED`) → tarjeta azul con enlace de descarga.
- Eventos de sistema (cambio de estado, asignación, escalación, SLA breach) → píldora centrada con líneas flanqueantes, coloreada por tipo:

  | Tipo | Color |
  |---|---|
  | `STATUS_CHANGE` | Índigo |
  | `ASSIGNED` | Verde |
  | `ESCALATED` | Rojo |
  | `SLA_BREACH` | Ámbar |
  | `CREATED` / resto | Gris |

- `chatBottomRef` — sentinel `<div>` al final del hilo; `scrollIntoView({ behavior: 'smooth' })` al recibir nuevas actividades o al cambiar a la pestaña «Hilo».

---

### 2026-03-20 — Selectores geográficos Departamento → Municipio (Colombia)

#### Descripción

Se integran los endpoints públicos de geografía del backend (`/api/pqrs/geo/`) para reemplazar los campos de texto libre «Ciudad» por selectores encadenados **Departamento → Municipio** en todos los formularios donde se solicita la ciudad del usuario.

---

#### Nuevos elementos en `src/app/lib/api.ts`

| Elemento | Descripción |
|---|---|
| `interface Departamento` | `{ codigo: string; nombre: string }` |
| `interface Municipio` | `{ codigo, nombre, departamento, departamento_nombre }` |
| `apiGetDepartamentos()` | `GET /api/pqrs/geo/departamentos/` — acceso público, sin auth |
| `apiGetMunicipios(params?)` | `GET /api/pqrs/geo/municipios/?departamento=&search=` — acceso público, sin auth |

#### Nuevo componente `src/app/components/DeptMuniSelect.tsx`

Componente reutilizable de dos `<select>` encadenados:

- Carga la lista completa de **departamentos** al montar (una sola llamada).
- Al elegir un departamento, recarga los **municipios** de ese departamento.
- Acepta `value` / `onChange` para integrarse con `react-hook-form` via `<Controller>`.
- Muestra el valor almacenado previamente («Valor actual: …») cuando aún no se ha elegido departamento (útil en formularios de edición como el perfil).
- Soporta estado `disabled` y resaltado de error (`hasError`).

#### Páginas actualizadas

| Página | Campo modificado |
|---|---|
| [src/app/pages/Register.tsx](src/app/pages/Register.tsx) | «Ciudad» → `DeptMuniSelect` con `Controller` |
| [src/app/pages/CrearPQRS.tsx](src/app/pages/CrearPQRS.tsx) | «Ciudad (opcional)» del radicante anónimo → `DeptMuniSelect` con `Controller` |
| [src/app/pages/Perfil.tsx](src/app/pages/Perfil.tsx) | «Ciudad» en pestaña «Datos personales» → `DeptMuniSelect` con `Controller` |

En todos los casos el valor enviado al backend sigue siendo el **nombre del municipio** (campo `ciudad` / `anon_city`), compatible con el contrato existente de la API.

---

### 2026-03-20 — Módulo de Contactos Institucionales + mejoras de navegación y UX

#### Descripción

Se implementó el módulo completo de **Contactos Institucionales**: un directorio de funcionarios de enlace por dependencia, visible públicamente y administrable sólo por el rol `admin`. Además se aplicaron varias mejoras de navegación y correcciones de UX.

---

#### Nuevas páginas

**`/contactos` — [src/app/pages/Contactos.tsx](src/app/pages/Contactos.tsx)** — pública, sin autenticación.

- Hero con icono institucional.
- Buscador en tiempo real por nombre, cargo, correo, teléfono o dependencia.
- Grilla responsiva de tarjetas (1 columna móvil → 2 tablet → 3 desktop).
- Cada tarjeta muestra: avatar con inicial, nombre, cargo, dependencia, correo (`mailto:`) y teléfono (`tel:`) si está disponible.

**`/gestion-contactos` — [src/app/pages/GestionContactos.tsx](src/app/pages/GestionContactos.tsx)** — rol `admin` requerido.

- CRUD completo: crear, editar y eliminar con la misma estructura de UX del resto del admin.
- Formulario en modal `Dialog` (nombre, cargo, dependencia —selector dinámico—, correo, teléfono opcional con validación de formato).
- Pre-llenado correcto en edición: `reset()` se llama en `useEffect([showForm, editingContact])` garantizando que los inputs ya estén montados.
- Confirmación de eliminación con `AlertDialog` estilizado (icono rojo de advertencia).
- **Layout dual responsivo**: tarjetas apiladas en móvil/tablet (`lg:hidden`) + tabla `table-fixed` con columnas de ancho porcentual en desktop (`hidden lg:block`).
- Búsqueda filtrable por nombre, cargo, correo, teléfono y dependencia.

---

#### Cambios en archivos existentes

**`src/app/lib/api.ts`**

Nuevas interfaces y funciones al final del archivo (después de `apiExportExcelArea`):

| Elemento | Descripción |
|---|---|
| `interface Contact` | `id`, `nombre`, `cargo`, `dependencia` (UUID), `dependencia_nombre?`, `correo`, `telefono?` |
| `interface ContactPayload` | Mismo esquema sin `id` ni `dependencia_nombre`; `telefono` opcional |
| `apiListContacts()` | `GET /api/pqrs/contacts/` — acceso público (`authenticated = false`) |
| `apiGetContact(id)` | `GET /api/pqrs/contacts/<id>/` — acceso público |
| `apiCreateContact(payload)` | `POST /api/pqrs/contacts/` — solo admin |
| `apiUpdateContact(id, payload)` | `PATCH /api/pqrs/contacts/<id>/` — solo admin |
| `apiDeleteContact(id)` | `DELETE /api/pqrs/contacts/<id>/` — solo admin |

El campo `telefono` fue añadido posteriormente cuando el backend lo expuso como `blank=True`; los registros existentes devuelven cadena vacía o `null`.

**`src/app/app/routes.tsx`**

| Ruta | Componente | Acceso |
|---|---|---|
| `/contactos` | `Contactos` | Público |
| `/gestion-contactos` | `GestionContactos` | `adminOnly` (`ProtectedRoute`) |

**`src/app/components/layout/InstitutionalNavbar.tsx`**

Enlace «Contactos» agregado en el bloque de navegación del rol `admin` (entre SLA y Consultar), usando el icono `UserPlus`.

**`src/app/components/layout/Footer.tsx`**

- Enlace «Directorio de Contactos» (`/contactos`) con icono `Users` añadido en la columna *Marco Legal*.
- Enlace de la **Ley 1755 de 2015** corregido: la URL anterior (`funcionpublica.gov.co/eva/gestornormativo/norma.php?i=74788`) devolvía error 404. Reemplazada por `secretariasenado.gov.co/senado/basedoc/ley_1755_2015.html` (fuente oficial del Congreso de Colombia).

**`src/app/pages/Home.tsx`**

- El botón «CONTACTAR SOPORTE» de la sección «¿Necesita ayuda?» (antes inactivo) ahora usa `asChild` + `<Link to="/contactos">` para navegar al directorio público al hacer clic.
- Se eliminó el icono `ArrowRight` del botón a petición del diseño.

**`src/app/components/layout/Layout.tsx`**

- Añadido componente `ScrollToTop` (interno, no exportado) que escucha `useLocation().pathname` y ejecuta `window.scrollTo(0, 0)` al cambiar de ruta.
- Soluciona el problema de que páginas largas (Política de Datos, Política PQRS, etc.) se abrían a mitad del contenido al navegar hacia ellas.

---

#### Rutas actualizadas

| Ruta | Componente | Acceso |
|---|---|---|
| `/` | `Home` | Público |
| `/login` | `Login` | Público |
| `/register` | `Register` | Público |
| `/consulta` | `ConsultaRadicado` | Público |
| `/contactos` | `Contactos` | Público ✨ *nuevo* |
| `/politica-datos` | `PoliticaTratamientoDatos` | Público |
| `/politica-pqrs` | `PoliticaPQRS` | Público |
| `/crear-pqrs` | `CrearPQRS` | Autenticado |
| `/dashboard` | `UserDashboard` | Rol `usuario` |
| `/admin` | `AdminDashboard` | Rol `admin` |
| `/area` | `AreaDashboard` | Rol `area` |
| `/admin/areas` | `GestionAreas` | Rol `admin` |
| `/admin/roles` | `GestionRoles` | Rol `admin` |
| `/admin/sla` | `GestionSLA` | Rol `admin` |
| `/gestion-contactos` | `GestionContactos` | Rol `admin` ✨ *nuevo* |
| `/perfil` | `Perfil` | Autenticado |
| `*` | `NotFound` | Público |

---

### 2026-03-19 — Políticas de tratamiento de datos y PQRS + footer institucional + corrección de modal

#### Descripción

Cuatro grupos de mejoras sobre el `AreaDashboard` y el backend de tickets internos.

#### Notas internas (`INTERNAL_NOTE`)

**Backend (`pqrs/models/ticket.py`)**:
- Se añadió `('INTERNAL_NOTE', 'Nota interna')` a `ACTIVITY_CHOICES`. La etiqueta de `COMMENT` se renombró a `'Comentario público'` para mayor claridad.

**Backend (`pqrs/serializers/ticket.py`)**:
- `InternalTicketCommentSerializer` ahora acepta el flag de escritura `is_internal_note: bool` (por defecto `false`). El método `create()` lo extrae y establece `activity_type = 'INTERNAL_NOTE'` o `'COMMENT'` según corresponda.

**`api.ts`**:
- `apiCommentTicket(ticketId, detail, isInternalNote = false)` — pasa `is_internal_note` en el cuerpo del POST.

**`AreaDashboard.tsx`**:
- `handleTicketAddReply` ahora pasa `ticketReplyMode === "nota_interna"` como tercer argumento a `apiCommentTicket`.
- El hilo del ticket filtra y renderiza tanto `COMMENT` como `INTERNAL_NOTE`:
  - Comentarios públicos: fondo blanco, avatar índigo.
  - Notas internas: borde ámbar, fondo ámbar tenue, avatar ámbar, badge con ícono de candado y etiqueta **"Solo visible para el equipo"**.
- El contador del tab «Hilo» incluye ambos tipos.
- El log de actividad excluye `INTERNAL_NOTE` (ya se muestra en el hilo).

#### Asignación de tickets por área (`InternalTicketAssignment`)

- La asignación de un ticket es a una **dependencia/área**, no a un usuario individual.
- Nuevas interfaces en `api.ts`: `TicketAssignmentAPI` (con `dependency`, `dependency_name`, `assigned_by_email`, `is_active`, `assigned_at`) y `AssignTicketPayload` (con `dependency: string`).
- Nuevas funciones: `apiGetTicketAssignments(ticketId)` → `GET /api/pqrs/tickets/<id>/assignments/` y `apiAssignTicket(ticketId, dependencyId, notes?)` → `POST /api/pqrs/tickets/assign/`.
- Nuevos estados en `AreaDashboard`: `ticketAssignments`, `assignTicketDepId`, `assignTicketNotes`, `showAssignForm`, `submittingAssign`.
- La sección "Responsable" en el panel lateral muestra:
  - La asignación explícita activa (`InternalTicketAssignment`) si existe.
  - En su defecto, el área destino implícita (`target_dependency_info.name`) del propio ticket.
  - Siempre muestra "Reasignar" cuando hay un responsable; de lo contrario "Asignar".
  - Si se realizó una reasignación explícita, muestra "Origen: [nombre área original]".
- El `useEffect` al cambiar de ticket carga las asignaciones en paralelo con actividades y tareas; resetea todos los estados de asignación.

#### Enriquecimiento de descripción del ticket

- Cuando el ticket seleccionado llega desde la lista sin descripción (`description == null`), se dispara en segundo plano `apiGetTicketInterno(id)` para obtener el detalle completo y actualizar `selectedTicket`. Esto asegura que el PDF y el hilo muestren la descripción real.

#### Descripciones de tareas

- Nuevo estado `newTaskDescription` en `AreaDashboard`.
- El formulario de creación de tareas incluye un campo `<textarea>` de descripción (opcional).
- Las tarjetas de tarea muestran la descripción debajo del título con estilo `text-sm text-gray-500`.
- El PDF generado por `handlePrintTicket` incluye la descripción de cada tarea en la tabla de tareas.

#### Generación de PDF (informe del ticket)

- `handlePrintTicket` construye un documento HTML completo en un `<iframe>` oculto y dispara `print()` automáticamente; el iframe se elimina tras 2 s.
  - Secciones: encabezado del ticket, grilla de datos generales, barra de progreso de tareas, descripción, comentarios (tarjetas estilizadas), tabla de tareas (con descripción), log de actividad y pie de página.
  - Fallback de descripción: `"Sin descripción registrada."` si el campo está vacío.
- Este enfoque reemplaza el anterior `window.open()` (que bloqueaba la interacción con la app mientras estaba abierto).

#### Mejoras visuales en tarjetas de tarea

- Padding: `px-4 py-3`; título: `text-[15px] font-medium text-gray-800`.
- Asignados: `text-sm text-indigo-600 font-medium`.
- Fecha: `text-sm font-medium ml-auto` (alineada a la derecha con `flex`).

---

### 2026-03-19 — Políticas de tratamiento de datos y PQRS + footer institucional + corrección de modal

#### Páginas de políticas

Se crearon dos páginas públicas (rutas sin autenticación) con el marco normativo colombiano vigente:

**`/politica-datos` — [src/app/pages/PoliticaTratamientoDatos.tsx](src/app/pages/PoliticaTratamientoDatos.tsx)**

Política de Tratamiento de Datos Personales conforme a la **Ley 1581 de 2012** (Habeas Data) y el **Decreto 1377 de 2013**. Contenido:

| Sección | Contenido |
|---|---|
| Responsable del tratamiento | Datos de contacto del DPO |
| Datos recolectados | Identificación, contacto, solicitud y navegación; nota sobre datos sensibles (Art. 6 Ley 1581) |
| Finalidades del tratamiento | 5 finalidades declaradas conforme al principio de finalidad (Art. 4.b) |
| Derechos ARCO | Acceso · Rectificación · Cancelación · Oposición — con forma visual de tarjetas |
| Procedimiento | 4 pasos con plazos legales: consultas 10 días hábiles, reclamos 15 días hábiles (Arts. 14-15 Ley 1581) |
| Transferencia y transmisión | Prohibición de venta, contratos con encargados, excepciones legales |
| Seguridad | HTTPS, JWT, control de roles, backups, auditoría, notificación de brechas |
| Cookies y sesión | localStorage para JWT, reCAPTCHA de Google |
| Vigencia y contacto | Delegado de datos + SIC enlace directo |

**`/politica-pqrs` — [src/app/pages/PoliticaPQRS.tsx](src/app/pages/PoliticaPQRS.tsx)**

Política PQRS institucional conforme a la **Ley 1755 de 2015**, **Ley 1437 de 2011 (CPACA)**, **Art. 23 C.P.** y demás normas concordantes. Contenido:

| Sección |
|---|
| Marco normativo completo (6 normas con badge de categoría) |
| Tipos de PQRSF con plazos legales por tipo |
| 6 canales de recepción oficiales |
| Tabla de términos legales de respuesta |
| Derechos del peticionario (10 derechos — Art. 5, Ley 1755) |
| Obligaciones del peticionario + advertencia sobre peticiones abusivas (Art. 11) |
| PQRS anónimas y reserva de identidad |
| Silencio administrativo positivo (Art. 83 CPACA) |
| Recursos: reposición, apelación, tutela, Procuraduría, nulidad |
| 6 Preguntas frecuentes |

Ambas páginas tienen:
- Header con badges de normas aplicables.
- Sidebar con tabla de contenido anclada (`position: sticky`).
- Cross-links entre sí y hacia `/crear-pqrs`.

#### Footer institucional

Nuevo componente **[src/app/components/layout/Footer.tsx](src/app/components/layout/Footer.tsx)** integrado en `Layout.tsx` (aparece en todas las páginas).

- **Columna Marco Legal**: links internos a `/politica-datos` y `/politica-pqrs`.
- **Columna Normatividad**: 4 ítems con enlace externo al repositorio oficial de **Función Pública** (`funcionpublica.gov.co`) y a la SIC:
  - Art. 23 Constitución Política → `constitucioncolombia.com`
  - Ley 1755 de 2015 → `funcionpublica.gov.co`
  - Ley 1437 de 2011 (CPACA) → `funcionpublica.gov.co`
  - Ley 1581 de 2012 (Habeas Data) → `funcionpublica.gov.co`
  - SIC → `sic.gov.co`
- Icono `ExternalLink` visible al hover.

#### Consentimiento en registro

En **[src/app/pages/Register.tsx](src/app/pages/Register.tsx)** se añadieron dos checkboxes de consentimiento obligatorio antes del botón «Crear Cuenta»:

1. **Autorización de tratamiento de datos** (enlace a `/politica-datos`) — cumple la exigencia de autorización expresa del Art. 9 de la Ley 1581 de 2012.
2. **Conocimiento de la política PQRS** (enlace a `/politica-pqrs`).

El botón «Crear Cuenta» permanece `disabled` hasta que ambos estén marcados (`disabled={isLoading || !consentData || !consentPQRS}`). Los links abren en pestaña nueva.

#### Acceso a políticas desde el modal de PQRS / Términos y Condiciones

- **`TerminosModal`**: se añadieron dos tarjetas al inicio del body con acceso directo (en pestaña nueva) a «Política de Datos» y «Política PQRS».
- **Checkbox de términos en Home**: bajo el checkbox se muestran dos micro-links (`/politica-datos` y `/politica-pqrs`) con íconos `Shield` y `Scale`.

#### Corrección: modal Términos y Condiciones opacado por modal PQRS

**Causa raíz:** el modal de formulario PQRS ya usaba `createPortal` (se monta en `document.body`, z-index resuelto a nivel raíz), pero el `TerminosModal` se renderizaba *inline* dentro del árbol de React. Las animaciones de framer-motion aplican `transform` a nodos padre, creando un **nuevo stacking context local** donde `z-[60]` no puede superar el `z-[51]` del portal.

**Solución:** envolver el `TerminosModal` en `createPortal(..., document.body)` de manera idéntica a los demás modales. Todos compiten ahora en el mismo stacking context raíz y el orden de z-index funciona correctamente.

---

### 2026-03-19 — Reporte Excel elaborado + correcciones de tareas + bloqueo de doble envío

#### Reporte Excel elaborado

Se reemplazó la descarga Excel del área (que usaba el endpoint del backend) por un generador completamente **client-side** basado en [`exceljs`](https://github.com/exceljs/exceljs). El archivo `src/app/lib/generateAreaReport.ts` exporta la función `generateAreaReport(input)` que produce un workbook `.xlsx` multi-hoja con nombre `Reporte_Area_<Nombre>_<fecha>.xlsx`.

**Hojas generadas:**

| Hoja | Contenido |
|---|---|
| **Portada** | Banda de marca institucional, metadatos (área, usuario, fecha, período analizado) y 8 tarjetas KPI con bordes de color (Total, Resueltas, En proceso, SLA %, Radicadas, Edad promedio, Tickets rec./env.) |
| **Resumen Ejecutivo** | Tablas de distribución por Estado / Tipo / Prioridad con barras visuales Unicode (█░) y porcentajes; tabla de cumplimiento SLA (a tiempo, vencidas, sin fecha); comparativa del período actual vs. período anterior con indicadores ▲/▼ |
| **Tendencia Diaria** | Serie de tiempo día a día: Nuevas PQRS, Resueltas, Acumuladas + barra visual proporcional; fila de cabecera congelada |
| **Detalle PQRS** | Listado completo con filas coloreadas por estado, celdas de prioridad color codificadas, columna SLA (✓ OK / ✗ Vencida), días en gestión con alerta roja si >30 días, _auto-filter_ y _freeze_ de cabecera |
| **Tickets Internos** | Tablas de tickets recibidos y enviados con estados coloreados + resumen estadístico al pie |

**Entradas de `AreaReportInput`:**

```ts
interface AreaReportInput {
  areaName: string;
  userName: string;
  pqrsList: PqrsAPI[];
  ticketsRecibidos: TicketInternoAPI[];
  ticketsEnviados: TicketInternoAPI[];
  periodDays: number;     // 0 = histórico completo
  exportFilters: ExportFilters;
}
```

> El botón **Descargar CSV** sigue usando `apiExportCSVArea` (backend). Solo el **Descargar Excel** usa el generador frontend.

#### Bloqueo de doble envío al cambiar estado de ticket

- Nuevo estado `submittingTicketStatus: boolean` en `AreaDashboard`.
- El botón «Guardar» queda `disabled` mientras la petición al backend está en vuelo **y** también cuando el estado seleccionado es igual al actual.
- Muestra un spinner `Loader2` en lugar del texto durante la espera.
- El estado se resetea en `finally` (éxito o error) y al cambiar de ticket.

#### Mejoras en tarjetas de tarea

- `TicketTaskAPI` extendido con `created_by?: string | null` y `created_by_nombre?: string | null` (campos del serializer del backend).
- `apiUpdateTicketTask` ahora acepta `assigned_to` en el payload PATCH.
- Tarjetas rediseñadas:
  - Descripción con borde lateral acento (`border-l-2 border-indigo-100`) para jerarquía visual.
  - `dependency_name` (área responsable) mostrado con ícono `Building2`.
  - Fila de metadatos unificada (asignados · fecha vencimiento con año · creador alineado a la derecha con ícono `FilePlus`).

---

### 2026-03-13 — Tickets internos: tareas y comentarios conectados al backend

#### Descripción

Los tickets internos del `AreaDashboard` ahora persisten tareas y comentarios en el backend. Se eliminó todo el estado local efímero (`localReplies`, `localTasks`) y se integró con los nuevos endpoints reales.

#### Cambios en `api.ts`

- **`TicketInternoAPI`**: nuevo campo opcional `closed_at?: string | null` (fecha de cierre del ticket).
- **`TicketActivity`**: ampliado para soportar comentarios (`COMMENT`):
  - `performed_by` acepta también `number` (ID numérico que devuelve el backend para actividades de tipo `COMMENT`).
  - Nuevos campos aplanados `performed_by_nombre` y `performed_by_email` para resolver el nombre sin depender de joins en el frontend.
- **Nuevas interfaces para tareas**:
  - `TicketTaskStatus`: `"PENDING" | "IN_PROGRESS" | "DONE" | "CANCELLED"`.
  - `TicketTaskAPI`: representa una tarea de ticket con `id`, `title`, `status`, `assigned_to_nombres`, `due_date`, `is_overdue`, etc.
  - `CreateTicketTaskPayload`.
- **Nuevas funciones de la capa HTTP**:

| Función | Endpoint | Descripción |
|---|---|---|
| `apiListTicketTasks(ticketId)` | `GET /api/pqrs/tickets/<id>/tasks/` | Lista las tareas de un ticket |
| `apiCreateTicketTask(ticketId, payload)` | `POST /api/pqrs/tickets/<id>/tasks/` | Crea una tarea |
| `apiUpdateTicketTask(ticketId, taskId, payload)` | `PATCH /api/pqrs/tickets/<id>/tasks/<pk>/` | Actualiza estado/título/fecha de una tarea |
| `apiCommentTicket(ticketId, detail)` | `POST /api/pqrs/tickets/<id>/comments/` | Publica un comentario; queda como actividad `COMMENT` |

#### Cambios en `AreaDashboard.tsx`

- **Estados eliminados**: `localReplies: LocalTicketReply[]` y `localTasks: LocalTicketTask[]` — no se persisten ya en el cliente.
- **Nuevos estados del panel de ticket**:

| Estado | Tipo | Descripción |
|---|---|---|
| `ticketTasks` | `TicketTaskAPI[]` | Tareas cargadas desde el backend |
| `ticketTasksLoading` | `boolean` | Indica si las tareas están cargando |
| `submittingReply` | `boolean` | Indica si se está publicando un comentario |
| `submittingTask` | `boolean` | Indica si se está creando/actualizando una tarea |

- **`useEffect` al cambiar ticket**: ahora ejecuta `Promise.all([apiGetTicketActivities, apiListTicketTasks])` para cargar bitácora y tareas simultáneamente al abrir un ticket.
- **`handleTicketAddReply`**: ahora llama a `apiCommentTicket` y recarga las actividades para que el nuevo `COMMENT` aparezca en el hilo.
- **`handleTicketAddTask`**: ahora llama a `apiCreateTicketTask`, actualiza `ticketTasks` en lugar del estado local y recarga actividades.
- **Toggle/cancelar tarea**: cada acción llama a `apiUpdateTicketTask` con el nuevo `status` y recarga actividades.
- **Hilo del ticket**: los comentarios se renderizan filtrando actividades con `activity_type === "COMMENT"`. La resolución del nombre del autor soporta los tres formatos posibles que devuelve el backend (`performed_by_nombre`, objeto `UsuarioAPI`, ID numérico).
- **Log de actividad**: muestra solo eventos que **no son** `COMMENT` (evita duplicados con el hilo); resuelve el nombre del autor con el mismo patrón multi-formato.
- **Área de respuesta**: visible **únicamente** en la pestaña «Hilo del Ticket» (antes se mostraba en todas las pestañas).
- **Actualización de estado del ticket**: tras cambiar el estado invoca `apiGetTicketInterno` para obtener el detalle completo con campos expandidos (áreas, autor), luego recarga actividades; evita perder información de campos `_info` que no viajan en el response del PATCH.
- **Etiquetas de área en lista y detalle**: corregidas para mostrar `"Sin área origen"` / `"Sin área destino"` cuando `origin_dependency` o `target_dependency` es `null`, evitando que valores vacíos dupliquen entradas en el gráfico de barras.

---

### 2026-03-12 — Bitácora de actividades en el panel de área

#### Descripción

Se agregó la sección **Bitácora** al panel de detalle de PQRS en `AreaDashboard`, equiparando la vista de área con la del administrador.

#### Cambios en `AreaDashboard.tsx`

- **Nuevos imports**: `apiGetActivities`, `PQRSActivity` desde `api.ts`; iconos `Activity`, `FilePlus`, `ArrowUpCircle`, `ShieldAlert` desde `lucide-react`.
- **Nuevos estados**: `pqrsActivities: PQRSActivity[]`, `pqrsActivitiesLoading: boolean`, `showBitacora: boolean`.
- **`openDetail()`**: resetea `pqrsActivities` y colapsa `showBitacora` al abrir una PQRS diferente.
- **`useEffect`** reactivo a `[selected?.id, showBitacora]`: dispara `apiGetActivities` solo cuando el usuario expande el panel por primera vez para cada PQRS (carga lazy).
- **UI**: panel colapsable «Bitácora» insertado entre la sección de adjuntos y el formulario de respuesta. Cada entrada muestra un badge con color e ícono según el tipo de actividad:

| `activity_type` | Color | Ícono |
|---|---|---|
| `CREATED` | Azul | `FilePlus` |
| `STATUS_CHANGED` | Ámbar | `RefreshCw` |
| `ASSIGNED` | Índigo | `Building2` |
| `ESCALATED` | Naranja | `ArrowUpCircle` |
| `RESPONSE_ADDED` | Verde | `MessageSquare` |
| `ATTACHMENT_ADDED` | Gris | `Paperclip` |
| `COMMENT` | Púrpura | `StickyNote` |
| `SLA_BREACH` | Rojo | `ShieldAlert` |

#### Corrección de formato de respuesta

`apiGetActivities` puede retornar un array plano `[...]` o una respuesta paginada `{ results: [...] }`. El código ahora maneja ambos casos:

```ts
Array.isArray(res) ? res : ((res as any).results ?? [])
```

Esto fue necesario porque el backend devuelve un array plano para este endpoint, no paginado.

---

### 2026-03-11 — Adjuntos de PQRS funcionales para usuarios anónimos y autenticados

#### Problema

El endpoint de subida de adjuntos fallaba con `401 Unauthorized` para ciudadanos anónimos y con `404 Not Found` cuando el `pqrs_id` llegaba como `undefined` a la URL.

#### Causa raíz

| Problema | Descripción |
|---|---|
| URL incorrecta | `POST /api/pqrs/attachments/` no incluía el UUID en el path |
| Campo `pqrs` en body | El backend esperaba el UUID en el path, no en el body del `FormData` |
| Permiso `IsAuthenticated` | El endpoint rechazaba peticiones sin token aunque debería ser público |
| Response sin `id` | `POST /api/pqrs/` devolvía `{mensaje, numero_radicado, estado, fecha_limite}` sin el UUID |
| Guardia en frontend | `Home.tsx` y `CrearPQRS.tsx` bloqueaban la subida para usuarios anónimos sin intentarla |

#### Correcciones en el backend (`views.py`)

- URL cambiada a `POST /api/pqrs/<uuid:pqrs_id>/attachments/create/` (consistente con el endpoint de listado).
- Permiso cambiado a `AllowAny` para permitir adjuntos de ciudadanos anónimos.
- `perform_create` extrae el `pqrs_id` del path, busca la PQRS e infiere `uploaded_by` del token si existe (o `None` si es anónimo).
- La response de creación ahora incluye el campo `id` (UUID) de la PQRS recién creada.

#### Correcciones en el frontend

**`api.ts`**:
- `apiUploadAttachment`: URL actualizada a `/api/pqrs/${pqrsId}/attachments/create/`.
- Eliminado `form.append("pqrs", pqrsId)` del body — el backend lo toma del path.
- Auto-detección de auth: `useAuth = authenticated && !!tokens.getAccess()`. Si no hay token activo (anónimo), la petición va sin `Authorization` evitando el flujo de refresco de 401.
- Añadida interfaz `CreatePQRSResponse` con `id: string` como tipo de retorno real de `apiCreatePQRS`.
- Logs de diagnóstico en `apiUploadAttachment`: URL, nombre/tamaño de archivo, resultado o error.

**`Home.tsx` / `CrearPQRS.tsx`**:
- Eliminadas las guardias `if (!isAuthenticated)` / `if (sendAsAnon)` que mostraban el toast "solo con cuenta registrada" y saltaban la subida.
- Ahora siempre intentan subir adjuntos usando `result.id` del response de creación.
- Si algún archivo falla, se muestra un toast con el conteo de errores en lugar de bloquear todo el flujo.

#### Flujo correcto post-corrección

```
Usuario (anónimo o autenticado) envía PQRS con adjunto
  ↓ POST /api/pqrs/  →  { id, mensaje, numero_radicado, ... }
  ↓ POST /api/pqrs/{id}/attachments/create/  (sin token si anónimo)
  ↓ Backend: AllowAny → extrae pqrs_id del path → infiere uploaded_by del token o None
  ↓ Adjunto guardado ✅
```

---

### 2026-03-11 — Estabilidad HMR: AuthContext como singleton en Vite

#### Problema

Durante el Hot Module Replacement (HMR) de Vite, al editar `AuthContext.tsx` se creaba una nueva instancia del módulo con un **nuevo objeto `AuthContext`**. El `AuthProvider` proveía el nuevo contexto, pero los consumidores cacheados (`InstitutionalNavbar`, `Home`, etc.) seguían leyendo el contexto antiguo sin proveedor, lanzando:

```
Error: useAuth debe ser usado dentro de un AuthProvider
```

#### Solución

El objeto `AuthContext` se almacena como singleton en `globalThis.__PQRS_AUTH_CONTEXT__`:

```typescript
declare global { var __PQRS_AUTH_CONTEXT__: React.Context<AuthContextType> | undefined; }
const AuthContext =
  globalThis.__PQRS_AUTH_CONTEXT__ ??
  (globalThis.__PQRS_AUTH_CONTEXT__ = createContext<AuthContextType>(defaultAuthContext));
```

- **Primera carga**: crea el contexto y lo guarda en `globalThis`.
- **Recargas HMR**: reutiliza el mismo objeto — proveedor y consumidores comparten la misma referencia de contexto sin importar cuántas veces se recargue el módulo.

---

### 2026-03-09 — Documentación y complemento del README

- **`README.md`**: reestructurado y complementado. Eliminadas secciones duplicadas; añadidos módulos `GestionAreas`, `GestionRoles`, `GestionSLA`, `Login` (OAuth Google), sección _Modo offline / Mock_, tabla _Scripts disponibles_, variable de entorno `VITE_GOOGLE_CLIENT_ID` y sección _Cambios recientes_.

---

### 2026-03-06 — Corrección crítica: encargado de área no veía PQRSF

#### Diagnóstico del bug

El flujo de asignación de encargados de área involucra dos operaciones independientes en el backend:

| Operación | Endpoint | Efecto |
|---|---|---|
| Crear `DependencyManager` | `POST /api/pqrs/dependencies/{depId}/managers/` | Concede acceso a PQRSF en el backend (`_get_managed_dep_ids`) |
| Actualizar perfil del usuario | `PATCH /api/users/{id}/` `{ dependency }` | Permite al frontend detectar el rol `"area"` y conocer el `dependencyId` |

La UI anterior solo ejecutaba la primera operación al usar el botón **"Encargados"**, dejando el perfil del usuario con `dependency: null`. Al iniciar sesión, `mapApiUser` veía `hasDep = false` → asignaba `rol = "usuario"` → `DashboardGuard` redirigía a `UserDashboard` → el encargado nunca llegaba a `AreaDashboard`.

Además, aunque llegara, `cargarPQRS` en `AreaDashboard` filtraba por `usuario.dependencyId`, que también quedaba vacío.

#### Correcciones en `GestionAreas.tsx`

**`handleAssignEncargado`** — ahora ejecuta ambas operaciones en secuencia:

```typescript
await apiAssignManager(encargadosAreaId, userId);          // DependencyManager → acceso backend
await apiUpdateUser(userId, { dependency: encargadosAreaId }); // perfil → rol "area" en frontend
```

**`handleRemoveEncargado`** — al desactivar un manager, si el usuario ya no tiene managers activos en el área, limpia su `dependency`:

```typescript
await apiRemoveManager(encargadosAreaId, managerId);
if (remaining.length === 0) {
  await apiUpdateUser(targetUserId, { dependency: null });
}
```

#### Mejoras de UX en `GestionAreas.tsx`

- El botón **"Encargados"** fue renombrado a **"Encargados PQRS"** con icono `ShieldCheck` y estilo primario azul.
- El modal **"Gestionar Usuarios"** muestra un banner informativo: asignar un usuario al área solo establece membresía organizacional y **no** otorga acceso a PQRSF.
- El modal **"Encargados PQRS"** muestra un banner explicando que esta acción concede visibilidad real sobre PQRSF.
- La sección "Asignar nuevo encargado" incluye descripción contextual indicando el área sobre la que tendrá acceso el usuario.

#### Flujo correcto post-corrección

```
Admin → botón "Encargados PQRS" → "Asignar"
  ↓ crea DependencyManager  (backend filtra PQRSF por _get_managed_dep_ids)
  ↓ actualiza user.dependency (frontend detecta rol "area" en AuthContext)
  ↓
Encargado inicia sesión
  ↓ apiGetPerfil() → dependency != null → rol = "area"
  ↓ DashboardGuard → /area → AreaDashboard
  ↓ cargarPQRS() filtra por dependencyId → lista PQRSF del área ✅
```

---

### 2026-03-06 — Seguridad, Analytics, Exportación y página de Perfil

#### Seguridad

- **`index.html`**: cabeceras HTTP de seguridad vía meta tags (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Content-Security-Policy`).
- **`vite.config.ts`**: esas mismas cabeceras replicadas en el servidor de desarrollo.
- **`api.ts`**: `access_token` movido a `sessionStorage` para reducir la superficie de ataque XSS.
- **`AuthContext.tsx`**: el backend es la única fuente de verdad para roles; eliminada la fusión de privilegios desde `localStorage`. Se escucha el evento `auth:session-expired` para redirección SPA-segura.
- **`Login.tsx`**: bloqueo temporal de 30 s tras 5 intentos fallidos consecutivos. Soporte de parámetro `?redirect=`.
- **`mockData.ts`**: contraseñas ficticias eliminadas; lecturas de `localStorage` envueltas en `try/catch`.
- **`.env.example`**: `VITE_DISABLE_CAPTCHA` cambiado a `false` con nota de advertencia para producción.

#### Nuevas funcionalidades

- **Vista Analytics en `AdminDashboard`**: toggle «Ver Analytics» con KPI cards, dona de estados, barras por tipo, gráfica de área de tendencia diaria, barras horizontales por área, dona de prioridad, comparativa temporal (mensual / año-vs-año / mes-vs-mes) y métricas SLA/solicitantes desde `apiGetDashboard`.
- **Vista Analytics en `AreaDashboard`**: toggle «Ver Gráficas» con KPI cards y gráficas filtradas por período (7/30/90 días).
- **Exportación de reportes**: panel «Exportar» en `AdminDashboard` (CSV/Excel global) y `AreaDashboard` (CSV de área via backend; Excel de área generado en el cliente con `exceljs`).
- **Pestaña Adjuntos** en `AdminDashboard`: visualización, subida y descarga de adjuntos por PQRS.
- **Página `/perfil`** (`Perfil.tsx`): edición de datos personales y cambio de contraseña para usuarios autenticados.
- **Verificación por email en `ConsultaRadicado`**: formulario de verificación de identidad cuando el backend lo requiere.
- **Animaciones CSS**: clases `animate-fade-slide-up` y `animate-slide-down-fade` en `theme.css`.

---

### 2026-03-05 — Modales de radicado exitoso y correcciones de DOM

- **`Home.tsx`** y **`CrearPQRS.tsx`**: reemplazada la vista de pantalla completa post-radicación por un `Dialog` independiente con el número de radicado en formato grande, botón de **copiar al portapapeles** con feedback visual, y opciones para consultar el estado, radicar otra PQRS o cerrar.
- **`index.html`**: añadidos `lang="es"`, `translate="no"` y `<meta name="google" content="notranslate">` para prevenir el error `removeChild` causado por extensiones de traducción automática.

