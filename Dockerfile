# syntax=docker/dockerfile:1
# The production image: the built app behind nginx. CI builds and publishes it (see .github/workflows/docker.yml).
ARG NODE_VERSION=22

# the build runs once on the builder's own architecture; only the small nginx layer is per-platform
FROM --platform=$BUILDPLATFORM node:${NODE_VERSION}-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
# what runs: nginx in the foreground, serving /usr/share/nginx/html (the nginx image already does this; stated here so it is visible)
CMD ["nginx", "-g", "daemon off;"]
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO /dev/null http://127.0.0.1/ || exit 1
