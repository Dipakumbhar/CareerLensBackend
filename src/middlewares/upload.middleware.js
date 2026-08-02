const multer = require('multer');

// Store file in memory as a Buffer — pdf-parse reads from Buffer directly.
// No temp files written to disk.
const storage = multer.memoryStorage();

/**
 * Accept only PDF files. Reject everything else before the buffer is even
 * created, so the controller never receives a non-PDF payload.
 */
const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        cb(new Error('Only PDF files are accepted. Please upload a .pdf resume.'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5 MB — sufficient for any resume PDF
    }
});

module.exports = upload;
