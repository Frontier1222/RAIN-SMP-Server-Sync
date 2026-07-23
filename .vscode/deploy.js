const fs = require("fs");
const path = require("path");
const readline = require("readline");
const SftpClient = require("ssh2-sftp-client");

const TOOL_DIR = __dirname;
const ROOT = path.join(TOOL_DIR, "..");
const SFTP_CONFIG_PATH = path.join(TOOL_DIR, "sftp.json");
const SECRETS_PATH = path.join(TOOL_DIR, "sftp.secrets.json");

const SKIP_PARTS = new Set([
  ".vscode",
  ".git",
  "node_modules",
  ".AddCompLib",
]);

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function askHidden(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.stdoutMuted = true;
    rl.question(prompt, (value) => {
      rl.close();
      console.log("");
      resolve(value.trim());
    });
    rl._writeToOutput = function writeToOutput(stringToWrite) {
      rl.output.write(rl.stdoutMuted ? "*" : stringToWrite);
    };
  });
}

function resolvePassword(config, cliPassword) {
  if (cliPassword) return cliPassword;
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

async function connect(config, password) {
  const sftp = new SftpClient();
  await sftp.connect({
    host: config.host,
    port: config.port,
    username: config.username,
    password,
    readyTimeout: 30000,
  });
  return sftp;
}

function shouldSkipRelative(relativePath) {
  const parts = relativePath.split(/[\\/]/);
  return parts.some((part) => SKIP_PARTS.has(part)) || relativePath.endsWith(".code-workspace");
}

function collectFiles(localDir) {
  const files = [];
  function walk(current, rel = "") {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const nextRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (shouldSkipRelative(nextRel)) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full, nextRel);
      else files.push({ full, rel: nextRel.replace(/\\/g, "/") });
    }
  }
  walk(localDir);
  return files;
}

async function uploadDirectory(sftp, localDir, remoteDir) {
  const files = collectFiles(localDir);
  const remoteBase = remoteDir.replace(/\\/g, "/").replace(/\/+$/, "");
  let uploaded = 0;

  for (const file of files) {
    const remotePath = `${remoteBase}/${file.rel}`;
    const remoteParent = path.posix.dirname(remotePath);
    await sftp.mkdir(remoteParent, true);
    await sftp.put(file.full, remotePath);
    uploaded += 1;
    if (uploaded % 50 === 0 || uploaded === files.length) {
      console.log(`  ${uploaded}/${files.length} uploaded...`);
    }
  }

  return uploaded;
}

async function uploadFile(sftp, localFile, remoteDir) {
  const remoteBase = remoteDir.replace(/\\/g, "/").replace(/\/+$/, "");
  await sftp.mkdir(remoteBase, true);
  const remotePath = `${remoteBase}/${path.basename(localFile)}`;
  await sftp.put(localFile, remotePath);
  return remotePath;
}

async function readRemoteManifest(sftp, remotePath) {
  const tmp = path.join(require("os").tmpdir(), `remote-manifest-${Date.now()}.json`);
  await sftp.get(remotePath, tmp);
  const manifest = loadJson(tmp);
  fs.unlinkSync(tmp);
  return manifest;
}

function printManifest(label, manifest) {
  const version = manifest.header.version.join(".");
  const api = (manifest.dependencies || []).find((dep) => dep.module_name === "@minecraft/server");
  console.log(`${label}: v${version}${manifest.header.description ? ` (${manifest.header.description})` : ""}`);
  if (api) console.log(`${label} API: ${api.version}`);
}

function validateLocalManifest(job) {
  if (job.type !== "dir" || !job.verify || !job.verify.endsWith("/manifest.json")) return;
  const manifestPath = path.join(job.local, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing manifest for ${job.label}: ${manifestPath}`);
  }
  const raw = fs.readFileSync(manifestPath, "utf8");
  if (!raw.trim()) {
    throw new Error(`Empty manifest for ${job.label}: ${manifestPath}`);
  }
  let manifest;
  try {
    manifest = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid manifest JSON for ${job.label}: ${manifestPath} (${err.message})`);
  }
  if (!manifest.header || !Array.isArray(manifest.header.version)) {
    throw new Error(`Manifest missing header.version for ${job.label}: ${manifestPath}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const manifestsOnly = args.includes("--manifests");
  const packArgIndex = args.indexOf("--pack");
  const packName = packArgIndex >= 0 ? args[packArgIndex + 1] : null;
  const passwordArgIndex = args.indexOf("--password");
  const cliPassword = passwordArgIndex >= 0 ? args[passwordArgIndex + 1] : null;

  if (!fs.existsSync(SFTP_CONFIG_PATH)) {
    throw new Error(`Missing ${SFTP_CONFIG_PATH}`);
  }

  const config = loadJson(SFTP_CONFIG_PATH);
  let password = resolvePassword(config, cliPassword);

  if (!password) {
    if (!process.stdin.isTTY) {
      throw new Error(
        "No SFTP password configured. Run setup-sftp.bat once, or create .vscode/sftp.secrets.json"
      );
    }
    console.log("No saved SFTP password found.");
    console.log(`Create ${SECRETS_PATH} or run: npm run setup-sftp`);
    password = await askHidden("PebbleHost panel password: ");
  }

  if (!password) {
    throw new Error("No password provided.");
  }

  console.log(`Connecting to ${config.host}:${config.port}...`);
  const sftp = await connect(config, password);

  try {
    const jobs = [];

    if (manifestsOnly || !packName) {
      jobs.push({
        type: "file",
        label: "Essentials manifest",
        local: path.join(ROOT, "behavior_packs", "Essentials BP", "manifest.json"),
        remote: "/behavior_packs/Essentials BP",
        verify: "/behavior_packs/Essentials BP/manifest.json",
      });
      jobs.push({
        type: "file",
        label: "RAIN SMP BP manifest",
        local: path.join(ROOT, "behavior_packs", "RAIN SMP E BP", "manifest.json"),
        remote: "/behavior_packs/RAIN SMP E BP",
        verify: "/behavior_packs/RAIN SMP E BP/manifest.json",
      });
    }

    if (packName === "rain" || packName === "rain-bp" || packName === "rain-rp" || packName === "all") {
      if (packName !== "rain-rp") {
        jobs.push({
          type: "dir",
          label: "RAIN SMP E BP",
          local: path.join(ROOT, "behavior_packs", "RAIN SMP E BP"),
          remote: "/behavior_packs/RAIN SMP E BP",
          verify: "/behavior_packs/RAIN SMP E BP/manifest.json",
        });
      }
      if (packName !== "rain-bp") {
        jobs.push({
          type: "dir",
          label: "RAIN SMP E RP",
          local: path.join(ROOT, "resource_packs", "RAIN SMP E RP"),
          remote: "/resource_packs/RAIN SMP E RP",
          verify: "/resource_packs/RAIN SMP E RP/manifest.json",
        });
      }
      if (packName === "rain" || packName === "rain-bp" || packName === "all") {
        jobs.push({
          type: "file",
          label: "world_behavior_packs.json",
          local: path.join(TOOL_DIR, "world_behavior_packs.json"),
          remote: "/worlds/Bedrock level",
          verify: null,
        });
      }
      if (packName === "rain" || packName === "rain-rp" || packName === "all") {
        jobs.push({
          type: "file",
          label: "world_resource_packs.json",
          local: path.join(TOOL_DIR, "world_resource_packs.json"),
          remote: "/worlds/Bedrock level",
          verify: null,
        });
      }
    }

    if (packName === "essentials" || packName === "all") {
      jobs.push({
        type: "dir",
        label: "Essentials BP",
        local: path.join(ROOT, "behavior_packs", "Essentials BP"),
        remote: "/behavior_packs/Essentials BP",
        verify: "/behavior_packs/Essentials BP/manifest.json",
      });
      jobs.push({
        type: "dir",
        label: "Essentials RP",
        local: path.join(ROOT, "resource_packs", "Essentials RP"),
        remote: "/resource_packs/Essentials RP",
        verify: "/resource_packs/Essentials RP/manifest.json",
      });
      jobs.push({
        type: "file",
        label: "world_behavior_packs.json",
        local: path.join(TOOL_DIR, "world_behavior_packs.json"),
        remote: "/worlds/Bedrock level",
        verify: null,
      });
      jobs.push({
        type: "file",
        label: "world_resource_packs.json",
        local: path.join(TOOL_DIR, "world_resource_packs.json"),
        remote: "/worlds/Bedrock level",
        verify: null,
      });
    }

    if (packName === "hotbars" || packName === "all") {
      jobs.push({
        type: "dir",
        label: "More Hotbars RP",
        local: path.join(ROOT, "resource_packs", "More Hotbars RP"),
        remote: "/resource_packs/More Hotbars RP",
        verify: "/resource_packs/More Hotbars RP/manifest.json",
      });
    }

    if (packName === "paradox" || packName === "all") {
      jobs.push({
        type: "dir",
        label: "Paradox AntiCheat BP",
        local: path.join(ROOT, "behavior_packs", "Paradox-AntiCheat-v6.3.0-BDS"),
        remote: "/behavior_packs/Paradox-AntiCheat-v6.3.0-BDS",
        verify: "/behavior_packs/Paradox-AntiCheat-v6.3.0-BDS/manifest.json",
      });
    }

    if (packName === "tc" || packName === "all") {
      jobs.push({
        type: "dir",
        label: "TC BP UPD",
        local: path.join(ROOT, "behavior_packs", "TC BP UPD"),
        remote: "/behavior_packs/TC BP UPD",
        verify: "/behavior_packs/TC BP UPD/manifest.json",
      });
    }

    if (packName === "tc-bp") {
      const tcRoot = path.join(ROOT, "behavior_packs", "TC BP UPD");
      jobs.push({
        type: "file",
        label: "TC BP manifest",
        local: path.join(tcRoot, "manifest.json"),
        remote: "/behavior_packs/TC BP UPD",
        verify: "/behavior_packs/TC BP UPD/manifest.json",
      });
      for (const scriptName of ["player_controller.js", "tool_effects.js", "bows.js", "vanilla_item_use.js", "main.js"]) {
        jobs.push({
          type: "file",
          label: `TC BP ${scriptName}`,
          local: path.join(tcRoot, "scripts", "ftb", "tinkers", scriptName),
          remote: "/behavior_packs/TC BP UPD/scripts/ftb/tinkers",
          verify: null,
        });
      }
      for (const relativePath of [
        "blocks/ftb/tinkers/tinkers_station/dark_oak.json",
        "recipes/ftb/tinkers/tinkers_station/dark_oak.json",
      ]) {
        jobs.push({
          type: "file",
          label: `TC BP ${relativePath}`,
          local: path.join(tcRoot, ...relativePath.split("/")),
          remote: `/behavior_packs/TC BP UPD/${path.posix.dirname(relativePath)}`,
          verify: null,
        });
      }
    }

    if (packName === "tc" || packName === "all") {
      jobs.push({
        type: "dir",
        label: "TC RP UPD",
        local: path.join(ROOT, "resource_packs", "TC RP UPD"),
        remote: "/resource_packs/TC RP UPD",
        verify: "/resource_packs/TC RP UPD/manifest.json",
      });
    }

    if (packName === "tc" || packName === "tc-bp" || packName === "all") {
      jobs.push({
        type: "file",
        label: "world_behavior_packs.json",
        local: path.join(TOOL_DIR, "world_behavior_packs.json"),
        remote: "/worlds/Bedrock level",
        verify: null,
      });
    }

    if (packName === "tc" || packName === "all") {
      jobs.push({
        type: "file",
        label: "world_resource_packs.json",
        local: path.join(TOOL_DIR, "world_resource_packs.json"),
        remote: "/worlds/Bedrock level",
        verify: null,
      });
    }

    if (packName === "worldbuilder" || packName === "all") {
      jobs.push({
        type: "dir",
        label: "World Builder 1.6 Add-On BP",
        local: path.join(ROOT, "behavior_packs", "World Builder 1.6 Add-On BP"),
        remote: "/behavior_packs/World Builder 1.6 Add-On BP",
        verify: "/behavior_packs/World Builder 1.6 Add-On BP/manifest.json",
      });
      jobs.push({
        type: "dir",
        label: "World Builder 1.6 Add-On RP",
        local: path.join(ROOT, "resource_packs", "World Builder 1.6 Add-On RP"),
        remote: "/resource_packs/World Builder 1.6 Add-On RP",
        verify: "/resource_packs/World Builder 1.6 Add-On RP/manifest.json",
      });
      jobs.push({
        type: "file",
        label: "world_behavior_packs.json",
        local: path.join(TOOL_DIR, "world_behavior_packs.json"),
        remote: "/worlds/Bedrock level",
        verify: null,
      });
      jobs.push({
        type: "file",
        label: "world_resource_packs.json",
        local: path.join(TOOL_DIR, "world_resource_packs.json"),
        remote: "/worlds/Bedrock level",
        verify: null,
      });
    }

    if (jobs.length === 0) {
      throw new Error("Nothing to deploy. Use --manifests, --pack rain|rain-bp|rain-rp|essentials|hotbars|paradox|tc|tc-bp|worldbuilder|all");
    }

    for (const job of jobs) {
      if (!fs.existsSync(job.local)) {
        throw new Error(`Missing local path: ${job.local}`);
      }
      validateLocalManifest(job);
      console.log(`Uploading ${job.label}...`);
      if (job.type === "file") {
        await uploadFile(sftp, job.local, job.remote);
      } else {
        await uploadDirectory(sftp, job.local, job.remote);
      }
    }

    console.log("\nRemote verification:");
    const verified = new Set();
    for (const job of jobs) {
      if (!job.verify || verified.has(job.verify)) continue;
      verified.add(job.verify);
      const manifest = await readRemoteManifest(sftp, job.verify);
      printManifest(job.label, manifest);
    }

    console.log("\nDeploy complete. Restart the Bedrock server from PebbleHost panel.");
  } finally {
    await sftp.end();
  }
}

main().catch((err) => {
  console.error("\nDeploy failed:");
  console.error(err.message || err);
  process.exit(1);
});
