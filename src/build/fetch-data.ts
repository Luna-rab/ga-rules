import { fetchData } from "./infrastructure/fetch/fetch";

// 使い方: bun run fetch:data
if (import.meta.main) {
  console.log(JSON.stringify(await fetchData()));
}
