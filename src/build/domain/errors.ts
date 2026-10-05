export class DataError extends Error {
  constructor(
    readonly where: string,
    detail: string,
  ) {
    super();
    throw new Error(`not implemented: DataError(${where}, ${detail})`);
  }
}
