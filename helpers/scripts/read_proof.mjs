import { readFileSync } from "fs";
import { resolve, join } from "path";

const CIRCUIT_DIR = resolve(import.meta.dirname, "../../circuits/basicmixer/target");

function toHex(buf) {
  return "0x" + buf.toString("hex");
}

const proof = readFileSync(join(CIRCUIT_DIR, "proof"));
const publicInputsRaw = readFileSync(join(CIRCUIT_DIR, "public_inputs"));

// Public inputs are packed 32-byte field elements
const fields = [];
for (let i = 0; i < publicInputsRaw.length; i += 32) {
  fields.push(toHex(publicInputsRaw.subarray(i, i + 32)));
}

const labels = ["root", "nullifier_hash"];

console.log("=== Public Inputs ===");
fields.forEach((f, i) => {
  const label = labels[i] ?? `field_${i}`;
  console.log(`${label.padEnd(16)}: ${f}`);
});

console.log("\n=== Public Inputs (Solidity array) ===");
console.log(`[${fields.join(", ")}]`);

console.log("\n=== Proof ===");
console.log(toHex(proof));

console.log("\n=== Proof (bytes length) ===");
console.log(`${proof.length} bytes`);
