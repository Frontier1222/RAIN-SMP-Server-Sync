const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");
const SftpClient = require("ssh2-sftp-client");

const TOOL_DIR = __dirname;
const config = JSON.parse(fs.readFileSync(path.join(TOOL_DIR, "sftp.json"), "utf8"));
const REMOTE_WORLD = "/worlds/Bedrock level";
const REMOTE_DB = `${REMOTE_WORLD}/db`;

const GRAVE_BP_FILES = [
  "/behavior_packs/RAIN SMP E BP/blocks/gravestone.block.json",
  "/behavior_packs/RAIN SMP E BP/blocks/gravestone_default.block.json",
  "/behavior_packs/RAIN SMP E BP/blocks/gravestone_nether.block.json",
  "/behavior_packs/RAIN SMP E BP/blocks/gravestone_end.block.json",
  "/behavior_packs/RAIN SMP E BP/entities/floating_text.se.json",
  "/behavior_packs/RAIN SMP E BP/scripts/utils/graveCleanup.js",
];

async function downloadDir(sftp, remoteDir, localDir, onProgress) {
  fs.mkdirSync(localDir, { recursive: true });
  const items = await sftp.list(remoteDir);
  let n = 0;
  for (const item of items) {
    if (item.type !== "-") continue;
    const remote = `${remoteDir}/${item.name}`.replace(/\/+/g, "/");
    const local = path.join(localDir, item.name);
    await sftp.get(remote, local);
    n++;
    if (onProgress && n % 50 === 0) onProgress(n);
  }
  return n;
}

async function uploadDir(sftp, localDir, remoteDir, onProgress) {
  const names = fs.readdirSync(localDir);
  let n = 0;
  for (const name of names) {
    const local = path.join(localDir, name);
    if (!fs.statSync(local).isFile()) continue;
    await sftp.put(local, `${remoteDir}/${name}`.replace(/\/+/g, "/"));
    n++;
    if (onProgress && n % 50 === 0) onProgress(n);
  }
  return names.length;
}

async function removeRemoteFiles(sftp, files) {
  for (const remote of files) {
    try {
      if (await sftp.exists(remote)) {
        await sftp.delete(remote);
        console.log("  removed", remote);
      }
    } catch (e) {
      console.log("  skip", remote, "-", e.message);
    }
  }
}

async function main() {
  console.log("IMPORTANT: Stop the Bedrock server before running this fix.\n");

  const sftp = new SftpClient();
  await sftp.connect({
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    readyTimeout: 120000,
  });

  const tmpWorld = fs.mkdtempSync(path.join(os.tmpdir(), "rain-world-fix-"));
  const tmpDb = path.join(tmpWorld, "db");

  try {
    console.log("Downloading world db...");
    const count = await downloadDir(sftp, REMOTE_DB, tmpDb, (n) => console.log(`  ${n} files...`));
    console.log(`Downloaded ${count} db files`);

    console.log("Downloading level.dat...");
    await sftp.get(`${REMOTE_WORLD}/level.dat`, path.join(tmpWorld, "level.dat"));

    console.log("Patching world data...");
    const py = spawnSync("python", [path.join(TOOL_DIR, "fix_world_data.py"), tmpWorld], {
      encoding: "utf8",
    });
    if (py.stdout) console.log(py.stdout.trim());
    if (py.status !== 0) {
      console.error(py.stderr || "Python fix failed");
      process.exit(py.status || 1);
    }

    console.log("\nUploading patched db...");
    await uploadDir(sftp, tmpDb, REMOTE_DB, (n) => console.log(`  ${n} files...`));
    await sftp.put(path.join(tmpWorld, "level.dat"), `${REMOTE_WORLD}/level.dat`);

    console.log("\nRemoving gravestone files from server BP...");
    await removeRemoteFiles(sftp, GRAVE_BP_FILES);

    console.log("\nDeploying updated RAIN SMP packs...");
    const deploy = spawnSync(process.execPath, ["deploy.js", "--pack", "rain"], {
      cwd: TOOL_DIR,
      stdio: "inherit",
    });
    if (deploy.status !== 0) process.exit(deploy.status || 1);

    console.log("\nDone. Restart the server from PebbleHost.");
  } finally {
    fs.rmSync(tmpWorld, { recursive: true, force: true });
    await sftp.end();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
