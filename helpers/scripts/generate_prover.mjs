import { buildPoseidon } from "circomlibjs";

// ================================
// CONFIG
// ================================
const TREE_DEPTH = 20;

// ================================
// Field helpers
// ================================
function fieldToString(poseidon, x) {
  // Ensure x is a field element
  return poseidon.F.toString(poseidon.F.e(x));
}

function fieldToBytes32(poseidon, x) {
  const v = BigInt(poseidon.F.toObject(poseidon.F.e(x)));
  return "0x" + v.toString(16).padStart(64, "0");
}

function bytes32ToBigInt(x) {
  if (typeof x === "bigint") return x;
  if (typeof x === "string" && x.startsWith("0x")) return BigInt(x);
  throw new Error("invalid bytes32");
}

const bytesToBigInt = (bytes) => {
    let hex = "0x" + Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
    return BigInt(hex);
};
// ================================
// Build zero nodes
// ================================
function buildZeroes(poseidon, depth) {
  const zeroes = [];
  zeroes[0] = poseidon([0n, 0n]);
  for (let i = 1; i < depth; i++) {
    zeroes[i] = poseidon([zeroes[i - 1], zeroes[i - 1]]);
  }
  return zeroes;
}

// ================================
// Merkle tree insertion
// ================================
function insertLeaf(poseidon, leaf, leafIndex, zeros, filledSubtrees) {
  let currentHash = leaf;
  let index = leafIndex;

  const merklePath = [];
  const merkleIndices = [];

  for (let i = 0; i < TREE_DEPTH; i++) {
    const isRightNode = index % 2 === 1;
    let sibling;

    if (!isRightNode) {
      sibling = zeros[i];
      filledSubtrees[i] = currentHash;
      currentHash = poseidon([currentHash, sibling]);
    } else {
      sibling = filledSubtrees[i];
      currentHash = poseidon([sibling, currentHash]);
    }

    merklePath.push(sibling);
    merkleIndices.push(index % 2);
    index = Math.floor(index / 2);
  }

  const root = currentHash;
  return { root, merklePath, merkleIndices };
}

// ================================
// Main
// ================================
async function main() {
  const poseidon = await buildPoseidon();

  // ===== Public commitments from Solidity (bytes32)
  // MUST be sorted by leafIndex =====
  const commitments = [
    "0x03628e1a532dee6bca08b6d79fd8d2893f87708308f9dfcd719914a94f137aef"
  ];

  const zeroes = buildZeroes(poseidon, TREE_DEPTH);
  const filledSubtrees = [...zeroes];

  // Replay the tree for each leaf
  for (let leafIndex = 0; leafIndex < commitments.length; leafIndex++) {
    const commitmentBigInt = bytes32ToBigInt(commitments[leafIndex]);

    const { root, merklePath, merkleIndices } = insertLeaf(
      poseidon,
      commitmentBigInt,
      leafIndex,
      zeroes,
      filledSubtrees
    );

    const secret = 127988554722150882332921756188460914283255506234264131555344421658261770157n;
    const nullifierA = 425732219186421530333384847352878792236048357913516870755528129851747937838n;
    const nullifier_hash = poseidon([nullifierA, 0n]);
    const commitment = poseidon([secret, nullifierA]);
    console.log("\nRecomputed commitment =", `"${fieldToBytes32(poseidon, commitment)}"`);


    console.log(`===== Deposit #${leafIndex} =====`);

    console.log(`leafIndex = "${leafIndex}"`);
    console.log("commitment =", `"${commitmentBigInt}"`);

    console.log("\nsecret = ", `"${secret}"`);
    console.log("\nnullifier = ", `"${nullifierA}"`);
    console.log("\nnullifier_hash = ", `"${(fieldToString(poseidon, nullifier_hash))}"`);
    console.log("nullifier_hash_bytes32 = ", `"${(fieldToBytes32(poseidon, nullifier_hash))}"`);

    console.log("\nmerkle_path = [");
    merklePath.forEach(v => console.log(`  "${fieldToString(poseidon, v)}",`));
    console.log("]");

    console.log("\nmerkle_indices = [");
    merkleIndices.forEach(i => console.log(`  ${i},`));
    console.log("]");

    console.log(`\nroot = "${fieldToString(poseidon, root)}"`);
    console.log(`root_bytes32 = "${fieldToBytes32(poseidon, root)}"`);
    console.log("\n");
  }
}

main()
