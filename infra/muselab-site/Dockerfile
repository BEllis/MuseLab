# syntax=docker/dockerfile:1

# -----------------------------------------------------------------------------
# Target: runtime (base nginx image — used by both full and prebuilt builds)
# -----------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

COPY infra/muselab-site/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/health || exit 1

CMD ["nginx", "-g", "daemon off;"]

# -----------------------------------------------------------------------------
# Target: prebuilt (recommended for ECS CI — bundle built on the host/CI runner)
#
#   pnpm --filter @muselab/site run build
#   docker build -f infra/muselab-site/Dockerfile --target prebuilt -t muselab-web .
# -----------------------------------------------------------------------------
FROM runtime AS prebuilt

COPY infra/muselab-site/dist-deploy /usr/share/nginx/html

# -----------------------------------------------------------------------------
# Target: default (full build inside Docker — slower, needs more RAM)
# -----------------------------------------------------------------------------
FROM node:20-bookworm-slim AS build

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV CI=1
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV NODE_OPTIONS="--max-old-space-size=4096"

RUN corepack enable && corepack prepare pnpm@10.12.1 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/designer/package.json apps/designer/
COPY packages/shared/package.json packages/shared/
COPY web/muselab/package.json web/muselab/
COPY infra/muselab-site/package.json infra/muselab-site/

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile \
      --filter @muselab/designer... \
      --filter @muselab/shared \
      --ignore-scripts \
    && pnpm rebuild esbuild

COPY packages/shared packages/shared
COPY web/muselab web/muselab
COPY apps/designer apps/designer
COPY infra/muselab-site/scripts infra/muselab-site/scripts

WORKDIR /app/infra/muselab-site
RUN bash scripts/build-web-deploy.sh

FROM runtime AS production

COPY --from=build /app/infra/muselab-site/dist-deploy /usr/share/nginx/html
