export type ToolCallLog = { tool: string; args: unknown; count: number; ms: number; error?: true };

// Cloud Run が標準出力を Cloud Logging に取り込む。1 呼び出し 1 行の JSON。
export function logToolCall(entry: ToolCallLog): void {
  console.log(JSON.stringify(entry));
}
