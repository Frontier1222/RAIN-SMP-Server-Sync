const fs = require("fs");
const path = require("path");
const SftpClient = require("ssh2-sftp-client");

const config = JSON.parse(fs.readFileSync(path.join(__dirname, "sftp.json"), "utf8"));
const FILES = [
  "/behavior_packs/RAIN SMP E BP/blocks/gravestone.block.json",
  "/behavior_packs/RAIN SMP E BP/blocks/gravestone_default.block.json",
  "/behavior_packs/RAIN SMP E BP/blocks/gravestone_nether.block.json",
  "/behavior_packs/RAIN SMP E BP/blocks/gravestone_end.block.json",
  "/behavior_packs/RAIN SMP E BP/entities/floating_text.se.json",
  "/behavior_packs/RAIN SMP E BP/scripts/utils/graveCleanup.js",
  "/resource_packs/RAIN SMP E RP/models/blocks/gravestone.geo.json",
  "/resource_packs/RAIN SMP E RP/entity/floating_text.ce.json",
];

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
    for (const remote of FILES) {
      if (await sftp.exists(remote)) {
        await sftp.delete(remote);
        console.log("removed", remote);
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
