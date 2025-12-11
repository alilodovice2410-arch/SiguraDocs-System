const os = require("os");
const path = require("path");
const fs = require("fs").promises;
const fsSync = require("fs");
const util = require("util");
const { execFile, spawn } = require("child_process");
const execFileAsync = util.promisify(execFile);

// Try to require libreoffice-convert if available
let libre = null;
try {
  libre = require("libreoffice-convert");
  console.log("✅ libreoffice-convert available (buffer conversion enabled).");
} catch (e) {
  console.warn("⚠️ libreoffice-convert not installed; will use soffice CLI.");
}

/**
 * Helper that returns a Promise for libreoffice-convert conversion
 */
async function libreConvertToPdf(inputBuf) {
  if (!libre) throw new Error("libreoffice-convert not available");

  try {
    const maybe = libre.convert(inputBuf, ".pdf", undefined);
    if (maybe && typeof maybe.then === "function") {
      return await maybe;
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
 * Find soffice executable with Railway Nix support
 */
async function findSofficeExecutable() {
  console.log("🔍 Searching for LibreOffice executable...");

  // 1) Check environment variable first
  const envPath = process.env.LIBREOFFICE_PATH;
  if (envPath) {
    console.log(`   Checking LIBREOFFICE_PATH: ${envPath}`);
    if (fsSync.existsSync(envPath)) {
      console.log(`✅ Using LibreOffice from env: ${envPath}`);
      return envPath;
    }
    console.warn(`⚠️ LIBREOFFICE_PATH set but file not found: ${envPath}`);
  }

  // 2) Check Railway Nix store (common path)
  try {
    const nixStorePath = "/nix/store";
    if (fsSync.existsSync(nixStorePath)) {
      console.log("   Checking Railway Nix store...");
      const nixStoreContents = fsSync.readdirSync(nixStorePath);

      // Find LibreOffice directory in Nix store
      const libreDir = nixStoreContents.find(
        (dir) => dir.includes("libreoffice") && !dir.includes(".drv")
      );

      if (libreDir) {
        const nixLibrePath = path.join(
          nixStorePath,
          libreDir,
          "bin",
          "soffice"
        );
        console.log(`   Found potential path: ${nixLibrePath}`);

        if (fsSync.existsSync(nixLibrePath)) {
          console.log(`✅ Using LibreOffice from Nix: ${nixLibrePath}`);
          return nixLibrePath;
        }
      }
    }
  } catch (err) {
    console.warn("⚠️ Error checking Nix store:", err.message);
  }

  // 3) Check common absolute paths
  const candidates =
    process.platform === "win32"
      ? [
          "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
          "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
        ]
      : [
          "/usr/bin/soffice",
          "/usr/lib/libreoffice/program/soffice",
          "/app/.apt/usr/bin/soffice", // Railway apt buildpack
        ];

  for (const candidatePath of candidates) {
    console.log(`   Checking: ${candidatePath}`);
    if (fsSync.existsSync(candidatePath)) {
      console.log(`✅ Found at: ${candidatePath}`);
      return candidatePath;
    }
  }

  // 4) Try to find soffice in PATH
  try {
    console.log("   Trying 'soffice' from PATH...");
    await execFileAsync("soffice", ["--version"], {
      windowsHide: true,
      timeout: 5000,
    });
    console.log("✅ Using 'soffice' from PATH");
    return "soffice";
  } catch (err) {
    console.warn("⚠️ 'soffice' not found in PATH");
  }

  // 5) Last resort: check if 'which soffice' works (Unix)
  if (process.platform !== "win32") {
    try {
      const { stdout } = await execFileAsync("which", ["soffice"], {
        timeout: 3000,
      });
      const whichPath = stdout.trim();
      if (whichPath && fsSync.existsSync(whichPath)) {
        console.log(`✅ Found via 'which': ${whichPath}`);
        return whichPath;
      }
    } catch (err) {
      // ignore
    }
  }

  // Final error with helpful message
  const errorMsg = `
❌ LibreOffice (soffice) not found!

Searched locations:
${candidates.map((c) => `  - ${c}`).join("\n")}
  - PATH environment
  - Railway Nix store (/nix/store)

Solutions:
  1. Ensure nixpacks.toml includes 'libreoffice' in nixPkgs
  2. Set LIBREOFFICE_PATH environment variable
  3. Install LibreOffice in your deployment environment
  `;

  throw new Error(errorMsg);
}

/**
 * Convert an Office file to PDF
 */
async function convertOfficeToPDF(inputPath) {
  const ext = path.extname(inputPath).toLowerCase();
  const supported = [".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx"];

  if (!supported.includes(ext)) {
    throw new Error(`Unsupported file extension: ${ext}`);
  }

  console.log(`\n📄 ===== OFFICE TO PDF CONVERSION =====`);
  console.log(`File: ${path.basename(inputPath)}`);
  console.log(`Type: ${ext}`);
  console.log(`Time: ${new Date().toISOString()}`);

  // Try buffer-based conversion first (faster)
  if (libre) {
    try {
      console.log("🔄 Attempting buffer-based conversion...");
      const inputBuf = await fs.readFile(inputPath);
      const start = Date.now();
      const pdfBuf = await libreConvertToPdf(inputBuf);
      const duration = Date.now() - start;

      if (pdfBuf && Buffer.isBuffer(pdfBuf) && pdfBuf.length > 0) {
        console.log(`✅ Buffer conversion succeeded!`);
        console.log(`   Size: ${pdfBuf.length} bytes`);
        console.log(`   Time: ${duration}ms`);
        console.log(`=====================================\n`);
        return pdfBuf;
      }
      throw new Error("Empty buffer returned");
    } catch (err) {
      console.warn(`⚠️ Buffer conversion failed: ${err.message}`);
      console.log("   Falling back to CLI method...");
    }
  }

  // CLI fallback
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "office-conv-"));
  let sofficeCmd;

  try {
    sofficeCmd = await findSofficeExecutable();
  } catch (err) {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (e) {}
    console.error(`=====================================\n`);
    throw err;
  }

  try {
    console.log(`🔄 CLI conversion using: ${sofficeCmd}`);

    const args = [
      "--headless",
      "--convert-to",
      "pdf",
      "--outdir",
      tmpDir,
      inputPath,
    ];

    console.log(`   Command: ${sofficeCmd} ${args.join(" ")}`);

    const child = spawn(sofficeCmd, args, {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        HOME: tmpDir, // Prevents LibreOffice from trying to access home directory
      },
    });

    // Send newline to avoid any blocking prompts
    if (child.stdin && !child.stdin.destroyed) {
      child.stdin.write("\n");
      child.stdin.end();
    }

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => {
      stdout += d.toString();
    });

    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });

    // Add timeout
    const timeoutMs = 30000; // 30 seconds
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        child.kill();
        reject(new Error(`Conversion timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    const exitCode = await Promise.race([
      new Promise((resolve, reject) => {
        child.on("error", (err) => reject(err));
        child.on("close", (code) => resolve(code));
      }),
      timeoutPromise,
    ]);

    console.log(`   Exit code: ${exitCode}`);

    if (stderr) {
      console.log(`   stderr: ${stderr.substring(0, 200)}`);
    }

    const outputName = `${path.parse(inputPath).name}.pdf`;
    const outputPath = path.join(tmpDir, outputName);

    if (!fsSync.existsSync(outputPath)) {
      throw new Error(
        `Output file not created: ${outputPath}\nstderr: ${stderr}`
      );
    }

    const pdfBuffer = await fs.readFile(outputPath);
    console.log(`✅ CLI conversion succeeded!`);
    console.log(`   Size: ${pdfBuffer.length} bytes`);
    console.log(`=====================================\n`);

    // Cleanup
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (e) {
      console.warn("⚠️ Cleanup warning:", e.message);
    }

    return pdfBuffer;
  } catch (err) {
    // Cleanup on error
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (e) {}

    console.error(`❌ Conversion failed: ${err.message}`);
    console.error(`=====================================\n`);
    throw new Error(`Office to PDF conversion failed: ${err.message}`);
  }
}

module.exports = {
  convertOfficeToPDF,
  findSofficeExecutable,
};
