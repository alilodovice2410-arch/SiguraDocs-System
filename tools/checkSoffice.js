// Quick check: run this with the same node you'll use to start the server
const { execFile } = require("child_process");
const util = require("util");
const execFileAsync = util.promisify(execFile);

(async () => {
  try {
    console.log(
      "Running check for soffice (tries 'soffice' then Program Files paths)..."
    );
    const candidates = [
      "soffice",
      "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
      "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
    ];
    for (const cmd of candidates) {
      try {
        const { stdout, stderr } = await execFileAsync(cmd, ["--version"], {
          timeout: 5000,
        });
        console.log(`Success: '${cmd}' --version output:\n`, stdout || stderr);
        process.exit(0);
      } catch (err) {
        console.warn(
          `Candidate '${cmd}' failed: ${err && err.message ? err.message : err}`
        );
      }
    }
    console.error("No working soffice binary found in these candidates.");
    process.exit(2);
  } catch (err) {
    console.error("checkSoffice error:", err);
    process.exit(3);
  }
})();
