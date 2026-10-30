import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const CLI = fileURLToPath(new URL("../bin/rounded-9-patch.js", import.meta.url));

function runCli(args) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
}

test("generates the .9.png at the chosen path", () => {
  const dir = mkdtempSync(join(tmpdir(), "rounded-9-patch-"));
  const outPath = join(dir, "focus.9.png");

  try {
    const result = runCli(["--radius", "6", "--stroke", "4", "--out", outPath]);

    assert.equal(result.status, 0, result.stderr);
    assert.ok(existsSync(outPath));
    assert.match(result.stdout, /16x16, cantos fixos de 6px/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("fails without --radius when it cannot ask in a terminal", () => {
  const result = runCli(["--stroke", "4"]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /--radius é obrigatório/);
});

test("rejects an output path that is not .9.png", () => {
  const result = runCli(["--radius", "6", "--out", "border.png"]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /precisa terminar em "\.9\.png"/);
});
