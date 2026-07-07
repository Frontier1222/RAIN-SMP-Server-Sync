import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import SftpClient from "ssh2-sftp-client";
import nbt from "prismarine-nbt";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(__dirname, "sftp.json"), "utf8"));
const LEVEL_DAT = "/worlds/Bedrock level/level.dat";

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

function walk(obj, fn, trail = []) {
  if (obj == null) return;
  if (typeof obj === "string") {
    fn(trail, obj);
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => walk(v, fn, [...trail, i]));
    return;
  }
  if (typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      fn([...trail, k], v);
      walk(v, fn, [...trail, k]);
    }
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
    const { parsed } = await nbt.parse(buf.subarray(8), "little");
    const data = simplify(parsed);

    const hits = [];
    walk(data, (trail, val) => {
      if (typeof val !== "string") return;
      if (/bop_ks|wypnt_bab|biomes_server|jigsaw|joint_type/i.test(val) || /jigsaw|joint_type/i.test(trail.join("."))) {
        hits.push({ path: trail.join("."), value: val.slice(0, 120) });
      }
    });

    console.log("matches:", hits.length);
    for (const h of hits.slice(0, 50)) console.log(h.path, "=", h.value);

    for (const key of ["minecraft:jigsaw_structure_metadata", "jigsaw_structure_metadata"]) {
      if (data[key] !== undefined) {
        console.log("\nfound key", key, JSON.stringify(data[key], null, 2).slice(0, 4000));
      }
    }
  } finally {
    fs.unlinkSync(tmp);
    await sftp.end();
  }
}

main().catch((e) => {
  console.error(e.stack || e.message || e);
  process.exit(1);
});
