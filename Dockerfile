# タグは package.json の packageManager と揃える。
FROM oven/bun:1.4.2 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# 1 段目: ルール文書とカードを取得して index.sqlite を作る。
FROM oven/bun:1.4.2 AS index
WORKDIR /app
COPY --from=deps /app/node_modules node_modules
COPY package.json ./
COPY src/shared src/shared
COPY src/build src/build
# ビルドのたびに値を変えて、ここから下のキャッシュを捨てる。
# キャッシュが効くと、古いルール・カードのまま新しいイメージができる。
ARG DATA_VERSION
RUN test -n "$DATA_VERSION" || (echo "--build-arg DATA_VERSION=... を渡す" >&2; exit 1)
RUN bun run build:index /app/index.sqlite

# 2 段目: 実行用。取り込みのコードは入れない。
FROM oven/bun:1.4.2
WORKDIR /app
ENV NODE_ENV=production PORT=8080 INDEX_PATH=/app/index.sqlite
COPY --from=deps /app/node_modules node_modules
COPY package.json ./
COPY src/shared src/shared
COPY src/server src/server
COPY --from=index /app/index.sqlite ./
USER bun
EXPOSE 8080
CMD ["bun", "run", "src/server/index.ts"]
