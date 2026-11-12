# Frontend DMZ : nginx + build statique déjà compilé (dist/). Ni code source, ni Node.
FROM nginx:alpine
# Les fichiers *.template sont traités par envsubst au démarrage (BACKEND_URL).
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY dist /usr/share/nginx/html
EXPOSE 80
