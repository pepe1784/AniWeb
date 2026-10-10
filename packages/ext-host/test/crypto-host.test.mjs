import test from "node:test";
import assert from "node:assert/strict";
import { base64Decode, base64Encode, md5, sha256 } from "../src/crypto-host.mjs";

function hex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const ABC = new TextEncoder().encode("abc");
const FOX = new TextEncoder().encode("The quick brown fox jumps over the lazy dog");

test("sha256 coincide con vectores conocidos", () => {
  assert.equal(hex(sha256(new Uint8Array(0))), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assert.equal(hex(sha256(ABC)), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(hex(sha256(FOX)), "d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592");
});

test("md5 coincide con vectores conocidos", () => {
  assert.equal(hex(md5(new Uint8Array(0))), "d41d8cd98f00b204e9800998ecf8427e");
  assert.equal(hex(md5(ABC)), "900150983cd24fb0d6963f7d28e17f72");
  assert.equal(hex(md5(FOX)), "9e107d9d372bb6826bd81d3542a419d6");
});

test("base64 codifica y decodifica (roundtrip)", () => {
  const bytes = new Uint8Array([104, 101, 108, 108, 111]);
  assert.equal(base64Encode(bytes), "aGVsbG8=");
  assert.deepEqual(base64Decode("aGVsbG8="), bytes);
  assert.deepEqual(base64Decode(base64Encode(ABC)), ABC);
  assert.equal(base64Encode(new Uint8Array(0)), "");
});

test("base64Decode lanza string ante entrada invalida", () => {
  assert.throws(() => base64Decode("abc"), (e) => typeof e === "string");
  assert.throws(() => base64Decode("!!!!"), (e) => typeof e === "string");
});

test("sha256 y md5 coinciden con WebCrypto/Node en entradas grandes", async () => {
  const data = new Uint8Array(1000).fill(0x61);
  const expected = hex(new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", data)));
  assert.equal(hex(sha256(data)), expected);
  // 4096 bytes para cruzar varios bloques y el padding.
  const big = new Uint8Array(4096).map((_, i) => i & 0xff);
  const expectedBig = hex(new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", big)));
  assert.equal(hex(sha256(big)), expectedBig);
});
