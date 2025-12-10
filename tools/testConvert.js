const path = require("path");
const fs = require("fs");
const { convertOfficeToPDF } = require("../backend/utils/officeConverter");

(async () => {
  try {
    // Use backend/uploads (your uploads are stored here)
    const input = path.resolve(
      __dirname,
      "../backend/uploads/1764415329757-673992938.docx"
    );
    console.log("Input path:", input);
    const start = Date.now();
    const pdfBuf = await convertOfficeToPDF(input);
    const duration = Date.now() - start;
    const outPath = path.resolve(__dirname, "test-output.pdf");
    fs.writeFileSync(outPath, pdfBuf);
    console.log(
      `Converted to PDF: ${outPath} (${pdfBuf.length} bytes) in ${duration}ms`
    );
  } catch (err) {
    console.error(
      "Conversion error (testConvert):",
      err && err.stack ? err.stack : err
    );
  }
})();
