export class DataError extends Error {
  constructor(
    readonly where: string,
    detail: string,
  ) {
    super(`${where}: ${detail}`);
    this.name = "DataError";
  }
}
