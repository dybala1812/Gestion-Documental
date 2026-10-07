# ─────────────────────────────────────────────────────────────────────
# Dockerfile — PQRSF Frontend (React + Vite)
# Rebuild: 2026-07-24 06:30 UTC - Force full rebuild
#
# Stage 1 (builder): Node 20 — instala dependencias y compila el bundle.
# Stage 2 (runtime): Nginx — sirve los archivos estáticos y actúa como
#   proxy inverso hacia el backend Django (HTTP + WebSocket).
#
# Variables de build requeridas (pasar vía docker-compose build.args):
#   VITE_API_URL          → URL base del backend vista desde el navegador.
#                           Con Docker Desktop: http://localhost
#                           En producción: https://tu-dominio.com
#   VITE_GOOGLE_CLIENT_ID → OAuth 2.0 Client ID de Google.
#   VITE_DISABLE_CAPTCHA  → "true" en local/dev, "false" en producción.
#   VITE_RECAPTCHA_SITE_KEY → Site key pública de reCAPTCHA (vacío si deshabilitado).
# ─────────────────────────────────────────────────────────────────────

# ── Stage 1: Build ────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependencias primero (capa cacheada independiente del código fuente).
COPY package.json package-lock.json ./
RUN npm ci --prefer-offline

# Recibir variables de build (Vite las incrusta en el bundle en tiempo de compilación).
ARG VITE_API_URL
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_DISABLE_CAPTCHA=true
ARG VITE_RECAPTCHA_SITE_KEY
ARG VITE_CONVOCATORIAS_APP_URL=/convocatorias-app
ARG VITE_CONVOCATORIAS_SSO_PATH=/api/auth/sso
ARG VITE_CONVOCATORIAS_REDIRECT_PATH=/

ENV VITE_API_URL=$VITE_API_URL \
    VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID \
    VITE_DISABLE_CAPTCHA=$VITE_DISABLE_CAPTCHA \
    VITE_RECAPTCHA_SITE_KEY=$VITE_RECAPTCHA_SITE_KEY \
    VITE_CONVOCATORIAS_APP_URL=$VITE_CONVOCATORIAS_APP_URL \
    VITE_CONVOCATORIAS_SSO_PATH=$VITE_CONVOCATORIAS_SSO_PATH \
    VITE_CONVOCATORIAS_REDIRECT_PATH=$VITE_CONVOCATORIAS_REDIRECT_PATH

# Copiar el resto del código y compilar.
# Se usa 'vite build' directamente en lugar de 'npm run build' porque
# el script de package.json ejecuta 'tsc --noEmit && vite build' y el
# typecheck de TypeScript requiere tsconfig.json; en Docker nos interesa
# solo generar el bundle de producción.
COPY . .
# Copiar el PDF.js worker a public/ con URL estable (sin hash).
# react-pdf/AreaDashboard apunta workerSrc a "/pdf.worker.min.mjs".
RUN cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/pdf.worker.min.mjs
RUN npx vite build

# ── Stage 2: Runtime (Nginx) ──────────────────────────────────────────
FROM nginx:1.27-alpine

# Copiar el bundle compilado al directorio que Nginx sirve por defecto.
COPY --from=builder /app/dist /usr/share/nginx/html

# Reemplazar la configuración por defecto de Nginx con la nuestra
# (SPA routing + proxy inverso al backend).
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
