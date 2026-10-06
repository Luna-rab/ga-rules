import { describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { z } from "zod";

// bun run test に src/server が混ざると、索引が無い環境（CI の bun run check）で落ちる。
const Pkg = z.object({ scripts: z.record(z.string(), z.string()) });
const pkg = Pkg.parse(
  await Bun.file(fileURLToPath(new URL("../../package.json", import.meta.url))).json(),
);

describe("package.json の scripts", () => {
  test("test は索引ビルドと src/shared だけを流し、src/server を含めない", () => {
    expect(pkg.scripts.test).toBe("bun test src/build src/shared");
    expect(pkg.scripts.test).not.toContain("src/server");
  });

  test("test:server は src/server を流す", () => {
    expect(pkg.scripts["test:server"]).toBe("bun test src/server");
  });
});
