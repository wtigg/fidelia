# Fidélia : image reproductible (même Node que la CI, dépendances figées par package-lock.json)
#   docker build -t fidelia . && docker run --rm -p 8080:80 fidelia      → http://localhost:8080
#   docker build --target eval -t fidelia-eval . && docker run --rm fidelia-eval   → tests + contrôle de reproductibilité (graine 42)

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Cible optionnelle : tests, puis réentraînement graine 42 comparé à reports/synthetique-42.json (sans git)
FROM build AS eval
CMD ["sh", "-c", "npm test && npm run check:repro"]

FROM nginx:1.27-alpine AS web
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
