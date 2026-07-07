const fs = require("fs");
const path = require("path");
const SftpClient = require("ssh2-sftp-client");

const TOOL_DIR = __dirname;
const config = JSON.parse(fs.readFileSync(path.join(TOOL_DIR, "sftp.json"), "utf8"));

const WORLD_BP = "/worlds/Bedrock level/world_behavior_packs.json";
const WORLD_RP = "/worlds/Bedrock level/world_resource_packs.json";
const RAIN_BP_UUID = "5c3e8a44-12bc-4876-92a1-8d2b7e1f44c9";
const RAIN_RP_UUID = "e1b873a8-1336-4ea0-ba78-3a56085796e9";

async function getJson(sftp, remotePath) {
  const tmp = path.join(require("os").tmpdir(), `sftp-${Date.now()}.json`);
  await sftp.get(remotePath, tmp);
  const raw = fs.readFileSync(tmp, "utf8");
  fs.unlinkSync(tmp);
  const stripped = raw.replace(/\/\/.*$/gm, "").replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(stripped);
}

async function putJson(sftp, remotePath, data) {
  const tmp = path.join(require("os").tmpdir(), `sftp-out-${Date.now()}.json`);
  fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await sftp.put(tmp, remotePath);
  fs.unlinkSync(tmp);
}

async function removeDir(sftp, remoteDir) {
  const items = await sftp.list(remoteDir);
  for (const item of items) {
    const remotePath = `${remoteDir}/${item.name}`;
    if (item.type === "d") await removeDir(sftp, remotePath);
    else await sftp.delete(remotePath);
  }
  await sftp.rmdir(remoteDir);
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
    console.log("Updating world pack version pins...");
    const worldBp = await getJson(sftp, WORLD_BP);
    for (const entry of worldBp) {
      if (entry.pack_id === RAIN_BP_UUID) {
        entry.version = [1, 0, 7078];
        console.log("  RAIN SMP BP -> 1.0.7078");
      }
    }
    await putJson(sftp, WORLD_BP, worldBp);

    try {
      const worldRp = await getJson(sftp, WORLD_RP);
      let changed = false;
      for (const entry of worldRp) {
        if (entry.pack_id === RAIN_RP_UUID) {
          entry.version = [1, 0, 65];
          changed = true;
          console.log("  RAIN SMP RP -> 1.0.65");
        }
      }
      if (changed) await putJson(sftp, WORLD_RP, worldRp);
    } catch (e) {
      console.log("  (world_resource_packs.json skipped:", e.message, ")");
    }

    const duplicate = "/behavior_packs/RAIN SMP E BP 1";
    const exists = await sftp.exists(duplicate);
    if (exists) {
      console.log("Removing duplicate old pack folder:", duplicate);
      await removeDir(sftp, duplicate);
    }

    console.log("\nUploading full RAIN SMP E BP...");
    const { spawnSync } = require("child_process");
    const result = spawnSync(process.execPath, ["deploy.js", "--pack", "rain"], {
      cwd: TOOL_DIR,
      stdio: "inherit",
    });
    if (result.status !== 0) process.exit(result.status || 1);

    console.log("\nDone. Restart the server from PebbleHost panel.");
  } finally {
    await sftp.end();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
