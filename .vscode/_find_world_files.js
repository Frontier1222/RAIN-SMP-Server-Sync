const fs = require("fs");
const path = require("path");
const SftpClient = require("ssh2-sftp-client");

const config = JSON.parse(fs.readFileSync(path.join(__dirname, "sftp.json"), "utf8"));
const WORLD = "/worlds/Bedrock level";

async function listRecursive(sftp, dir, depth = 0, hits = []) {
  if (depth > 4) return hits;
  let items;
  try {
    items = await sftp.list(dir);
  } catch {
    return hits;
  }
  for (const item of items) {
    const p = `${dir}/${item.name}`.replace(/\/+/g, "/");
    const lower = item.name.toLowerCase();
    if (lower.includes("biome") || lower.includes("jigsaw") || lower.includes("structure")) {
      hits.push(`${item.type} ${p}`);
    }
    if (item.type === "d" && depth < 4) await listRecursive(sftp, p, depth + 1, hits);
  }
  return hits;
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
  try {
    const hits = await listRecursive(sftp, WORLD);
    console.log(hits.join("\n"));
    for (const rel of ["biomes_server.json", "biomes_server", "level.dat"]) {
      const p = `${WORLD}/${rel}`;
      const exists = await sftp.exists(p);
      console.log(`${p}: ${exists || "missing"}`);
    }
  } finally {
    await sftp.end();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
