# タグは package.json の packageManager と揃える。
# --production の依存だけを入れる。最後の段（実行用）がこの node_modules をコピーする。
FROM oven/bun:1.4.2 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# 1 段目: ルール文書とカードを取得して index.sqlite を作る。
# build:index は drizzle-kit で DDL を作るので、開発用の依存も入れる。
FROM oven/bun:1.4.2 AS index
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY src/shared src/shared
COPY src/build src/build
# ビルドのたびに値を変えて、ここから下のキャッシュを捨てる。
# キャッシュが効くと、古いルール・カードのまま新しいイメージができる。
ARG DATA_VERSION
RUN test -n "$DATA_VERSION" || (echo "--build-arg DATA_VERSION=... を渡す" >&2; exit 1)
# 手元の bun run fetch:data と同じく /app/data に置く。手元の data/ は .dockerignore で入れない。
RUN bun run fetch:data
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
