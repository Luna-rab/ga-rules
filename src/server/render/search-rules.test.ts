import { expect, test } from "bun:test";
import { renderSearchRules } from "./search-rules";

test("hint だけの条文は、hint を外さずに見せる", () => {
  const out = renderSearchRules(
    [{ clauseId: "p#S:0", pageTitle: "P", text: "Example: Only a hint." }],
    [],
  );
  expect(out).toContain("- [p#S:0] (P) Example: Only a hint.");
});
