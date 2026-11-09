# Image frontend DMZ. Contexte de build = racine du dépôt (voir docker-compose.dmz.yml).
FROM node:24-alpine AS build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm install --no-audit --no-fund
COPY frontend/ .
# VITE_API_URL vide = même origine : Nginx relaie /api vers le backend.
RUN npm run build

FROM nginx:alpine
# Les fichiers *.template sont traités par envsubst au démarrage (BACKEND_URL).
COPY dmz/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
