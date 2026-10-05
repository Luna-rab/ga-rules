import { $ } from "bun";
import { mkdirSync, rmSync } from "node:fs";
import { z } from "zod";
import { CARDS_DIR, DATA_DIR, RULES_DIR, SOURCE_FILE } from "./data-dir";

const RULES_REPO = "weebsoftheshore/gitbook-rules";
const RULES_BRANCH = "main";
const CARDS_URL = "https://api.gatcg.com/cards/search";
// API の上限。これより大きくしても 50 件で返る。
const CARDS_PAGE_SIZE = 50;
const USER_AGENT = "ga-rules (+https://github.com/Luna-rab/ga-rules)";

async function fetchOk(url: string, headers: Record<string, string> = {}): Promise<Response> {
  const attempts = 3;
  for (let i = 1; ; i++) {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, ...headers } });
    if (res.ok) return res;
    if (i === attempts) throw new Error(`GET ${url}: ${res.status} ${res.statusText}`);
    await Bun.sleep(1000 * i);
  }
}

// ブランチ名で tarball を取ると、SHA の確認との間に push が入ったときに記録と中身がずれる。
// 先に SHA を決め、その SHA の tarball を取る。
async function fetchRules(): Promise<string> {
  const commit = (
    await (
      await fetchOk(`https://api.github.com/repos/${RULES_REPO}/commits/${RULES_BRANCH}`, {
        Accept: "application/vnd.github.sha",
      })
    ).text()
  ).trim();

  const tarball = `${DATA_DIR}rules.tar.gz`;
  await Bun.write(
    tarball,
    await fetchOk(`https://codeload.github.com/${RULES_REPO}/tar.gz/${commit}`),
  );
  mkdirSync(RULES_DIR, { recursive: true });
  // .gitbook/ の画像はモデルに渡さないので、.md だけを展開する。
  await $`tar -xzf ${tarball} -C ${RULES_DIR} --strip-components=1 --wildcards '*.md'`;
  rmSync(tarball);
  // 直下の README.md は変更履歴で、どのツールからも返さない。table-of-contents.md は SUMMARY.md と同じ目次。
  // サブディレクトリの README.md はルールのページなので残す。
  rmSync(`${RULES_DIR}/README.md`);
  rmSync(`${RULES_DIR}/table-of-contents.md`);
  return commit;
}

// 要件に使う列だけを定義する。z.object は定義に無いキーを落とすので、ここに無い列は保存されない。
// 各列を残す理由・捨てる理由は DESIGN.md の「カードの取り込み」を参照。
const Card = z.object({
  // ファイル名に使う。英小文字・数字・ハイフン以外が来たら、パスを壊す前に止める。
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  types: z.array(z.string()),
  subtypes: z.array(z.string()),
  classes: z.array(z.string()),
  // element は 1 つしか持たず、Exalted のカードでは EXALTED だけになって Fire などの条件が落ちる。
  // プレイに要る元素はすべて elements にある。
  elements: z.array(z.string()),
  // cost_reserve / cost_memory は X コストを -1 で表すので使わない。
  cost: z.object({ type: z.string(), value: z.string().nullable() }),
  level: z.number().nullable(),
  power: z.number().nullable(),
  life: z.number().nullable(),
  durability: z.number().nullable(),
  speed: z.boolean().nullable(),
  effect_raw: z.string().nullable(),
  rule: z
    .array(z.object({ title: z.string(), date_added: z.string(), description: z.string() }))
    .nullable(),
  references: z
    .array(
      z.object({ kind: z.string(), name: z.string(), slug: z.string(), direction: z.string() }),
    )
    .nullable(),
  legality: z.record(z.string(), z.object({ limit: z.number() })).nullable(),
});

const CardsPage = z.object({
  data: z.array(Card),
  total_cards: z.number(),
  total_pages: z.number(),
});

async function fetchCardsPage(page: number): Promise<z.infer<typeof CardsPage>> {
  const res = await fetchOk(`${CARDS_URL}?page_size=${CARDS_PAGE_SIZE}&page=${page}`);
  return CardsPage.parse(await res.json());
}

async function fetchCards(): Promise<number> {
  // API は 1 ページに約 2 秒かかり、50 ページを順に取ると 1 分半を超える。
  // 1 ページ目で総ページ数を知り、残りを 5 本ずつ並べて取る。
  const first = await fetchCardsPage(1);
  const pages = [first];
  const concurrency = 5;
  for (let start = 2; start <= first.total_pages; start += concurrency) {
    const end = Math.min(start + concurrency - 1, first.total_pages);
    const batch = Array.from({ length: end - start + 1 }, (_, i) => fetchCardsPage(start + i));
    pages.push(...(await Promise.all(batch)));
  }
  const cards = pages.flatMap((p) => p.data);
  // ページの取りこぼしや途中で変わった総数は HTTP のエラーにならない。件数で見つける。
  if (cards.length !== first.total_cards) {
    throw new Error(`cards: got ${cards.length}, API reports total_cards=${first.total_cards}`);
  }
  // slug が重なると後のカードが前のファイルを上書きし、黙って 1 枚消える。
  const slugs = new Set(cards.map((c) => c.slug));
  if (slugs.size !== cards.length) {
    throw new Error(`cards: ${cards.length - slugs.size} duplicate slug(s)`);
  }
  mkdirSync(CARDS_DIR, { recursive: true });
  await Promise.all(
    cards.map((c) => Bun.write(`${CARDS_DIR}/${c.slug}.json`, `${JSON.stringify(c, null, 2)}\n`)),
  );
  return cards.length;
}

// 前回の取得で残ったファイルが混ざらないよう、毎回空にしてから取る。
rmSync(DATA_DIR, { recursive: true, force: true });
mkdirSync(DATA_DIR, { recursive: true });

const [rulesCommit, cardCount] = await Promise.all([fetchRules(), fetchCards()]);

const source = {
  rules: { repo: RULES_REPO, commit: rulesCommit },
  cards: { count: cardCount },
  fetchedAt: new Date().toISOString(),
};
await Bun.write(SOURCE_FILE, `${JSON.stringify(source, null, 2)}\n`);
console.log(JSON.stringify(source));
