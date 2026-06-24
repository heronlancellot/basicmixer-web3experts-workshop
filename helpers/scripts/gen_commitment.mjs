import { buildPoseidon } from "circomlibjs";
import crypto from "crypto";

function randField() {
  // 31 bytes < BN254 field size
  return BigInt("0x" + crypto.randomBytes(31).toString("hex"));
}

function toBytes32(x) {
  return "0x" + x.toString(16).padStart(64, "0");
}


async function main() {
  const poseidon = await buildPoseidon();
  const F = poseidon.F;

  // Private inputs
  const secret = randField();
  const nullifier = randField();
  //const secret = 21183323962847963401757235586527753430082850194744802344553123514502094281487n;
  //const nullifier = 449923872617343972930614807539800076469236091160820040557567436683998548601n;
  // Poseidon(secret, nullifier)
  const commitmentRaw = poseidon([secret, nullifier]);

  // Convert to Field element (BigInt)
  const commitment = F.toObject(commitmentRaw);
  const commitmentBytes32 = toBytes32(commitment);
  console.log("secret:     ", secret.toString());
  console.log("nullifier:  ", nullifier.toString());
  console.log("commitment: ", commitmentBytes32.toString());
}

main();
