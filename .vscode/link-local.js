/**
 * Link workspace behavior/resource packs into Minecraft Bedrock development folders.
 * Edits in RAIN SMP Server Sync show up in-game after reloading the world.
 *
 * Run: node link-local.js --pack rain|essentials|all
 *      node link-local.js --unlink --pack rain|essentials|all
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const TOOL_DIR = __dirname;
const ROOT = path.join(TOOL_DIR, "..");
const CONFIG_PATH = path.join(TOOL_DIR, "local.json");

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`Missing ${CONFIG_PATH}. Set "mojangDir" to your com.mojang folder.`);
  }
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  if (!config.mojangDir) {
    throw new Error(`Set "mojangDir" in ${CONFIG_PATH}`);
  }
  return config;
}

function resolveMojangDir(config, cliPath) {
  const raw = cliPath || config.mojangDir;
  const normalized = path.normalize(raw.replace(/[\\/]+$/, ""));

  if (normalized.toLowerCase().endsWith(`${path.sep}minecraftworlds`)) {
    return path.dirname(normalized);
  }

  return normalized;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readReparsePoint(target) {
  try {
    return fs.readlinkSync(target);
  } catch {
    return null;
  }
}

function samePath(a, b) {
  return path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
}

function removeLink(target, force) {
  if (!fs.existsSync(target)) return false;

  const linkTarget = readReparsePoint(target);
  if (linkTarget) {
    fs.rmSync(target, { recursive: true, force: true });
    return true;
  }

  if (force) {
    fs.rmSync(target, { recursive: true, force: true });
    return true;
  }

  throw new Error(
    `"${target}" exists and is not a junction. Re-run with --force or delete it manually.`
  );
}

function createJunction(source, target, force) {
  const absSource = path.resolve(source);
  if (!fs.existsSync(absSource)) {
    throw new Error(`Missing local pack: ${absSource}`);
  }

  ensureDir(path.dirname(target));

  if (fs.existsSync(target)) {
    const existing = readReparsePoint(target);
    if (existing && samePath(existing, absSource)) {
      console.log(`OK (already linked): ${path.basename(target)}`);
      return "skipped";
    }
    removeLink(target, force);
  }

  try {
    fs.symlinkSync(absSource, target, "junction");
  } catch (err) {
    execSync(`cmd /c mklink /J "${target}" "${absSource}"`, { stdio: "pipe" });
  }

  console.log(`OK: ${path.basename(target)} -> ${absSource}`);
  return "linked";
}

function buildJobs(packName) {
  const jobs = [];

  function addBehavior(label, folder) {
    jobs.push({
      label,
      source: path.join(ROOT, "behavior_packs", folder),
      targetName: folder,
      kind: "behavior",
    });
  }

  function addResource(label, folder) {
    jobs.push({
      label,
      source: path.join(ROOT, "resource_packs", folder),
      targetName: folder,
      kind: "resource",
    });
  }

  if (packName === "rain" || packName === "all") {
    addBehavior("RAIN SMP E BP", "RAIN SMP E BP");
    addResource("RAIN SMP E RP", "RAIN SMP E RP");
    addBehavior("Essentials BP", "Essentials BP");
    addResource("Essentials RP", "Essentials RP");
  }

  if (packName === "essentials" || packName === "all") {
    addBehavior("Essentials BP", "Essentials BP");
    addResource("Essentials RP", "Essentials RP");
  }

  if (packName === "hotbars" || packName === "all") {
    addResource("More Hotbars RP", "More Hotbars RP");
  }

  if (packName === "paradox" || packName === "all") {
    addBehavior("Paradox AntiCheat BP", "Paradox-AntiCheat-v6.3.0-BDS");
  }

  if (jobs.length === 0) {
    throw new Error("Nothing to link. Use --pack rain|essentials|hotbars|paradox|all");
  }

  const seen = new Set();
  return jobs.filter((job) => {
    const key = `${job.kind}:${job.targetName}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function printNextSteps() {
  console.log("\nNext steps:");
  console.log("1. Open Minecraft Bedrock and create a test world (1.21.130+).");
  console.log("2. Enable Experiments / Beta APIs for script packs.");
  console.log("3. Activate linked packs under Behavior Packs and Resource Packs.");
  console.log("4. Turn on Content Log: Settings -> Creator -> Enable Content Log.");
  console.log("5. After edits here, leave and re-enter the world to reload scripts.");
  console.log("6. When ready for live server: node .vscode/deploy.js --pack rain|essentials|hotbars");
}

function main() {
  const args = process.argv.slice(2);
  const unlink = args.includes("--unlink");
  const force = args.includes("--force");
  const packArgIndex = args.indexOf("--pack");
  const packName = packArgIndex >= 0 ? args[packArgIndex + 1] : "all";
  const mojangArgIndex = args.indexOf("--mojang");
  const cliMojang = mojangArgIndex >= 0 ? args[mojangArgIndex + 1] : null;

  const config = loadConfig();
  const mojangDir = resolveMojangDir(config, cliMojang);

  if (!fs.existsSync(mojangDir)) {
    throw new Error(`Minecraft folder not found: ${mojangDir}`);
  }

  const behaviorDir = path.join(mojangDir, "development_behavior_packs");
  const resourceDir = path.join(mojangDir, "development_resource_packs");
  ensureDir(behaviorDir);
  ensureDir(resourceDir);

  const jobs = buildJobs(packName);

  console.log(`Minecraft folder: ${mojangDir}`);
  console.log(unlink ? "Removing local junctions..." : "Linking packs for local testing...");

  let linked = 0;
  let skipped = 0;
  let removed = 0;

  for (const job of jobs) {
    const parent = job.kind === "behavior" ? behaviorDir : resourceDir;
    const target = path.join(parent, job.targetName);

    if (unlink) {
      if (removeLink(target, true)) {
        console.log(`OK (removed): ${job.targetName}`);
        removed += 1;
      } else {
        console.log(`SKIP (not linked): ${job.targetName}`);
      }
      continue;
    }

    const result = createJunction(job.source, target, force);
    if (result === "linked") linked += 1;
    if (result === "skipped") skipped += 1;
  }

  if (unlink) {
    console.log(`\nRemoved ${removed} junction(s).`);
    return;
  }

  console.log(`\nLinked ${linked} pack(s)${skipped ? `, ${skipped} already linked` : ""}.`);
  printNextSteps();
}

main();
