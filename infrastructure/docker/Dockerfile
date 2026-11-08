# syntax=docker/dockerfile:1.7
# One image, three roles: the API, the web app and the worker share the built workspace.
# Build from the repository root:  docker build -f infrastructure/docker/Dockerfile -t faith .

FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /repo

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
# The web build reads INTERNAL_API_URL for its rewrites, so it is fixed at build time.
ARG INTERNAL_API_URL=http://api:4000
ENV INTERNAL_API_URL=$INTERNAL_API_URL
RUN pnpm run build

FROM base AS runtime
COPY --from=build /repo /repo
RUN useradd --system --uid 10001 faith && mkdir -p /repo/.dev/storage && chown -R faith /repo/.dev
USER faith
EXPOSE 3000 4000
CMD ["node", "apps/api/dist/main.js"]
