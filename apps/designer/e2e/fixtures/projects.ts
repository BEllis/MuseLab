import { readFileSync } from "fs";
import path from "path";

const fixtureDir = path.join(import.meta.dirname, "data");

function readFixture(name: string): string {
  return readFileSync(path.join(fixtureDir, name), "utf8");
}

export function starterProjectPayload(): string {
  return readFixture("starter-project.json");
}

export function playableProjectPayload(): string {
  return readFixture("playable-project.json");
}
