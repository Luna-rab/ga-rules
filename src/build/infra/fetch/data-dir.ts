import { fileURLToPath } from "node:url";

// 手元でも Docker の 1 段目でも、リポジトリ直下の data/ を指す。
// Dockerfile は WORKDIR /app に src/ を置くので /app/data になる。
export const DATA_DIR = fileURLToPath(new URL("../../../../data/", import.meta.url));
export const RULES_DIR = `${DATA_DIR}rules`;
export const CARDS_DIR = `${DATA_DIR}cards`;
export const SOURCE_FILE = `${DATA_DIR}source.json`;
