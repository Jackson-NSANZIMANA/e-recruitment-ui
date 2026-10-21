# syntax=docker/dockerfile:1
# ══════════════════════════════════════════════════════════════════
# SPA serving image (ADR-FE-014) — one Dockerfile for every app.
#
#   docker build -f infrastructure/images/spa/Dockerfile \
#     --build-arg APP=applicant-portal \
#     --build-arg VITE_EDGE_URL=https://portal.example \
#     --build-arg USRP_BUILD_SHA=$(git rev-parse HEAD) -t usrp-applicant-portal:dev .
#
# Adding an app (field-station) is one matrix line in ci.yml plus, for the
# camera, a PERMISSIONS_POLICY build arg. Nothing here is app-specific.
#
# VITE_EDGE_URL is compiled into the bundle (apps/*/src/env.ts), so an image
# is bound to the public origin it was built for. The browser calls that
# origin's /edge/v1/**; this image proxies /edge to USRP_EDGE_UPSTREAM, or
# answers 404 — it never serves index.html for /edge.
# ══════════════════════════════════════════════════════════════════

# ── Build: compile the app and its workspace packages ──────────────
FROM node:24-bookworm-slim@sha256:a5f4366e834695d5f363b920c104953a535d3a9864d1bdf74566a0ebe01daee5 AS build
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
ENV CI=true
ENV PUPPETEER_SKIP_DOWNLOAD=1
ENV TURBO_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo
COPY . .

ARG APP
ARG VITE_EDGE_URL
RUN test -n "$APP" || { echo "APP build arg is required"; exit 1; } \
 && test -d "apps/$APP" || { echo "apps/$APP does not exist"; exit 1; }
RUN --mount=type=cache,id=usrp-ui-pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store --filter "@usrp/$APP..."
# vite.config.ts refuses a production build without VITE_EDGE_URL.
RUN VITE_EDGE_URL="$VITE_EDGE_URL" pnpm --filter "@usrp/$APP..." run build

# Build facts → /version.json and <meta name="usrp-build-sha">; source maps out.
ARG USRP_BUILD_SHA=unknown
ARG USRP_BUILD_REF=unknown
ARG USRP_BUILD_TIME=unknown
RUN USRP_APP="$APP" USRP_EDGE_URL="$VITE_EDGE_URL" USRP_BUILD_SHA="$USRP_BUILD_SHA" \
    USRP_BUILD_REF="$USRP_BUILD_REF" USRP_BUILD_TIME="$USRP_BUILD_TIME" \
    node infrastructure/images/spa/stamp.mjs "apps/$APP/dist" \
 && mv "apps/$APP/dist" /site

# ── Caddy, built from source with a patched toolchain ──────────────
# The official caddy:2.11.7 image is built with Go 1.26.8 and
# golang.org/x/net 0.59.0, both with fixable HIGH CVEs. This stage builds the
# same Caddy release the way xcaddy does (standard modules only), on a current
# Go toolchain and with x/net raised. Module downloads are verified against
# sum.golang.org; versions are pinned here, the rest is resolved by Go's
# minimal version selection, so the build is deterministic. The binary carries
# no file capability (the stock one does, and fails under `cap_drop: [ALL]`).
FROM golang:1.27-alpine@sha256:f92b6ef800e499660581efdabdf25d9d817a9d124eaf900924f0504e7e27e12d AS caddy
ARG CADDY_VERSION=v2.11.7
ARG XNET_VERSION=v0.60.0
ENV CGO_ENABLED=0 GOTOOLCHAIN=local GOFLAGS=-trimpath
WORKDIR /src
RUN printf '%s\n' 'package main' \
      'import (' '  caddycmd "github.com/caddyserver/caddy/v2/cmd"' '  _ "github.com/caddyserver/caddy/v2/modules/standard"' ')' \
      'func main() { caddycmd.Main() }' > main.go \
 && go mod init usrp/caddy \
 && go get "github.com/caddyserver/caddy/v2@${CADDY_VERSION}" "golang.org/x/net@${XNET_VERSION}" \
 && go mod tidy \
 && go build -ldflags "-s -w" -o /caddy . \
 && /caddy version

# ── Runtime: Caddy on Alpine, non-root, no admin API ───────────────
FROM alpine:3.23@sha256:85fe1e81d6758c208f3e1eed4338a1997e19d4be002d4dd32d3100c9a8c010a0 AS runtime
RUN apk upgrade --no-cache && mkdir -p /tmp/caddy && chown 65532:65532 /tmp/caddy
COPY --from=caddy /caddy /usr/local/bin/caddy
COPY infrastructure/images/spa/Caddyfile infrastructure/images/spa/edge-off.caddy infrastructure/images/spa/edge-proxy.caddy /etc/caddy/
COPY --from=build /site /srv

ARG VITE_EDGE_URL
ARG APP
ARG USRP_BUILD_SHA=unknown
ARG USRP_BUILD_TIME=unknown
# Default: deny every powerful feature. The field station passes camera=(self).
ARG PERMISSIONS_POLICY="camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=()"
ENV XDG_CONFIG_HOME=/tmp/caddy \
    XDG_DATA_HOME=/tmp/caddy \
    USRP_EDGE_MODE=off \
    USRP_EDGE_UPSTREAM= \
    USRP_CONNECT_SRC=$VITE_EDGE_URL \
    USRP_PERMISSIONS_POLICY=$PERMISSIONS_POLICY
LABEL org.opencontainers.image.title="usrp-$APP" \
      org.opencontainers.image.source="https://github.com/Jackson-NSANZIMANA/e-recruitment-ui" \
      org.opencontainers.image.revision=$USRP_BUILD_SHA \
      org.opencontainers.image.created=$USRP_BUILD_TIME \
      org.opencontainers.image.licenses="UNLICENSED"

USER 65532:65532
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD ["wget", "-q", "--spider", "http://127.0.0.1:8080/healthz"]
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
