# Docker

## Levantar el frontend

Desde la carpeta `docker` del repo:

```powershell
docker compose `
  -f docker-compose/docker-compose-frontend.yml `
  up -d --build
```

Desde la raíz `aura-frontend`:

```powershell
docker compose `
  -f docker/docker-compose/docker-compose-frontend.yml `
  up -d --build
```

La app queda servida por nginx en **http://localhost:4200**.

Para bajarlo, usá `down` en lugar de `up -d --build` (misma lista de `-f`).

## Detalles

- El build es **multi-stage** (`application/Dockerfile`): primero compila el bundle de
  Angular con Node (`npm ci` + `npm run build`) y después sirve los estáticos con `nginx`.
  La imagen final no lleva Node ni `node_modules`.
- `application/nginx.conf` hace el *fallback* SPA (todas las rutas caen en `index.html`
  para que resuelva el router de Angular), cachea los assets con hash e implementa el
  endpoint `/health` que usa el `healthcheck` del contenedor.
- Las URLs de los back-ends están **horneadas en build time** vía
  `src/environments/environment.ts` (apuntan a `localhost:800x`). Como el bundle corre en
  el navegador del host, llega a los servicios del back por esos puertos publicados; no
  hace falta una red de Docker compartida con `aura-backend`.
- Si cambiás esas URLs (otro host/puerto), editá el `environment.*.ts` y rebuildeá la
  imagen: `docker compose -f docker/docker-compose/docker-compose-frontend.yml build`.
