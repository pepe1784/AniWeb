import test from "node:test";
import assert from "node:assert/strict";
import { sha256Hex, verifyArtifact, verifySha256, verifySize } from "../src/verify.mjs";

const ABC = new TextEncoder().encode("abc");
const ABC_SHA = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

test("sha256Hex coincide con el vector conocido", async () => {
  assert.equal(await sha256Hex(ABC), ABC_SHA);
});

test("verifySha256 acepta coincidencia (case-insensitive) y rechaza el resto", async () => {
  assert.equal(await verifySha256(ABC, ABC_SHA), true);
  assert.equal(await verifySha256(ABC, ABC_SHA.toUpperCase()), true);
  assert.equal(await verifySha256(ABC, "0".repeat(64)), false);
});

test("verifySize compara el tamano", () => {
  assert.equal(verifySize(ABC, 3), true);
  assert.equal(verifySize(ABC, 4), false);
});

test("verifyArtifact valida tamano y sha", async () => {
  const wasm = { url: "https://x/y.wasm", sha256: ABC_SHA, size: 3 };
  assert.deepEqual(await verifyArtifact(ABC, wasm), { ok: true });
  assert.equal((await verifyArtifact(ABC, { ...wasm, size: 1 })).ok, false);
  assert.equal((await verifyArtifact(ABC, { ...wasm, sha256: "0".repeat(64) })).ok, false);
  assert.equal((await verifyArtifact(ABC, null)).ok, false);
});
