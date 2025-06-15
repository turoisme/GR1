// middleware/upload.js - File Upload Middleware

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Tạo thư mục uploads nếu chưa có
const createUploadDirs = () => {
  const dirs = [
    'data/uploads',
    'data/uploads/products',
    'data/uploads/products/thumbnails'
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  });
};

createUploadDirs();

// Cấu hình storage cho multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'data/uploads/products/');
  },
  filename: function (req, file, cb) {
    // Tạo tên file unique: timestamp-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExtension = path.extname(file.originalname);
    const fileName = `product-${uniqueSuffix}${fileExtension}`;
    cb(null, fileName);
  }
});

// File filter - chỉ cho phép ảnh
const fileFilter = (req, file, cb) => {
  console.log('📤 Uploading file:', {
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size
  });
  
  // Kiểm tra loại file
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Chỉ cho phép upload file ảnh (JPG, PNG, GIF, WebP)'), false);
  }
};

// Cấu hình multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 5 // Tối đa 5 files
  }
});

// ✅ MIDDLEWARE CHO SINGLE FILE
const uploadSingle = upload.single('productImage');

// ✅ MIDDLEWARE CHO MULTIPLE FILES
const uploadMultiple = upload.array('productImages', 5);

// ✅ ERROR HANDLER MIDDLEWARE
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File quá lớn! Tối đa 5MB.',
        error: 'FILE_TOO_LARGE'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Quá nhiều file! Tối đa 5 files.',
        error: 'TOO_MANY_FILES'
      });
    }
  }
  
  if (err.message.includes('Chỉ cho phép upload file ảnh')) {
    return res.status(400).json({
      success: false,
      message: err.message,
      error: 'INVALID_FILE_TYPE'
    });
  }
  
  next(err);
};

module.exports = {
  uploadSingle,
  uploadMultiple,
  handleUploadError
};