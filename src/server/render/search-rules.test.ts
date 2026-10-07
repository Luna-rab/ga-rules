import { expect, test } from "bun:test";
import { renderSearchRules } from "./search-rules";

test("hint だけの条文は、hint を外さずに見せる", () => {
  const out = renderSearchRules(
    [{ clauseId: "p#S:0", pageTitle: "P", text: "例: Only a hint." }],
    [],
  );
  expect(out).toContain("- [p#S:0] (P) 例: Only a hint.");
});
