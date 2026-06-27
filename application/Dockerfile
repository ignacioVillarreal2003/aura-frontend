# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Runtime stage (nginx) ────────────────────────────────────────────────────
FROM nginx:alpine AS runtime

# Config de nginx: fallback SPA (Angular router) + endpoint /health.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Artefactos del build de Angular. El builder @angular/build:application emite
# los estáticos del navegador en dist/application/browser.
COPY --from=build /app/dist/application/browser /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
