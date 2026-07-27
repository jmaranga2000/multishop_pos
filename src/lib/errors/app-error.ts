export class AppError extends Error {
  constructor(
    message: string,
    public readonly code = "APPLICATION_ERROR",
    public readonly status = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}
