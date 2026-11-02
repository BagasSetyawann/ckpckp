const multer = require('multer');

const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/x-zip-compressed'
];

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipe file tidak diizinkan. Gunakan: JPG, PNG, PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, ZIP'), false);
  }
};

// File disimpan di memori (Vercel serverless tidak punya disk yang bisa ditulis).
// Dipakai untuk upload file Excel MPH. Bukti dukung diupload langsung ke Supabase Storage.
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 4 * 1024 * 1024 } // 4MB (batas body request Vercel ±4.5MB)
});

module.exports = { upload, ALLOWED_MIME_TYPES };
