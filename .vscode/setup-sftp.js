const fs = require("fs");
const path = require("path");
const readline = require("readline");

const TOOL_DIR = __dirname;
const SFTP_CONFIG_PATH = path.join(TOOL_DIR, "sftp.json");
const SECRETS_PATH = path.join(TOOL_DIR, "sftp.secrets.json");

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

async function main() {
  const password = await askHidden("PebbleHost panel password: ");
  if (!password) {
    throw new Error("No password entered.");
  }

  fs.writeFileSync(SECRETS_PATH, `${JSON.stringify({ password }, null, 2)}\n`, "utf8");
  console.log(`Saved ${SECRETS_PATH}`);

  const config = JSON.parse(fs.readFileSync(SFTP_CONFIG_PATH, "utf8"));
  config.uploadOnSave = true;
  config.interactiveAuth = false;
  config.password = password;
  config.watcher = {
    files: "**/*",
    autoUpload: true,
    autoDelete: false,
  };

  fs.writeFileSync(SFTP_CONFIG_PATH, `${JSON.stringify(config, null, 4)}\n`, "utf8");
  console.log("Updated .vscode/sftp.json for upload-on-save.");
  console.log("Run: npm run deploy");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
