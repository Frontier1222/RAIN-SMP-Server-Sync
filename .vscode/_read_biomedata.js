const fs = require("fs");
const path = require("path");
const os = require("os");
const SftpClient = require("ssh2-sftp-client");
const { readLevelDb } = await import("mcbe-level");
const nbt = require("prismarine-nbt");

const config = JSON.parse(fs.readFileSync(path.join(__dirname, "sftp.json"), "utf8"));
const REMOTE_DB = "/worlds/Bedrock level/db";

function simplify(value) {
  if (value && typeof value === "object" && "type" in value && "value" in value) {
    if (value.type === "compound") {
      const out = {};
      for (const [k, v] of Object.entries(value.value)) out[k] = simplify(v);
      return out;
    }
    if (value.type === "list") {
      const v = value.value;
      return Array.isArray(v) ? v.map(simplify) : v;
    }
    return value.value;
  }
  return value;
}

async function downloadDb(sftp, localDir) {
  fs.mkdirSync(localDir, { recursive: true });
  const items = await sftp.list(REMOTE_DB);
  for (const item of items) {
    if (item.type !== "-") continue;
    const remote = `${REMOTE_DB}/${item.name}`;
    const local = path.join(localDir, item.name);
    process.stdout.write(`  ${item.name}\r`);
    await sftp.get(remote, local);
  }
  console.log(`Downloaded ${items.filter((i) => i.type === "-").length} db files`);
}

async function main() {
  const sftp = new SftpClient();
  await sftp.connect({
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    readyTimeout: 120000,
  });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bedrock-db-full-"));
  try {
    console.log("Downloading world db...");
    await downloadDb(sftp, tmpDir);

    const files = fs.readdirSync(tmpDir).map((name) => ({
      name,
      content: fs.readFileSync(path.join(tmpDir, name)),
    }));

    console.log("Reading LevelDB...");
    const keys = await readLevelDb(files);

    const interesting = Object.keys(keys).filter((k) =>
      /biome|jigsaw|structure|template/i.test(k)
    );
    console.log("\nInteresting keys:", interesting);

    for (const key of ["BiomeData", "structuretemplate", "LevelChunkMetaDataDictionary"]) {
      const entry = keys[key];
      if (!entry?.value) {
        console.log(`\n${key}: missing`);
        continue;
      }
      console.log(`\n${key}: ${entry.value.length} bytes`);
      try {
        const { parsed } = await nbt.parse(entry.value, "little");
        const data = simplify(parsed);
        const json = JSON.stringify(data);
        if (/bop_ks|wypnt_bab|biomes_server|jigsaw|joint_type/i.test(json)) {
          console.log(JSON.stringify(data, null, 2).slice(0, 8000));
        } else {
          console.log("top keys:", typeof data === "object" ? Object.keys(data) : data);
        }
      } catch (e) {
        const text = entry.value.toString("latin1");
        console.log("NBT parse failed:", e.message);
        console.log("raw contains bop:", text.includes("bop_ks"));
        console.log("raw contains biomes_server:", text.includes("biomes_server"));
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
