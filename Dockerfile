# syntax=docker/dockerfile:1.7
FROM denoland/deno:debian-2.9.5 AS builder

WORKDIR /app
COPY deno.json main.ts ./
COPY src ./src
COPY public ./public

RUN deno check main.ts && deno compile \
    --output=/app/petpass \
    --allow-net=0.0.0.0:8000,127.0.0.1:8000 \
    --allow-read=/app/public,/data \
    --allow-write=/data \
    --allow-env=APP_PORT,APP_HOST,APP_DB_PATH,APP_ORIGIN,APP_COUNTRY_CODE \
    --include=/app/public \
    main.ts && \
    mkdir -p /data && chown 65532:65532 /data

FROM gcr.io/distroless/cc-debian12:nonroot

ARG VERSION=dev
ARG REVISION=unknown
ARG SOURCE=https://github.com/Nehoko/eu-pet-passport
LABEL org.opencontainers.image.title="PetPass Personal" \
      org.opencontainers.image.description="Self-hosted personal digital copies of EU pet passports" \
      org.opencontainers.image.version="$VERSION" \
      org.opencontainers.image.revision="$REVISION" \
      org.opencontainers.image.source="$SOURCE" \
      org.opencontainers.image.licenses="MIT"

WORKDIR /app
COPY --from=builder --chown=65532:65532 /app/petpass /app/petpass
COPY --from=builder --chown=65532:65532 /app/public /app/public
COPY --from=builder --chown=65532:65532 /data /data

USER 65532:65532
ENV APP_DB_PATH=/data/petpass.db
EXPOSE 8000
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["/app/petpass", "healthcheck", "http://127.0.0.1:8000/health/ready"]
ENTRYPOINT ["/app/petpass"]
