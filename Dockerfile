# Frontend SGD / Archivo Central — imagen de producción con Nginx.
# Construye la app Vite y la sirve en el puerto 80.

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
# Aumentar tolerancia a red inestable durante npm ci
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set maxsockets 1 && \
    npm ci --no-audit --no-fund
COPY . .

# Variables de entorno en tiempo de build (Vite las inyecta).
ARG VITE_SGD_API_URL=http://localhost:3000/api
ARG VITE_API_URL=http://localhost:8000
ARG VITE_LOGIN_TEMPORAL=false
ARG VITE_DISABLE_CAPTCHA=true
ENV VITE_SGD_API_URL=${VITE_SGD_API_URL}
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_LOGIN_TEMPORAL=${VITE_LOGIN_TEMPORAL}
ENV VITE_DISABLE_CAPTCHA=${VITE_DISABLE_CAPTCHA}

RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.sgd.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
