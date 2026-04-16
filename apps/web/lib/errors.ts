export class GameGenerationError extends Error {
  constructor(message = "Game generation failed.") {
    super(message);
    this.name = "GameGenerationError";
  }
}
