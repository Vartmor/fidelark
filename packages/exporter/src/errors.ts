/** A resource could not be loaded; the message is a short, user-facing reason. */
export class LoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LoadError";
  }
}
