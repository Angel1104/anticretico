import { Keypair } from "@stellar/stellar-sdk";

const kp = Keypair.random();
console.log("PUBLIC:", kp.publicKey());
console.log("SECRET:", kp.secret());
console.log("\nFund via Friendbot:");
console.log(`curl "https://friendbot.stellar.org?addr=${kp.publicKey()}"`);
