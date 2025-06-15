// middleware/upload.js - FIXED VERSION WITH DEBUG

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
    const fullPath = path.join(__dirname, '..', dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      console.log(`📁 Created directory: ${fullPath}`);
    } else {
      console.log(`✅ Directory exists: ${fullPath}`);
    }
  });
};

createUploadDirs();

// Cấu hình storage cho multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../data/uploads/products/');
    console.log('📁 Upload destination:', uploadPath);
    
    // Kiểm tra quyền ghi
    try {
      fs.accessSync(uploadPath, fs.constants.W_OK);
      console.log('✅ Write permission OK');
    } catch (error) {
      console.error('❌ No write permission:', error.message);
    }
    
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Tạo tên file unique: timestamp-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExtension = path.extname(file.originalname);
    const fileName = `product-${uniqueSuffix}${fileExtension}`;
    console.log('📝 Generated filename:', fileName);
    cb(null, fileName);
  }
});

// File filter - chỉ cho phép ảnh
const fileFilter = (req, file, cb) => {
  console.log('🔍 File filter check:', {
    originalname: file.originalname,
    mimetype: file.mimetype,
    fieldname: file.fieldname,
    size: file.size
  });
  
  // Kiểm tra loại file
  if (file.mimetype.startsWith('image/')) {
    console.log('✅ File accepted');
    cb(null, true);
  } else {
    console.log('❌ File rejected - not an image');
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

// ✅ FIXED MIDDLEWARE - MATCH FRONTEND FIELD NAME
const uploadSingle = upload.single('image'); // ✅ CHANGED from 'productImage' to 'image'

// ✅ MIDDLEWARE CHO MULTIPLE FILES
const uploadMultiple = upload.array('images', 5); // ✅ CHANGED from 'productImages' to 'images'

// ✅ ENHANCED ERROR HANDLER MIDDLEWARE
const handleUploadError = (err, req, res, next) => {
  console.log('🚨 Upload error occurred:', {
    error: err.message,
    code: err.code,
    field: err.field,
    stack: err.stack
  });

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
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: `Tên field không đúng. Expected: 'image', received: '${err.field}'`,
        error: 'WRONG_FIELD_NAME'
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
  
  // Other errors
  return res.status(500).json({
    success: false,
    message: 'Lỗi upload: ' + err.message,
    error: 'UPLOAD_ERROR'
  });
};

module.exports = {
  uploadSingle,
  uploadMultiple,
  handleUploadError
};