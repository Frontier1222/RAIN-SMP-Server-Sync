import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import SftpClient from "ssh2-sftp-client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(__dirname, "sftp.json"), "utf8"));
const REMOTE_DB = "/worlds/Bedrock level/db";

const NEEDLES = ["BiomeData", "bop_ks:", "wypnt_bab:", "biomes_server", "jigsaw_structure_metadata", "joint_type"];

async function main() {
  const sftp = new SftpClient();
  await sftp.connect({
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    readyTimeout: 120000,
  });

  try {
    const items = await sftp.list(REMOTE_DB);
    const files = items.filter((i) => i.type === "-" && (i.name.endsWith(".ldb") || i.name.endsWith(".log")));
    console.log(`Scanning ${files.length} files...`);

    for (const item of files) {
      const remote = `${REMOTE_DB}/${item.name}`;
      const tmp = path.join(os.tmpdir(), `scan-${item.name}`);
      await sftp.get(remote, tmp);
      const buf = fs.readFileSync(tmp);
      fs.unlinkSync(tmp);

      const hits = NEEDLES.filter((n) => buf.includes(Buffer.from(n, "utf8")));
      if (hits.length) console.log(item.name, hits.join(", "));
    }
  } finally {
    await sftp.end();
  }
}

main().catch((e) => {
  console.error(e.stack || e.message || e);
  process.exit(1);
});
