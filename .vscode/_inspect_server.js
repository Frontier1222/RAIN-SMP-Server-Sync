const fs = require("fs");
const path = require("path");
const SftpClient = require("ssh2-sftp-client");

const TOOL_DIR = __dirname;
const config = JSON.parse(fs.readFileSync(path.join(TOOL_DIR, "sftp.json"), "utf8"));

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
    const bpItems = await sftp.list("/behavior_packs");
    console.log("behavior_packs on server:");
    for (const item of bpItems) {
      if (!item.name.toLowerCase().includes("rain")) continue;
      console.log(`  ${item.type} ${item.name}`);
      try {
        const manifestPath = `/behavior_packs/${item.name}/manifest.json`;
        const tmp = path.join(require("os").tmpdir(), `manifest-${Date.now()}.json`);
        await sftp.get(manifestPath, tmp);
        const m = JSON.parse(fs.readFileSync(tmp, "utf8"));
        fs.unlinkSync(tmp);
        const api = (m.dependencies || []).find((d) => d.module_name === "@minecraft/server");
        console.log(`    version: ${m.header.version.join(".")} | ${m.header.description}`);
        console.log(`    api: ${api ? api.version : "none"}`);
      } catch (e) {
        console.log(`    (no manifest: ${e.message})`);
      }
    }

    for (const check of [
      "/behavior_packs/RAIN SMP E BP/manifest.json",
      "/worlds/Bedrock level/world_behavior_packs.json",
      "/world_behavior_packs.json",
    ]) {
      try {
        const tmp = path.join(require("os").tmpdir(), `check-${Date.now()}.json`);
        await sftp.get(check, tmp);
        const text = fs.readFileSync(tmp, "utf8");
        fs.unlinkSync(tmp);
        console.log(`\n=== ${check} ===`);
        console.log(text.slice(0, 800));
      } catch {
        console.log(`\n(missing) ${check}`);
      }
    }
  } finally {
    await sftp.end();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
