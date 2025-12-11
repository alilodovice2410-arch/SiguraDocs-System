const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { pool } = require("../config/database");
const authenticateToken = require("../middleware/auth");
const { logActivity, ACTIONS } = require("../utils/auditLogger");
const allowDocumentPreview = require("../middleware/documentCors");

// ✅ Import universal signature service
const {
  addSignaturesToDocument,
} = require("../utils/universalSignatureService");

// Import the converter helper for preview conversions
const { convertOfficeToPDF } = require("../utils/officeConverter");

// NEW: role notifier helpers
const {
  notifyHeadTeacherOfNewUpload,
  findHeadTeacherForDepartment,
  findPrincipal,
  notifyPrincipalOfNewUpload,
} = require("../utils/roleNotifier");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // ✅ Use environment variable or fallback to ./uploads for local dev
    const uploadDir = process.env.UPLOAD_PATH || "./uploads";

    console.log(`📁 Upload directory: ${uploadDir}`);

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log(`✅ Created upload directory: ${uploadDir}`);
    }

    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const filename = uniqueSuffix + path.extname(file.originalname);
    console.log(`📄 Saving file as: ${filename}`);
    cb(null, filename);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 },
  fileFilter: (req, file, cb) => {
    const allowedTypes =
      /pdf|doc|docx|xls|xlsx|ppt|pptx|jpg|jpeg|png|gif|bmp|txt/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Supported: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, JPG, PNG, GIF, BMP, TXT"
        )
      );
    }
  },
});
/**
 * Create notification helper (keeps backward compatibility where used locally)
 */
async function createNotification(
  userId,
  documentId,
  title,
  message,
  type,
  connection
) {
  try {
    await (connection || pool).query(
      `INSERT INTO notifications (user_id, document_id, title, message, type, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, FALSE, NOW())`,
      [userId, documentId, title, message, type]
    );
    console.log(`✅ Notification created for user ${userId}: ${title}`);
  } catch (error) {
    console.error("Notification error:", error);
  }
}

router.get("/:id/debug", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [documents] = await pool.query(
      "SELECT document_id, title, file_path, file_name, original_file_name, status FROM documents WHERE document_id = ?",
      [id]
    );

    if (documents.length === 0) {
      return res.json({
        success: false,
        message: "Document not found in database",
      });
    }

    const document = documents[0];
    const filePath = document.file_path;
    const fileExists = fs.existsSync(filePath);

    // List all files in uploads directory
    const uploadsDir = process.env.UPLOAD_PATH || "./uploads";
    let filesInUploads = [];
    try {
      filesInUploads = fs.readdirSync(uploadsDir);
    } catch (err) {
      filesInUploads = [`Error reading directory: ${err.message}`];
    }

    res.json({
      success: true,
      debug: {
        document_id: document.document_id,
        title: document.title,
        file_path: filePath,
        file_name: document.file_name,
        original_file_name: document.original_file_name,
        status: document.status,
        file_exists: fileExists,
        upload_path_env: process.env.UPLOAD_PATH || "./uploads",
        current_working_directory: process.cwd(),
        volume_name: process.env.RAILWAY_VOLUME_NAME || "No volume",
        volume_mount_path: process.env.RAILWAY_VOLUME_MOUNT_PATH || "No volume",
        files_in_uploads: filesInUploads.slice(0, 10), // First 10 files
        total_files_in_uploads: filesInUploads.length,
      },
    });
  } catch (error) {
    console.error("Debug error:", error);
    res.status(500).json({
      success: false,
      message: "Debug failed",
      error: error.message,
    });
  }
});

// ============================================
// IMPORTANT: Get document types - MUST be before /:id route
// ============================================
router.get("/types/all", authenticateToken, async (req, res) => {
  try {
    const [types] = await pool.query(
      "SELECT * FROM documenttypes ORDER BY type_name"
    );
    res.json({
      success: true,
      types,
    });
  } catch (error) {
    console.error("Fetch document types error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch document types.",
      error: error.message,
    });
  }
});

// ============================================
// Submit a new document - OPTIMIZED FOR SPEED
// ============================================
router.post(
  "/submit",
  authenticateToken,
  upload.single("file"),
  async (req, res) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const { title, doc_type_id } = req.body;
      const uploader_id = req.user.user_id;

      console.log("📤 Upload request:", { title, doc_type_id, uploader_id });

      if (!title || !doc_type_id || !req.file) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: "Title, document type, and file are required.",
        });
      }

      const file_path = req.file.path;
      const file_name = req.file.filename;
      const original_file_name = req.file.originalname;
      const file_size = req.file.size;

      // Get document type name
      const [docTypes] = await connection.query(
        "SELECT type_name FROM documenttypes WHERE doc_type_id = ?",
        [doc_type_id]
      );

      if (docTypes.length === 0) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: "Invalid document type.",
        });
      }

      const document_type = docTypes[0].type_name;

      // Get uploader's department
      const [userInfo] = await connection.query(
        "SELECT department, full_name FROM users WHERE user_id = ?",
        [uploader_id]
      );

      const department = userInfo[0]?.department || null;
      const uploaderName = userInfo[0]?.full_name || "Unknown";

      console.log(`🏫 Uploader: ${uploaderName} from ${department} department`);

      // Insert document
      const [result] = await connection.query(
        `INSERT INTO documents 
         (title, document_type, file_path, file_size, file_name, original_file_name, uploader_id, department, status, priority) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'medium')`,
        [
          title,
          document_type,
          file_path,
          file_size,
          file_name,
          original_file_name,
          uploader_id,
          department,
        ]
      );

      const document_id = result.insertId;
      console.log(`📄 Document created with ID: ${document_id}`);

      let approvalLevel = 1;

      // Find Head Teacher
      const headTeacher = await findHeadTeacherForDepartment(
        department,
        connection
      );

      if (headTeacher) {
        await connection.query(
          `INSERT INTO approvals 
          (document_id, approver_id, approval_level, status, created_at) 
          VALUES (?, ?, 1, 'pending', NOW())`,
          [document_id, headTeacher.user_id]
        );

        console.log(
          `✅ Level 1 Approval: Head Teacher ${headTeacher.full_name}`
        );

        await connection.query(
          `UPDATE documents 
          SET status = 'in_review', current_approver_id = ? 
          WHERE document_id = ?`,
          [headTeacher.user_id, document_id]
        );

        approvalLevel = 2;
      }

      // Find Principal
      const principal = await findPrincipal(connection);

      if (principal) {
        await connection.query(
          `INSERT INTO approvals 
          (document_id, approver_id, approval_level, status, created_at) 
          VALUES (?, ?, ?, 'pending', NOW())`,
          [document_id, principal.user_id, approvalLevel]
        );

        console.log(`✅ Level ${approvalLevel} Approval: Principal`);
      }

      // ✅ COMMIT TRANSACTION BEFORE SENDING RESPONSE
      await connection.commit();

      // ✅ SEND RESPONSE IMMEDIATELY - Don't wait for notifications/emails
      res.status(201).json({
        success: true,
        message: `Document submitted successfully!`,
        document_id,
      });

      // ✅ ASYNC OPERATIONS AFTER RESPONSE - Don't block the response
      // These run in the background without delaying the user
      setImmediate(async () => {
        try {
          // Audit log (non-blocking)
          logActivity(
            uploader_id,
            ACTIONS.DOCUMENT_UPLOADED,
            document_id,
            `Uploaded document: ${title}`,
            req.ip,
            req.get("user-agent")
          );

          // Notifications (parallel execution for speed)
          const notificationPromises = [];

          if (headTeacher) {
            notificationPromises.push(
              notifyHeadTeacherOfNewUpload(
                document_id,
                uploader_id,
                title,
                department,
                null // Use pool instead of connection
              ).catch((err) =>
                console.error("Failed to notify head teacher:", err)
              )
            );
          }

          if (principal) {
            notificationPromises.push(
              notifyPrincipalOfNewUpload(
                document_id,
                uploader_id,
                title,
                department,
                null // Use pool instead of connection
              ).catch((err) =>
                console.error("Failed to notify principal:", err)
              )
            );
          }

          // Wait for all notifications to complete
          await Promise.all(notificationPromises);
          console.log("✅ Background notifications completed");
        } catch (bgError) {
          console.error("Background processing error:", bgError);
          // Don't throw - this is best-effort
        }
      });
    } catch (error) {
      await connection.rollback();
      console.error("❌ Document submission error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to submit document.",
        error: error.message,
      });
    } finally {
      connection.release();
    }
  }
);

// ============================================
// Get all documents
// ============================================
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { status } = req.query;
    const user = req.user;

    let query = `
      SELECT 
        d.document_id,
        d.title,
        d.description,
        d.document_type,
        d.file_path,
        d.file_name,
        d.original_file_name,
        d.file_size,
        d.status,
        d.priority,
        d.department,
        d.created_at,
        d.updated_at,
        u.full_name AS submitter_name,
        u.username AS submitter_username,
        u.department AS submitter_department
      FROM documents d
      JOIN users u ON d.uploader_id = u.user_id
      WHERE 1=1
    `;

    const params = [];

    if (user.role_name === "Faculty" || user.role_name === "Staff") {
      query += " AND d.uploader_id = ?";
      params.push(user.user_id);
    } else if (user.role_name === "Department Head") {
      query += " AND d.department = ?";
      params.push(user.department);
    }

    if (status) {
      query += " AND d.status = ?";
      params.push(status);
    }

    query += " ORDER BY d.created_at DESC";

    const [documents] = await pool.query(query, params);

    res.json({
      success: true,
      documents,
    });
  } catch (error) {
    console.error("Fetch documents error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch documents.",
      error: error.message,
    });
  }
});

// ============================================
// GET document by ID - MUST be after /types/all route
// ============================================
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [documents] = await pool.query(
      `SELECT 
        d.document_id,
        d.title,
        d.description,
        d.document_type,
        d.file_path,
        d.file_name,
        d.original_file_name,
        d.file_size,
        d.status,
        d.priority,
        d.department,
        d.created_at,
        d.updated_at,
        u.full_name AS submitter_name,
        u.username AS submitter_username,
        u.email AS submitter_email,
        u.department AS submitter_department
      FROM documents d
      JOIN users u ON d.uploader_id = u.user_id
      WHERE d.document_id = ?`,
      [id]
    );

    if (documents.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Document not found.",
      });
    }

    const [approvalChain] = await pool.query(
      `SELECT 
        a.approval_level,
        a.status,
        a.comments,
        a.decision_date,
        u.full_name as approver_name,
        r.role_name as approver_role,
        u.subject as approver_subject
       FROM approvals a
       JOIN users u ON a.approver_id = u.user_id
       JOIN roles r ON u.role_id = r.role_id
       WHERE a.document_id = ?
       ORDER BY a.approval_level ASC`,
      [id]
    );

    // ✅ FIXED: Non-blocking audit log - no await
    logActivity(
      req.user.user_id,
      ACTIONS.DOCUMENT_VIEWED,
      id,
      `Viewed document: ${documents[0].title}`,
      req.ip,
      req.get("user-agent")
    );

    res.json({
      success: true,
      document: documents[0],
      approvalChain,
    });
  } catch (error) {
    console.error("Fetch document error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch document.",
      error: error.message,
    });
  }
});

// ============================================
// Preview endpoint - Convert Office files to PDF for in-browser preview
// ============================================
router.get(
  "/:id/preview",
  allowDocumentPreview,
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;

      const [documents] = await pool.query(
        "SELECT file_path, file_name, original_file_name, uploader_id, status, document_type FROM documents WHERE document_id = ?",
        [id]
      );

      if (documents.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Document not found.",
        });
      }

      const document = documents[0];
      const filePath = document.file_path;
      const fileExt = path.extname(document.file_name).toLowerCase();

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          message: "File not found on server.",
        });
      }

      // If PDF already, just stream it
      if (fileExt === ".pdf") {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `inline; filename="${
            document.original_file_name || document.file_name
          }"`
        );
        const fileBuffer = await fs.promises.readFile(filePath);
        return res.send(fileBuffer);
      }

      // For Office files (doc/docx/xls/xlsx/ppt/pptx), try to convert to PDF
      const convertible = [".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx"];
      if (convertible.includes(fileExt)) {
        try {
          const pdfBuffer = await convertOfficeToPDF(filePath);

          res.setHeader("Content-Type", "application/pdf");
          res.setHeader(
            "Content-Disposition",
            `inline; filename="${
              path.parse(document.original_file_name || document.file_name).name
            }.pdf"`
          );
          return res.send(pdfBuffer);
        } catch (convErr) {
          console.error("Preview conversion error:", convErr);
          // Fallback: send original file for download (not preview)
          const mimeTypes = {
            ".doc": "application/msword",
            ".docx":
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".xls": "application/vnd.ms-excel",
            ".xlsx":
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ".ppt": "application/vnd.ms-powerpoint",
            ".pptx":
              "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          };
          const mimeType = mimeTypes[fileExt] || "application/octet-stream";
          res.setHeader("Content-Type", mimeType);
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="${
              document.original_file_name || document.file_name
            }"`
          );
          const fileBuffer = await fs.promises.readFile(filePath);
          return res.send(fileBuffer);
        }
      }

      // For other types, send original inline where possible
      const mimeTypes = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".bmp": "image/bmp",
        ".txt": "text/plain",
      };
      const mimeType = mimeTypes[fileExt] || "application/octet-stream";
      res.setHeader("Content-Type", mimeType);
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${
          document.original_file_name || document.file_name
        }"`
      );
      const fileBuffer = await fs.promises.readFile(filePath);
      res.send(fileBuffer);
    } catch (error) {
      console.error("Preview error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to generate preview.",
        error: error.message,
      });
    }
  }
);

// ============================================
// ✅ UNIVERSAL SIGNATURE EMBEDDING - ALL FILE TYPES
// Download document with embedded signatures
// ============================================
router.get(
  "/:id/download",
  allowDocumentPreview,
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;

      console.log(`\n📥 ===== DOWNLOAD REQUEST =====`);
      console.log(`Document ID: ${id}`);
      console.log(`User: ${req.user.full_name} (${req.user.role_name})`);

      const [documents] = await pool.query(
        "SELECT file_path, file_name, original_file_name, uploader_id, status, document_type FROM documents WHERE document_id = ?",
        [id]
      );

      if (documents.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Document not found.",
        });
      }

      const document = documents[0];
      const filePath = document.file_path;
      const fileExt = path.extname(document.file_name).toLowerCase();

      console.log(`📄 Document: ${document.file_name}`);
      console.log(`   Original: ${document.original_file_name}`);
      console.log(`   Status: ${document.status}`);
      console.log(`   File Type: ${fileExt}`);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          message: "File not found on server.",
        });
      }

      // ✅ EMBED SIGNATURES FOR ALL SUPPORTED FILE TYPES
      const supportedTypes = [
        ".pdf",
        ".docx",
        ".doc",
        ".xlsx",
        ".xls",
        ".ppt",
        ".pptx",
      ];
      const shouldEmbedSignatures =
        document.status === "approved" && supportedTypes.includes(fileExt);

      if (shouldEmbedSignatures) {
        console.log(
          `🔍 Document is APPROVED ${fileExt.toUpperCase()} - checking for signatures...`
        );

        const [signatures] = await pool.query(
          `SELECT 
          signature_id,
          document_id,
          signer_id,
          signer_name,
          signer_role,
          signer_department,
          signer_subject,
          approval_level,
          signature_hash,
          signature_image,
          signed_at
         FROM document_signatures 
         WHERE document_id = ? 
         ORDER BY approval_level ASC`,
          [id]
        );

        console.log(`📊 Found ${signatures.length} signature(s)`);

        if (signatures.length > 0) {
          try {
            console.log(
              `🖊️ Embedding signatures into ${fileExt.toUpperCase()}...`
            );

            // ✅ Use universal signature service
            const signedBuffer = await addSignaturesToDocument(
              filePath,
              signatures,
              fileExt
            );

            // Detect if returned buffer is PDF (Office files get converted)
            const isPdf = signedBuffer.slice(0, 4).toString() === "%PDF";

            console.log("DEBUG: signedBuffer length:", signedBuffer.length);
            console.log("DEBUG: signedBuffer isPdf:", isPdf);

            // Determine response file type and output filename based on actual content
            let mimeType = "application/octet-stream";
            // Prefer original filename for user-friendly name
            const originalName =
              document.original_file_name || document.file_name;
            let outFilename = `SIGNED_${originalName}`;

            if (isPdf) {
              // Office files (doc, docx, ppt, pptx) are converted to PDF
              mimeType = "application/pdf";
              // Change extension to .pdf for converted Office files
              outFilename = `SIGNED_${path.parse(originalName).name}.pdf`;
              console.log(`✅ Converted to PDF, filename: ${outFilename}`);
            } else if (fileExt === ".xls" || fileExt === ".xlsx") {
              // Excel files keep their format
              mimeType =
                fileExt === ".xlsx"
                  ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  : "application/vnd.ms-excel";
              outFilename = `SIGNED_${originalName}`;
              console.log(`✅ Signed Excel file: ${outFilename}`);
            } else if (fileExt === ".pdf") {
              // PDF files stay as PDF
              mimeType = "application/pdf";
              outFilename = `SIGNED_${originalName}`;
            }

            // Set correct headers with attachment disposition to force download
            res.setHeader("Content-Type", mimeType);
            res.setHeader(
              "Content-Disposition",
              `attachment; filename="${outFilename}"`
            );
            res.setHeader("Content-Length", signedBuffer.length);
            res.setHeader(
              "Cache-Control",
              "no-cache, no-store, must-revalidate"
            );

            // ✅ FIXED: Non-blocking audit log - no await
            logActivity(
              req.user.user_id,
              ACTIONS.DOCUMENT_DOWNLOADED,
              id,
              `Downloaded signed document: ${outFilename}`,
              req.ip,
              req.get("user-agent")
            );

            console.log(
              `✅ Sending signed file as ${mimeType}: ${outFilename}`
            );
            return res.send(signedBuffer);
          } catch (signatureError) {
            console.error(`❌ Error embedding signatures:`, signatureError);
            console.error("Falling back to original file...");
            // Fall through to send original file
          }
        } else {
          console.log(`ℹ️ No signatures found for this document`);
        }
      } else if (
        document.status === "approved" &&
        !supportedTypes.includes(fileExt)
      ) {
        console.log(
          `ℹ️ Document is approved but signature embedding not supported for ${fileExt}`
        );
      }

      // Send original file for:
      // 1. Non-approved documents
      // 2. Unsupported file types
      // 3. If signature embedding failed
      const mimeTypes = {
        ".pdf": "application/pdf",
        ".doc": "application/msword",
        ".docx":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".xls": "application/vnd.ms-excel",
        ".xlsx":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".ppt": "application/vnd.ms-powerpoint",
        ".pptx":
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".bmp": "image/bmp",
        ".txt": "text/plain",
      };

      const mimeType = mimeTypes[fileExt] || "application/octet-stream";

      // ✅ FIXED: Non-blocking audit log - no await
      logActivity(
        req.user.user_id,
        ACTIONS.DOCUMENT_DOWNLOADED,
        id,
        `Downloaded document: ${
          document.original_file_name || document.file_name
        }`,
        req.ip,
        req.get("user-agent")
      );

      res.setHeader("Content-Type", mimeType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${
          document.original_file_name || document.file_name
        }"`
      );
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

      const fileBuffer = await fs.promises.readFile(filePath);
      console.log(`✅ Sending original file (${fileExt})`);
      res.send(fileBuffer);
    } catch (error) {
      console.error("❌ Download error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to download document.",
        error: error.message,
      });
    }
  }
);

module.exports = router;
