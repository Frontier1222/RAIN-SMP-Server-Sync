/**
 * Copy Shared dev packs into the local Minecraft dev folder (not server sync).
 * Breaks junctions so local dev stays separate from behavior_packs/ in this repo.
 *
 * Run: node sync-to-local-dev.js [--bp-only]
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const TOOL_DIR = __dirname;
const LOCAL_CONFIG = path.join(TOOL_DIR, "local.json");

const PACKS = [
  { label: "RAIN SMP E BP", kind: "behavior", folder: "RAIN SMP E BP" },
  { label: "RAIN SMP E RP", kind: "resource", folder: "RAIN SMP E RP" },
];

function loadLocalConfig() {
  if (!fs.existsSync(LOCAL_CONFIG)) {
    throw new Error(`Missing ${LOCAL_CONFIG}`);
  }
  return JSON.parse(fs.readFileSync(LOCAL_CONFIG, "utf8"));
}

function sharedMojangDir() {
  return path.join(
    process.env.APPDATA || "",
    "Minecraft Bedrock",
    "Users",
    "Shared",
    "games",
    "com.mojang"
  );
}

function robocopyMirror(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(dest)) {
  }
  try {
    execSync(
      `robocopy "${src}" "${dest}" /MIR /XD node_modules .git .vscode /NFL /NDL /NJH /NJS /nc /ns /np`,
      { stdio: "inherit", shell: true }
    );
  } catch (err) {
    const code = err?.status;
    if (code === undefined || code > 7) throw err;
  }
}

function removeJunctionOrEmptyLink(target) {
  if (!fs.existsSync(target)) return;
  try {
    execSync(`cmd /c rmdir "${target}"`, { stdio: "pipe" });
    return;
  } catch (_) {
    const stat = fs.lstatSync(target);
    if (stat.isDirectory()) {
      throw new Error(
        `Local path is a real folder, not a junction: ${target}\nMove it aside manually, then re-run.`
      );
    }
    fs.rmSync(target, { force: true });
  }
}

function main() {
  const bpOnly = process.argv.includes("--bp-only");
  const config = loadLocalConfig();
  const localMojang = path.normalize(config.mojangDir.replace(/[\\/]+$/, ""));
  const sharedMojang = sharedMojangDir();

  for (const pack of PACKS) {
    if (bpOnly && pack.kind === "resource") {
      console.log(`Skipping ${pack.label} (--bp-only)`);
      continue;
    }

    const src = path.join(
      sharedMojang,
      pack.kind === "behavior" ? "development_behavior_packs" : "development_resource_packs",
      pack.folder
    );
    const dest = path.join(
      localMojang,
      pack.kind === "behavior" ? "development_behavior_packs" : "development_resource_packs",
      pack.folder
    );

    if (!fs.existsSync(src)) {
      throw new Error(`Missing Shared dev pack: ${src}`);
    }

    console.log(`Removing local link/folder: ${dest}`);
    removeJunctionOrEmptyLink(dest);

    console.log(`Copying Shared dev -> local: ${src} -> ${dest}`);
    robocopyMirror(src, dest);
  }

  console.log("\nLocal dev packs restored from Shared (no server-sync patches).");
  console.log("Server deploy copy is unchanged in behavior_packs/ and resource_packs/.");
}

main();
