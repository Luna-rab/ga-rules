import { expect, test } from "bun:test";
import { renderRuling } from "./rulings";

test("裁定の行は [cite_id](カードの URL) タイトル (日付): 本文 の形", () => {
  expect(
    renderRuling({
      citeId: "fabled-azurite-fatestone#ruling:2025-03-02:3",
      dateAdded: "2025-03-02",
      title: "T",
      description: "D",
    }),
  ).toBe(
    "[fabled-azurite-fatestone#ruling:2025-03-02:3](https://index.gatcg.com/card/fabled-azurite-fatestone) T (2025-03-02): D",
  );
});

test("URL の slug は cite_id のカード slug で、日付や番号が違っても変わらない", () => {
  const out = renderRuling({
    citeId: "beguiling-coup#ruling:2025-07-18:1",
    dateAdded: "2025-07-18",
    title: "Title",
    description: "Body",
  });
  expect(out).toBe(
    "[beguiling-coup#ruling:2025-07-18:1](https://index.gatcg.com/card/beguiling-coup) Title (2025-07-18): Body",
  );
});
