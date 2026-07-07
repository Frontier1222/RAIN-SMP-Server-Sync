const fs = require("fs");
const path = require("path");
const os = require("os");
const SftpClient = require("ssh2-sftp-client");
const nbt = require("prismarine-nbt");
const zlib = require("zlib");

const config = JSON.parse(fs.readFileSync(path.join(__dirname, "sftp.json"), "utf8"));
const DB_DIR = "/worlds/Bedrock level/db";

function simplify(value) {
  if (value && typeof value === "object" && "type" in value && "value" in value) {
    if (value.type === "compound") {
      const out = {};
      for (const [k, v] of Object.entries(value.value)) out[k] = simplify(v);
      return out;
    }
    if (value.type === "list") return value.value.map(simplify);
    return value.value;
  }
  return value;
}

function scanBuf(buf, label) {
  const text = buf.toString("latin1");
  const needles = ["biomes_server", "bop_ks:", "wypnt_bab:", "jigsaw_structure_metadata", "joint_type"];
  for (const n of needles) {
    const idx = text.indexOf(n);
    if (idx >= 0) console.log(`${label}: found "${n}" at ${idx}`);
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

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bedrock-db-"));
  try {
    const items = await sftp.list(DB_DIR);
    const files = items.filter((i) => i.type === "-").slice(0, 30);
    console.log(`Scanning ${files.length} db files...`);

    for (const item of files) {
      const remote = `${DB_DIR}/${item.name}`;
      const local = path.join(tmpDir, item.name);
      await sftp.get(remote, local);
      const buf = fs.readFileSync(local);

      scanBuf(buf, item.name);

      // try zlib inflate chunks
      for (let off = 0; off < Math.min(buf.length, 200); off++) {
        try {
          const inflated = zlib.inflateSync(buf.subarray(off));
          scanBuf(inflated, `${item.name}@zlib${off}`);
        } catch {}
        try {
          const inflated = zlib.inflateRawSync(buf.subarray(off));
          scanBuf(inflated, `${item.name}@raw${off}`);
        } catch {}
      }
    }

    // Parse level.dat experiments
    const levelTmp = path.join(tmpDir, "level.dat");
    await sftp.get("/worlds/Bedrock level/level.dat", levelTmp);
    const levelBuf = fs.readFileSync(levelTmp);
    const { parsed } = await nbt.parse(levelBuf.subarray(8), "little");
    const data = simplify(parsed);
    console.log("\nlevel.dat experiments:", JSON.stringify(data.experiments, null, 2)?.slice(0, 2000));
    console.log("level.dat keys containing biome:", Object.keys(data).filter((k) => /biome/i.test(k)));
    for (const [k, v] of Object.entries(data)) {
      const s = JSON.stringify(v);
      if (/bop_ks|wypnt_bab|biomes_server|jigsaw/i.test(s)) {
        console.log(`level key ${k}:`, s.slice(0, 500));
      }
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    await sftp.end();
  }
}

main().catch((e) => {
  console.error(e.stack || e.message || e);
  process.exit(1);
});
