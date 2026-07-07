const fs = require("fs");
const path = require("path");
const os = require("os");
const SftpClient = require("ssh2-sftp-client");
const nbt = require("prismarine-nbt");

const config = JSON.parse(fs.readFileSync(path.join(__dirname, "sftp.json"), "utf8"));
const LEVEL_DAT = "/worlds/Bedrock level/level.dat";

async function tryParse(buf, label, offset = 0) {
  try {
    const slice = buf.subarray(offset);
    const { parsed } = await nbt.parse(slice, "little");
    console.log(`\n${label} offset=${offset} OK keys:`, Object.keys(parsed.value || parsed));
    return parsed;
  } catch (e) {
    console.log(`\n${label} offset=${offset} FAIL:`, e.message);
    return null;
  }
}

async function main() {
  const sftp = new SftpClient();
  await sftp.connect({
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    readyTimeout: 30000,
  });

  const tmp = path.join(os.tmpdir(), `level-${Date.now()}.dat`);
  try {
    await sftp.get(LEVEL_DAT, tmp);
    const buf = fs.readFileSync(tmp);
    console.log("size:", buf.length);
    console.log("first 32 bytes:", buf.subarray(0, 32).toString("hex"));

    const v0 = buf.readInt32LE(0);
    const v4 = buf.readInt32LE(4);
    const v8 = buf.readInt32LE(8);
    console.log("int32@0:", v0, "int32@4:", v4, "int32@8:", v8);

    for (const off of [0, 4, 8, 12, 16]) {
      await tryParse(buf, "nbt", off);
    }

    const text = buf.toString("utf8", 0, Math.min(buf.length, 500000));
    const bop = (text.match(/bop_ks:[a-z0-9_]+/g) || []).slice(0, 5);
    const wypnt = (text.match(/wypnt_bab:[a-z0-9_]+/g) || []).slice(0, 5);
    const joint = text.includes("joint_type");
    console.log("\nraw string scan bop:", bop);
    console.log("raw string scan wypnt:", wypnt);
    console.log("contains joint_type:", joint);
  } finally {
    fs.unlinkSync(tmp);
    await sftp.end();
  }
}

main().catch((e) => {
  console.error(e.stack || e.message || e);
  process.exit(1);
});
