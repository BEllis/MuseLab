import { execSync } from "child_process";
import { existsSync } from "fs";
import path from "path";

export default async function globalSetup(): Promise<void> {
  const stamp = path.join(process.cwd(), "public/cito-wasm/.stamp");
  if (existsSync(stamp) && !process.env.CI) {
    return;
  }

  execSync("pnpm run build:cito-wasm", {
    cwd: process.cwd(),
    stdio: "inherit",
  });
}
