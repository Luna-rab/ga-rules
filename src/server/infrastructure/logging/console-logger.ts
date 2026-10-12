import type { ToolCallLogger } from "../../application/ports";

// Cloud Run が標準出力を Cloud Logging に取り込む。1 呼び出し 1 行の JSON。
export const logToolCall: ToolCallLogger = (entry) => {
  console.log(JSON.stringify(entry));
};
