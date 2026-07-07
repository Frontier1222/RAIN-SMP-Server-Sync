/**
 * Download one or more managed packs from PebbleHost into the sync folder.
 * Run: node download-pack.js --pack hotbars|rain|essentials|all
 */
const fs = require("fs");
const path = require("path");
const SftpClient = require("ssh2-sftp-client");

const TOOL_DIR = __dirname;
const ROOT = path.join(TOOL_DIR, "..");
const SFTP_CONFIG_PATH = path.join(TOOL_DIR, "sftp.json");
const SECRETS_PATH = path.join(TOOL_DIR, "sftp.secrets.json");
const MANAGED_PATH = path.join(TOOL_DIR, "managed-packs.json");

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function resolvePassword(config) {
  if (process.env.PEBBLEHOST_SFTP_PASSWORD) {
    return process.env.PEBBLEHOST_SFTP_PASSWORD.trim();
  }
  if (config.password) return String(config.password).trim();
  if (fs.existsSync(SECRETS_PATH)) {
    const secrets = loadJson(SECRETS_PATH);
    if (secrets.password) return String(secrets.password).trim();
  }
  return null;
}

function getManagedPacks() {
  return loadJson(MANAGED_PATH).packs;
}

function pickPacks(packName) {
  const all = getManagedPacks();
  if (packName === "all") return all;
  const pack = all.find((p) => p.id === packName);
  if (!pack) {
    throw new Error(`Unknown pack "${packName}". Use: ${all.map((p) => p.id).join("|")}|all`);
  }
  return [pack];
}

async function downloadDir(sftp, remoteDir, localDir) {
  fs.mkdirSync(localDir, { recursive: true });
  console.log(`Downloading ${remoteDir} -> ${localDir}`);
  await sftp.downloadDir(remoteDir, localDir, {
    filter: (item) => item.name !== ".vscode",
  });
}

async function main() {
  const args = process.argv.slice(2);
  const packArgIndex = args.indexOf("--pack");
  const packName = packArgIndex >= 0 ? args[packArgIndex + 1] : "all";

  const config = loadJson(SFTP_CONFIG_PATH);
  const password = resolvePassword(config);
  if (!password) {
    throw new Error("No SFTP password. Run setup-sftp.bat or set PEBBLEHOST_SFTP_PASSWORD.");
  }

  const packs = pickPacks(packName);
  const sftp = new SftpClient();
  await sftp.connect({
    host: config.host,
    port: config.port,
    username: config.username,
    password,
    readyTimeout: 30000,
  });

  try {
    for (const pack of packs) {
      if (pack.behavior) {
        await downloadDir(
          sftp,
          `/behavior_packs/${pack.behavior}`,
          path.join(ROOT, "behavior_packs", pack.behavior)
        );
      }
      if (pack.resource) {
        await downloadDir(
          sftp,
          `/resource_packs/${pack.resource}`,
          path.join(ROOT, "resource_packs", pack.resource)
        );
      }
      console.log(`OK: ${pack.label}`);
    }
    console.log("\nDownload complete.");
  } finally {
    await sftp.end();
  }
}

main().catch((err) => {
  console.error("\nDownload failed:");
  console.error(err.message || err);
  process.exit(1);
});
