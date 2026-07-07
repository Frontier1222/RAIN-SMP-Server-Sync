const fs = require("fs");
const path = require("path");
const SftpClient = require("ssh2-sftp-client");

const config = JSON.parse(fs.readFileSync(path.join(__dirname, "sftp.json"), "utf8"));
const WORLD = "/worlds/Bedrock level";

async function walk(sftp, dir, depth = 0, out = []) {
  if (depth > 5) return out;
  let items;
  try {
    items = await sftp.list(dir);
  } catch {
    return out;
  }
  for (const item of items) {
    const p = `${dir}/${item.name}`.replace(/\/+/g, "/");
    if (/biome|bop|wypnt|bab/i.test(item.name)) out.push(`${item.type}\t${p}`);
    if (item.type === "d" && depth < 5) await walk(sftp, p, depth + 1, out);
  }
  return out;
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
    for (const dir of [`${WORLD}/behavior_packs`, `${WORLD}/resource_packs`, "/behavior_packs"]) {
      console.log(`\n=== ${dir} ===`);
      const hits = await walk(sftp, dir);
      console.log(hits.length ? hits.join("\n") : "(none)");
    }
  } finally {
    await sftp.end();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
