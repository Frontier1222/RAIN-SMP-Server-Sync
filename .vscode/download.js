const fs = require("fs");
const path = require("path");
const readline = require("readline");
const SftpClient = require("ssh2-sftp-client");

const HOST = "na2041.pebblehost.net";
const PORT = 2222;
const USER = "ksyed1324@gmail.com.588b5a1a";
const LOCAL_ROOT = path.join(__dirname, "..");

const PACK_DIRS = ["behavior_packs", "resource_packs"];

function askHidden(prompt) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        rl.stdoutMuted = true;
        rl.question(prompt, (value) => {
            rl.history = rl.history.slice(1);
            rl.close();
            console.log("");
            resolve(value);
        });

        rl._writeToOutput = function _writeToOutput(stringToWrite) {
            if (rl.stdoutMuted) {
                rl.output.write("*");
            } else {
                rl.output.write(stringToWrite);
            }
        };
    });
}

async function connect(password) {
    const sftp = new SftpClient();
    await sftp.connect({
        host: HOST,
        port: PORT,
        username: USER,
        password,
        readyTimeout: 20000,
    });
    return sftp;
}

async function listRoot(sftp) {
    const entries = await sftp.list("/");
    console.log("\nRemote server folders/files at / :\n");
    for (const entry of entries) {
        console.log(`  ${entry.type === "d" ? "[dir]" : "     "} ${entry.name}`);
    }
    console.log("");
    return entries;
}

async function downloadDir(sftp, remoteDir, localDir) {
    fs.mkdirSync(localDir, { recursive: true });
    console.log(`Downloading /${remoteDir} -> ${localDir}`);
    await sftp.downloadDir(`/${remoteDir}`, localDir, {
        filter: (item) => item.name !== ".vscode",
    });
    console.log(`Done: ${remoteDir}`);
}

async function main() {
    const listOnly = process.argv.includes("--list-only");

    console.log("PebbleHost SFTP download");
    console.log(`Host: ${HOST}:${PORT}`);
    console.log(`User: ${USER}\n`);

    const password = await askHidden("PebbleHost panel password: ");
    if (!password) {
        console.error("No password entered.");
        process.exit(1);
    }

    const sftp = await connect(password);

    try {
        const root = await listRoot(sftp);
        if (listOnly) return;

        const names = new Set(root.map((e) => e.name));
        for (const dir of PACK_DIRS) {
            if (!names.has(dir)) {
                console.warn(`Warning: /${dir} not found on server — skipped.`);
                continue;
            }
            await downloadDir(sftp, dir, path.join(LOCAL_ROOT, dir));
        }

        console.log("\nAll done. In Cursor: File -> Open Folder -> this folder:");
        console.log(LOCAL_ROOT);
    } finally {
        await sftp.end();
    }
}

main().catch((err) => {
    console.error("\nDownload failed:");
    console.error(err.message || err);
    process.exit(1);
});
