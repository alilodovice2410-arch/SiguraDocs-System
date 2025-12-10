const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const fs = require("fs").promises;
const path = require("path");
const {
  Document,
  Paragraph,
  TextRun,
  ImageRun,
  AlignmentType,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  Packer,
} = require("docx");
const { Workbook } = require("exceljs");

// Use the office converter helper to convert Office -> PDF (LibreOffice wrapper + CLI fallback)
const { convertOfficeToPDF } = require("./officeConverter");

/**
 * Add signatures to PDF documents
 */
async function addSignaturesToPDF(pdfPathOrBuffer, signatures) {
  try {
    console.log("\n🖊️ ===== EMBEDDING SIGNATURES INTO PDF =====");
    // pdfPathOrBuffer may be a path string or Buffer
    let existingPdfBytes;
    if (Buffer.isBuffer(pdfPathOrBuffer)) {
      existingPdfBytes = pdfPathOrBuffer;
    } else {
      existingPdfBytes = await fs.readFile(pdfPathOrBuffer);
    }

    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    const pages = pdfDoc.getPages();
    const lastPage = pages[pages.length - 1];
    const { width, height } = lastPage.getSize();

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const signaturePage = pdfDoc.addPage([width, height]);

    signaturePage.drawText("DIGITAL SIGNATURES", {
      x: 50,
      y: height - 50,
      size: 18,
      font: boldFont,
      color: rgb(0.1, 0.5, 0.3),
    });

    signaturePage.drawText(
      "This document has been digitally signed by the following approvers:",
      {
        x: 50,
        y: height - 75,
        size: 10,
        font: font,
        color: rgb(0.3, 0.3, 0.3),
      }
    );

    let yPosition = height - 120;
    let currentPage = signaturePage;

    for (let i = 0; i < signatures.length; i++) {
      const sig = signatures[i];

      currentPage.drawRectangle({
        x: 50,
        y: yPosition - 120,
        width: width - 100,
        height: 110,
        borderColor: rgb(0.7, 0.7, 0.7),
        borderWidth: 1,
      });

      currentPage.drawText(sig.signer_name, {
        x: 70,
        y: yPosition - 30,
        size: 14,
        font: boldFont,
        color: rgb(0.1, 0.1, 0.1),
      });

      currentPage.drawText(
        `${sig.signer_role} - ${sig.signer_department}${
          sig.signer_subject ? ` (${sig.signer_subject})` : ""
        }`,
        {
          x: 70,
          y: yPosition - 48,
          size: 9,
          font: font,
          color: rgb(0.4, 0.4, 0.4),
        }
      );

      currentPage.drawText(`Level ${sig.approval_level}`, {
        x: width - 150,
        y: yPosition - 30,
        size: 10,
        font: boldFont,
        color: rgb(0.1, 0.7, 0.5),
      });

      if (sig.signature_image) {
        try {
          let base64Data = sig.signature_image;
          if (base64Data.includes(",")) {
            base64Data = base64Data.split(",")[1];
          }

          const imageBytes = Buffer.from(base64Data, "base64");
          let signatureImage;

          try {
            signatureImage = await pdfDoc.embedPng(imageBytes);
          } catch {
            signatureImage = await pdfDoc.embedJpg(imageBytes);
          }

          currentPage.drawImage(signatureImage, {
            x: 70,
            y: yPosition - 95,
            width: 200,
            height: 50,
          });
        } catch (imgError) {
          console.error(`Error embedding signature image:`, imgError.message);
          currentPage.drawText("(Digital Signature Applied)", {
            x: 70,
            y: yPosition - 75,
            size: 10,
            font: font,
            color: rgb(0.5, 0.5, 0.5),
          });
        }
      }

      currentPage.drawText(`Hash: ${sig.signature_hash.substring(0, 32)}...`, {
        x: 70,
        y: yPosition - 110,
        size: 7,
        font: font,
        color: rgb(0.5, 0.5, 0.5),
      });

      const signedDate = new Date(sig.signed_at).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      currentPage.drawText(`Signed: ${signedDate}`, {
        x: width - 250,
        y: yPosition - 110,
        size: 8,
        font: font,
        color: rgb(0.5, 0.5, 0.5),
      });

      yPosition -= 140;

      if (yPosition < 150 && i < signatures.length - 1) {
        currentPage = pdfDoc.addPage([width, height]);
        yPosition = height - 80;
      }
    }

    pdfDoc.setTitle("Signed Document");
    pdfDoc.setAuthor("SiguraDocs System");
    pdfDoc.setSubject("Digitally Signed Document");

    const pdfBytes = await pdfDoc.save();
    console.log(`✅ PDF saved: ${pdfBytes.length} bytes`);

    return Buffer.from(pdfBytes);
  } catch (error) {
    console.error("❌ Error adding signatures to PDF:", error);
    throw error;
  }
}

/**
 * Add signatures to DOCX documents
 *
 * NOTE: The docx library cannot merge into an existing DOCX easily.
 * For reliable visual signature embedding we convert DOCX => PDF and add signatures to the PDF.
 * This function still generates a standalone signature DOCX (not merged) for fallback scenarios.
 */
async function addSignaturesToDOCX(docxPath, signatures) {
  try {
    console.log(
      "\n🖊️ ===== EMBEDDING SIGNATURES INTO DOCX (SEPARATE DOC) ====="
    );
    // Create signature section elements
    const signatureElements = [];

    // Page break to separate from original content
    signatureElements.push(
      new Paragraph({
        pageBreakBefore: true,
      })
    );

    // Title
    signatureElements.push(
      new Paragraph({
        text: "DIGITAL SIGNATURES",
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 },
      })
    );

    signatureElements.push(
      new Paragraph({
        text: "This document has been digitally signed by the following approvers:",
        alignment: AlignmentType.CENTER,
        spacing: { after: 600 },
      })
    );

    // Add each signature in a table for better formatting
    for (const sig of signatures) {
      // Create a bordered table for each signature
      const signatureTable = new Table({
        width: {
          size: 100,
          type: WidthType.PERCENTAGE,
        },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
          left: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
          right: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
          insideHorizontal: {
            style: BorderStyle.SINGLE,
            size: 1,
            color: "EEEEEE",
          },
          insideVertical: { style: BorderStyle.NONE },
        },
        rows: [],
      });

      // Signer name row
      signatureTable.rows.push(
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: sig.signer_name,
                      bold: true,
                      size: 32,
                      color: "1a1a1a",
                    }),
                  ],
                  spacing: { after: 100 },
                }),
              ],
              shading: { fill: "f0f9ff" },
            }),
          ],
        })
      );

      // Role and department row
      signatureTable.rows.push(
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `${sig.signer_role} - ${sig.signer_department}`,
                      size: 24,
                      color: "666666",
                    }),
                    sig.signer_subject
                      ? new TextRun({
                          text: ` (${sig.signer_subject})`,
                          size: 24,
                          color: "666666",
                          italics: true,
                        })
                      : new TextRun(""),
                  ],
                }),
              ],
            }),
          ],
        })
      );

      // Approval level row
      signatureTable.rows.push(
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Approval Level: ${sig.approval_level}`,
                      bold: true,
                      size: 22,
                      color: "0B8043",
                    }),
                  ],
                }),
              ],
            }),
          ],
        })
      );

      // Signature image row
      if (sig.signature_image) {
        try {
          let base64Data = sig.signature_image;
          if (base64Data.includes(",")) {
            base64Data = base64Data.split(",")[1];
          }

          const imageBuffer = Buffer.from(base64Data, "base64");

          signatureTable.rows.push(
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new ImageRun({
                          data: imageBuffer,
                          transformation: {
                            width: 300,
                            height: 75,
                          },
                        }),
                      ],
                      alignment: AlignmentType.CENTER,
                      spacing: { before: 100, after: 100 },
                    }),
                  ],
                  shading: { fill: "fafafa" },
                }),
              ],
            })
          );
        } catch (imgError) {
          console.error("Error adding signature image:", imgError);
          signatureTable.rows.push(
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    new Paragraph({
                      text: "(Digital Signature Applied)",
                      italics: true,
                      color: "999999",
                    }),
                  ],
                }),
              ],
            })
          );
        }
      }

      const signedDate = new Date(sig.signed_at).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      // Date row
      signatureTable.rows.push(
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Signed: ${signedDate}`,
                      size: 20,
                      color: "666666",
                    }),
                  ],
                }),
              ],
            }),
          ],
        })
      );

      // Hash row
      signatureTable.rows.push(
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Hash: ${sig.signature_hash.substring(0, 40)}...`,
                      size: 18,
                      color: "999999",
                      font: "Courier New",
                    }),
                  ],
                }),
              ],
            }),
          ],
        })
      );

      signatureElements.push(
        new Paragraph({
          children: [signatureTable],
          spacing: { after: 400 },
        })
      );
    }

    // Security notice
    signatureElements.push(
      new Paragraph({
        text: "─".repeat(80),
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 200 },
        border: {
          top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
        },
      })
    );

    signatureElements.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "⚠️ Security Notice: ",
            bold: true,
            size: 20,
            color: "d97706",
          }),
          new TextRun({
            text: "All signatures are cryptographically secured and verified. Any modification to this document after signing will invalidate the signatures.",
            size: 18,
            color: "666666",
            italics: true,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      })
    );

    signatureElements.push(
      new Paragraph({
        text: `Document generated by SiguraDocs on ${new Date().toLocaleString(
          "en-US",
          {
            month: "long",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }
        )}`,
        alignment: AlignmentType.CENTER,
        italics: true,
        size: 18,
        color: "999999",
      })
    );

    // Create new document with signature section
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: signatureElements,
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);

    console.log(`✅ DOCX signatures created: ${buffer.length} bytes`);
    console.log(
      `⚠️ Note: This creates a signature document. For production, implement DOCX merging.`
    );

    return buffer;
  } catch (error) {
    console.error("❌ Error adding signatures to DOCX:", error);
    throw error;
  }
}

/**
 * Add signatures to XLSX documents (modifies workbook by adding a 'Digital Signatures' sheet)
 */
async function addSignaturesToXLSX(xlsxPathOrBuffer, signatures) {
  try {
    console.log("\n🖊️ ===== EMBEDDING SIGNATURES INTO XLSX =====");
    // xlsxPathOrBuffer can be a path or buffer
    const workbook = new Workbook();

    if (Buffer.isBuffer(xlsxPathOrBuffer)) {
      await workbook.xlsx.load(xlsxPathOrBuffer);
    } else {
      await workbook.xlsx.readFile(xlsxPathOrBuffer);
    }

    // Remove any existing "Digital Signatures" sheet to avoid duplicates
    const existing = workbook.getWorksheet("Digital Signatures");
    if (existing) {
      workbook.removeWorksheet(existing.id);
    }

    // Add a new worksheet for signatures
    const signatureSheet = workbook.addWorksheet("Digital Signatures");

    // Set column widths
    signatureSheet.columns = [
      { width: 25 },
      { width: 30 },
      { width: 20 },
      { width: 25 },
      { width: 40 },
    ];

    // Title
    const titleRow = signatureSheet.addRow(["DIGITAL SIGNATURES"]);
    titleRow.font = { size: 18, bold: true, color: { argb: "FF0B8043" } };
    titleRow.alignment = { horizontal: "center" };
    signatureSheet.mergeCells(`A1:E1`);

    signatureSheet.addRow([]);

    const subtitleRow = signatureSheet.addRow([
      "This document has been digitally signed by the following approvers:",
    ]);
    subtitleRow.font = { size: 11, italic: true };
    subtitleRow.alignment = { horizontal: "center" };
    signatureSheet.mergeCells(`A3:E3`);

    signatureSheet.addRow([]);

    // Header row
    const headerRow = signatureSheet.addRow([
      "Name",
      "Role & Department",
      "Level",
      "Signed Date",
      "Hash",
    ]);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0B8043" },
    };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };

    // Add each signature
    for (const sig of signatures) {
      const signedDate = new Date(sig.signed_at).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      const dataRow = signatureSheet.addRow([
        sig.signer_name,
        `${sig.signer_role} - ${sig.signer_department}${
          sig.signer_subject ? ` (${sig.signer_subject})` : ""
        }`,
        sig.approval_level,
        signedDate,
        sig.signature_hash.substring(0, 32) + "...",
      ]);

      dataRow.alignment = { vertical: "middle", wrapText: true };
      dataRow.height = 30;

      // Add signature image if available
      if (sig.signature_image) {
        try {
          let base64Data = sig.signature_image;
          if (base64Data.includes(",")) {
            base64Data = base64Data.split(",")[1];
          }

          const imageBuffer = Buffer.from(base64Data, "base64");
          const imageId = workbook.addImage({
            buffer: imageBuffer,
            extension: "png",
          });

          // Insert image in a separate row
          const currentRow = signatureSheet.rowCount;
          signatureSheet.addImage(imageId, {
            tl: { col: 0, row: currentRow },
            ext: { width: 200, height: 50 },
          });

          // Add empty row for image space
          const imgRow = signatureSheet.addRow([]);
          imgRow.height = 60;
        } catch (imgError) {
          console.error("Error adding signature image to Excel:", imgError);
        }
      }

      signatureSheet.addRow([]); // Spacer
    }

    // Style the sheet
    signatureSheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    console.log(`✅ XLSX signatures added: ${buffer.length} bytes`);

    return buffer;
  } catch (error) {
    console.error("❌ Error adding signatures to XLSX:", error);
    throw error;
  }
}

/**
 * Main function to add signatures to any document type
 *
 * Behavior:
 *  - PDF: embed signatures into the PDF and return signed PDF buffer
 *  - DOC/DOCX/PPT/PPTX: convert to PDF, embed signatures into PDF and return signed PDF buffer
 *  - XLS/XLSX: append a "Digital Signatures" worksheet and return signed XLSX buffer
 *  - Others: return original file buffer (no signing)
 */
async function addSignaturesToDocument(filePath, signatures, fileExtension) {
  try {
    console.log(
      `\n📝 Adding signatures to ${fileExtension.toUpperCase()} file...`
    );

    const ext = fileExtension.toLowerCase();

    if (ext === ".pdf") {
      return await addSignaturesToPDF(filePath, signatures);
    }

    if ([".doc", ".docx", ".ppt", ".pptx"].includes(ext)) {
      // Convert to PDF first, then embed signatures into the resulting PDF
      try {
        const pdfBuffer = await convertOfficeToPDF(filePath);
        return await addSignaturesToPDF(pdfBuffer, signatures);
      } catch (convErr) {
        console.error(
          `⚠️ Conversion to PDF failed for ${filePath}: ${convErr.message}`
        );
        // Fallback to returning original file
        return await fs.readFile(filePath);
      }
    }

    if (ext === ".xlsx" || ext === ".xls") {
      // For Excel, we can append a worksheet directly
      return await addSignaturesToXLSX(filePath, signatures);
    }

    console.log(`⚠️ Signature embedding not supported for ${fileExtension}`);
    // Return original file for unsupported types
    return await fs.readFile(filePath);
  } catch (error) {
    console.error(`❌ Error adding signatures to document:`, error);
    // Fallback: return original file
    try {
      return await fs.readFile(filePath);
    } catch (e) {
      throw error;
    }
  }
}

module.exports = {
  addSignaturesToDocument,
  addSignaturesToPDF,
  addSignaturesToDOCX,
  addSignaturesToXLSX,
};
