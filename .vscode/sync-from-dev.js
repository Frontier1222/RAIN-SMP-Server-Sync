/**
 * Copy latest RAIN SMP dev packs into the server sync workspace, then apply server fixes.
 * Run: node sync-from-dev.js [--source shared|local] [--bp-only]
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const TOOL_DIR = __dirname;
const ROOT = path.join(TOOL_DIR, "..");
const LOCAL_CONFIG = path.join(TOOL_DIR, "local.json");
const BACKUP_ROOT = path.join(ROOT, "_dev_sync_backup");

const PACKS = [
  {
    label: "RAIN SMP E BP",
    kind: "behavior",
    folder: "RAIN SMP E BP",
  },
  {
    label: "RAIN SMP E RP",
    kind: "resource",
    folder: "RAIN SMP E RP",
  },
];

function loadLocalConfig() {
  if (!fs.existsSync(LOCAL_CONFIG)) return null;
  return JSON.parse(fs.readFileSync(LOCAL_CONFIG, "utf8"));
}

function resolveSources(sourceMode) {
  const config = loadLocalConfig();
  const localMojang = config?.mojangDir
    ? path.normalize(config.mojangDir.replace(/[\\/]+$/, ""))
    : null;

  const sharedMojang = path.join(
    process.env.APPDATA || "",
    "Minecraft Bedrock",
    "Users",
    "Shared",
    "games",
    "com.mojang"
  );

  if (sourceMode === "local" && localMojang) {
    return {
      behavior: path.join(localMojang, "development_behavior_packs"),
      resource: path.join(localMojang, "development_resource_packs"),
    };
  }

  return {
    behavior: path.join(sharedMojang, "development_behavior_packs"),
    resource: path.join(sharedMojang, "development_resource_packs"),
  };
}

function timestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function robocopyMirror(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  try {
    execSync(
      `robocopy "${src}" "${dest}" /MIR /XD node_modules .git .vscode /NFL /NDL /NJH /NJS /nc /ns /np`,
      { stdio: "inherit", shell: true }
    );
  } catch (err) {
    const code = err?.status;
    // Robocopy: 0 = nothing copied, 1 = copied, 2+ = extra (still success up to 7)
    if (code === undefined || code > 7) throw err;
  }
}

function main() {
  const args = process.argv.slice(2);
  const sourceArgIndex = args.indexOf("--source");
  const sourceMode = sourceArgIndex >= 0 ? args[sourceArgIndex + 1] : "shared";
  const bpOnly = args.includes("--bp-only");
  const sources = resolveSources(sourceMode);
  const ts = timestamp();

  fs.mkdirSync(BACKUP_ROOT, { recursive: true });

  for (const pack of PACKS) {
    if (bpOnly && pack.kind === "resource") {
      console.log(`Skipping ${pack.label} (--bp-only)`);
      continue;
    }
    const src = path.join(sources[pack.kind], pack.folder);
    const dest = path.join(ROOT, `${pack.kind}_packs`, pack.folder);
    const backup = path.join(BACKUP_ROOT, `${pack.folder}_${ts}`);

    if (!fs.existsSync(src)) {
      throw new Error(`Missing dev pack: ${src}`);
    }

    console.log(`Backing up ${pack.label} -> ${backup}`);
    robocopyMirror(dest, backup);

    console.log(`Copying ${src} -> ${dest}`);
    robocopyMirror(src, dest);
  }

  console.log("\nCopy complete. Re-run apply-rain-fixes.js if you need to re-apply server patches.");
  console.log("Deploy with: npm run deploy:rain");
}

main();
