/**
 * Pretty-print Essentials compiled.js for editing/debugging.
 * Run: node format-compiled.js
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const compiledPath = path.join(
  __dirname,
  "..",
  "behavior_packs",
  "Essentials BP",
  "scripts",
  "unlinked",
  "compiled.js"
);

const toolDir = __dirname;
if (!fs.existsSync(path.join(toolDir, "node_modules", "js-beautify"))) {
  console.log("Installing js-beautify...");
  execSync("npm install js-beautify --no-save", {
    cwd: toolDir,
    stdio: "inherit",
  });
}

const beautify = require(path.join(toolDir, "node_modules", "js-beautify")).js;

const source = fs.readFileSync(compiledPath, "utf8");
console.log("Input:", source.length, "bytes,", source.split(/\r?\n/).length, "lines");

const formatted = beautify(source, {
  indent_size: 2,
  indent_char: " ",
  max_preserve_newlines: 2,
  preserve_newlines: true,
  keep_array_indentation: false,
  break_chained_methods: false,
  indent_scripts: "normal",
  brace_style: "collapse,preserve-inline",
  space_before_conditional: true,
  unescape_strings: false,
  jslint_happy: false,
  end_with_newline: true,
  wrap_line_length: 120,
  indent_empty_lines: false,
  e4x: false,
});

fs.writeFileSync(compiledPath, formatted, "utf8");

console.log(
  "Output:",
  formatted.length,
  "bytes,",
  formatted.split(/\r?\n/).length,
  "lines"
);

execSync(`node --check "${compiledPath}"`, { stdio: "inherit" });
console.log("Syntax OK");
