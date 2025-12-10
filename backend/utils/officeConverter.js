const os = require("os");
const path = require("path");
const fs = require("fs").promises;
const fsSync = require("fs");
const util = require("util");
const { execFile, spawn } = require("child_process");
const execFileAsync = util.promisify(execFile);

// Try to require libreoffice-convert if available (but handle Promise or callback APIs)
let libre = null;
try {
  // eslint-disable-next-line global-require
  libre = require("libreoffice-convert");
  console.log("libreoffice-convert available (buffer conversion enabled).");
} catch (e) {
  console.warn(
    "libreoffice-convert not installed or failed to load; will use soffice CLI fallback."
  );
}

/**
 * Helper that returns a Promise for libreoffice-convert conversion,
 * and works whether libre.convert returns a Promise or uses callback.
 */
async function libreConvertToPdf(inputBuf) {
  if (!libre) throw new Error("libreoffice-convert not available");

  try {
    const maybe = libre.convert(inputBuf, ".pdf", undefined, (err, done) => {});
    if (maybe && typeof maybe.then === "function") {
      const result = await maybe;
      return result;
    }

    return await new Promise((resolve, reject) => {
      try {
        libre.convert(inputBuf, ".pdf", undefined, (err, done) => {
          if (err) return reject(err);
          return resolve(done);
        });
      } catch (err) {
        reject(err);
      }
    });
  } catch (err) {
    throw err;
  }
}

/**
 * Try to find a soffice executable.
 * Priority:
 *  1. process.env.LIBREOFFICE_PATH (if set and file exists)
 *  2. Absolute Program Files paths (if they exist) — return immediately (don't run --version)
 *  3. 'soffice' on PATH (test with --version)
 *
 * We avoid calling --version on Program Files paths because on some Windows installs
 * soffice prints a "Press Enter to continue..." message and blocks when run without stdin.
 */
async function findSofficeExecutable() {
  // 1) env override
  const envPath = process.env.LIBREOFFICE_PATH;
  if (envPath) {
    if (fsSync.existsSync(envPath)) {
      console.log(
        `findSofficeExecutable: using LIBREOFFICE_PATH env '${envPath}'`
      );
      return envPath;
    } else {
      console.warn(`LIBREOFFICE_PATH is set but file not found: ${envPath}`);
    }
  }

  // 2) check common absolute paths and return if file exists (skip calling --version)
  if (process.platform === "win32") {
    const absoluteCandidates = [
      "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
      "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
    ];
    for (const abs of absoluteCandidates) {
      if (fsSync.existsSync(abs)) {
        console.log(
          `findSofficeExecutable: found absolute soffice at '${abs}'`
        );
        return abs;
      }
    }
  } else {
    const unixCandidates = [
      "/usr/bin/soffice",
      "/usr/lib/libreoffice/program/soffice",
    ];
    for (const abs of unixCandidates) {
      if (fsSync.existsSync(abs)) {
        console.log(
          `findSofficeExecutable: found absolute soffice at '${abs}'`
        );
        return abs;
      }
    }
  }

  // 3) fallback to checking 'soffice' on PATH (this tests by running --version)
  try {
    await execFileAsync("soffice", ["--version"], {
      windowsHide: true,
      timeout: 5000,
    });
    console.log("findSofficeExecutable: using 'soffice' from PATH");
    return "soffice";
  } catch (err) {
    // give a useful error below
  }

  throw new Error(
    "LibreOffice (soffice) not found. Set process.env.LIBREOFFICE_PATH to the soffice exe path or ensure soffice is on PATH."
  );
}

/**
 * Convert an Office file on disk to PDF.
 * - inputPath: string path to the source file (docx, doc, pptx, xlsx, etc.)
 * Returns: Buffer containing the PDF bytes.
 */
async function convertOfficeToPDF(inputPath) {
  const ext = path.extname(inputPath).toLowerCase();
  const supported = [".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx"];
  if (!supported.includes(ext)) {
    throw new Error(`convertOfficeToPDF: unsupported extension ${ext}`);
  }

  console.log(
    `convertOfficeToPDF: starting conversion for ${inputPath} at ${new Date().toISOString()}`
  );

  // 1) Try buffer-based conversion using libreoffice-convert (if available)
  if (libre) {
    try {
      const inputBuf = await fs.readFile(inputPath);
      const start = Date.now();
      const pdfBuf = await libreConvertToPdf(inputBuf);
      const duration = Date.now() - start;
      if (pdfBuf && Buffer.isBuffer(pdfBuf) && pdfBuf.length > 0) {
        console.log(
          `convertOfficeToPDF: libreoffice-convert succeeded (${pdfBuf.length} bytes) in ${duration}ms`
        );
        return pdfBuf;
      }
      throw new Error("libreoffice-convert returned empty buffer");
    } catch (err) {
      console.warn(
        "libreoffice-convert failed, falling back to soffice CLI:",
        err && err.message ? err.message : err
      );
      // fall through to CLI fallback
    }
  }

  // 2) CLI fallback using soffice
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "office-conv-"));

  let sofficeCmd;
  try {
    sofficeCmd = await findSofficeExecutable();
  } catch (err) {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (e) {}
    throw err;
  }

  try {
    const args = [
      "--headless",
      "--convert-to",
      "pdf",
      "--outdir",
      tmpDir,
      inputPath,
    ];
    console.log(
      `convertOfficeToPDF: spawning '${sofficeCmd}' ${args.join(" ")}`
    );

    // Use spawn so we can safely provide stdin and collect stdout/stderr.
    // On Windows, passing the absolute path avoids command-line parsing problems.
    const child = spawn(sofficeCmd, args, {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Some soffice installs print a startup message and wait for Enter.
    // Send a newline immediately to avoid blocking.
    try {
      if (child.stdin && !child.stdin.destroyed) {
        child.stdin.write("\n");
        child.stdin.end();
      }
    } catch (writeErr) {
      // ignore
    }

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });

    const exitCode = await new Promise((resolve, reject) => {
      child.on("error", (err) => reject(err));
      child.on("close", (code) => resolve(code));
    });

    console.log(
      `convertOfficeToPDF: soffice exited with code ${exitCode}. stdout len=${stdout.length} stderr len=${stderr.length}`
    );

    const generatedName = path.join(
      tmpDir,
      `${path.parse(inputPath).name}.pdf`
    );
    if (!fsSync.existsSync(generatedName)) {
      // include some of stderr for debugging
      throw new Error(
        `soffice CLI did not produce expected output: ${generatedName}. stderr: ${stderr.slice(
          0,
          1000
        )}`
      );
    }

    const pdfBuffer = await fs.readFile(generatedName);
    console.log(
      `convertOfficeToPDF: soffice CLI produced ${pdfBuffer.length} bytes`
    );

    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (e) {}

    return pdfBuffer;
  } catch (err) {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (e) {}
    throw new Error(
      `Office to PDF conversion failed: ${err.message || err.toString()}`
    );
  }
}

module.exports = {
  convertOfficeToPDF,
  findSofficeExecutable,
};
