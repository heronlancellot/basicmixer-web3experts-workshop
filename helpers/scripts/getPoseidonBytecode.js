const { poseidonContract } = require("circomlibjs");

const bytecode = poseidonContract.createCode(2);
console.log(bytecode);
