import type { Command } from "./types.js";

export function isCommand(value: unknown): value is Command {
  return (
    typeof value === "object" &&
    value !== null &&
    "data" in value &&
    "execute" in value
  );
}
