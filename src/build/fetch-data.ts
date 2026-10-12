import { fetchData } from "./infrastructure/fetch/fetch";

// 使い方: bun run fetch:data
console.log(JSON.stringify(await fetchData()));
