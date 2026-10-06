export type ToolCallLog = { tool: string; args: unknown; count: number; ms: number };

export function logToolCall(_entry: ToolCallLog): void {
  throw new Error("未実装");
}
