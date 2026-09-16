FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund

COPY . .
# L'URL de l'API est injectée au build (jamais en dur dans le code).
# ARG vide/absent = même origine : Nginx proxifie /api et /uploads vers le backend.
ARG VITE_API_URL
RUN if [ -n "$VITE_API_URL" ]; then export VITE_API_URL; fi && npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
