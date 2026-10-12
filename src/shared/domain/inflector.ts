// domain が compromise を直接 import しないための境界。実装は infrastructure/nlp/
export type Inflector = {
  // 名詞の複数形を単数にする。単数の語はそのまま返す
  singular: (word: string) => string;
  // 活用形・派生形を原形に戻す（destroyed → destroy）
  root: (word: string) => string;
};
