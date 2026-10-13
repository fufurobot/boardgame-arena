# fbg-server
FROM fbg-common:latest AS common
FROM oven/bun:1.1-alpine AS builder
RUN addgroup -g 938 appuser && adduser -h /appdata -S -u 997 -G appuser appuser && rm /bin/su
USER appuser
WORKDIR /appdata

# install and cache app dependencies
COPY --chown=appuser package.json bun.lock /appdata/
RUN bun install --frozen-lockfile

# config
COPY --chown=appuser tsconfig.json tsconfig.build.json nest-cli.json /appdata/

# build
COPY --chown=appuser src /appdata/src
RUN bun run build

FROM oven/bun:1.1-alpine
RUN addgroup -g 938 appuser && adduser -h /appdata -S -u 997 -G appuser appuser && rm /bin/su
USER appuser
WORKDIR /appdata

COPY --chown=appuser package.json bun.lock /appdata/
RUN bun install --frozen-lockfile --production

COPY --chown=appuser tsconfig.json tsconfig.build.json nest-cli.json /appdata/
COPY --chown=appuser --from=builder /appdata/dist /appdata/dist
# internal configs for FreeBoardGames.org
COPY --chown=appuser --from=common /internal /internal
COPY --chown=appuser --from=common /common /common

# run
CMD bun run start:prod
