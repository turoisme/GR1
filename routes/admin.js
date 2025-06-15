// routes/admin.js - FIXED VERSION WITH UPLOAD FUNCTIONALITY

const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const AdminController = require('../controllers/adminController');

// ✅ IMPORT UPLOAD MIDDLEWARE
const { uploadSingle, uploadMultiple, handleUploadError } = require('../middleware/upload');

// ✅ CRITICAL: Import Product model
const Product = require('../models/Product');

console.log('🔄 Admin routes loading...');
console.log('📦 Product model imported:', !!Product);
console.log('📤 Upload middleware imported:', !!uploadSingle);

// Tất cả routes admin đều yêu cầu phân quyền admin
router.use(requireAdmin);

// Dashboard
router.get('/', AdminController.dashboard);
router.get('/dashboard', AdminController.dashboard);

// ✅ NEW: UPLOAD ROUTES - THÊM SECTION NÀY
// ==============================================
// IMAGE UPLOAD ENDPOINTS
// ==============================================

/**
 * Upload single product image
 * POST /admin/upload/product-image
 */
router.post('/upload/product-image', uploadSingle, handleUploadError, async (req, res) => {
  try {
    console.log('📤 Admin uploading product image:', {
      file: req.file ? req.file.filename : 'No file',
      originalName: req.file ? req.file.originalname : 'N/A',
      size: req.file ? req.file.size : 0
    });

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Không có file được upload',
        error: 'NO_FILE'
      });
    }

    // Return the uploaded file info
    const imageUrl = `/uploads/products/${req.file.filename}`;
    
    res.json({
      success: true,
      message: 'Upload ảnh thành công',
      imageUrl: imageUrl,
      originalName: req.file.originalname,
      size: req.file.size,
      filename: req.file.filename
    });

  } catch (error) {
    console.error('❌ Admin Upload Error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi upload ảnh: ' + error.message,
      error: 'UPLOAD_ERROR'
    });
  }
});

/**
 * Upload multiple product images
 * POST /admin/upload/product-images
 */
router.post('/upload/product-images', uploadMultiple, handleUploadError, async (req, res) => {
  try {
    console.log('📤 Admin uploading multiple product images:', {
      fileCount: req.files ? req.files.length : 0
    });

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Không có file được upload',
        error: 'NO_FILES'
      });
    }

    // Process uploaded files
    const uploadedImages = req.files.map(file => ({
      imageUrl: `/uploads/products/${file.filename}`,
      originalName: file.originalname,
      size: file.size,
      filename: file.filename
    }));

    res.json({
      success: true,
      message: `Upload ${req.files.length} ảnh thành công`,
      images: uploadedImages,
      count: req.files.length
    });

  } catch (error) {
    console.error('❌ Admin Multiple Upload Error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi upload ảnh: ' + error.message,
      error: 'UPLOAD_ERROR'
    });
  }
});

/**
 * Delete uploaded image
 * DELETE /admin/upload/product-image/:filename
 */
router.delete('/upload/product-image/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const fs = require('fs');
    const path = require('path');
    
    const filePath = path.join(__dirname, '../data/uploads/products', filename);
    
    // Check if file exists and delete
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('🗑️ Deleted uploaded image:', filename);
      
      res.json({
        success: true,
        message: 'Xóa ảnh thành công',
        filename: filename
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Không tìm thấy file',
        error: 'FILE_NOT_FOUND'
      });
    }
    
  } catch (error) {
    console.error('❌ Admin Delete Image Error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi xóa ảnh: ' + error.message,
      error: 'DELETE_ERROR'
    });
  }
});

// ==============================================
// END UPLOAD ROUTES
// ==============================================

// Quản lý sản phẩm (existing routes)
router.get('/products', AdminController.listProducts);
router.get('/products/add', AdminController.showAddProduct);
router.post('/products/add', AdminController.addProduct);
router.get('/products/:id/edit', AdminController.showEditProduct);
router.post('/products/:id/edit', AdminController.editProduct);
router.delete('/products/:id', AdminController.deleteProduct);

// Quản lý đơn hàng
router.get('/orders', AdminController.listOrders);
router.get('/orders/:id', AdminController.viewOrder);
router.post('/orders/:id/status', AdminController.updateOrderStatus);
router.post('/orders/bulk-update', AdminController.bulkUpdateOrderStatus);
router.get('/orders/search', AdminController.searchOrders);
router.get('/orders/export', AdminController.exportOrders);

// Quản lý người dùng
router.get('/users', AdminController.listUsers);
router.get('/users/:id', AdminController.viewUser);
router.post('/users/:id/status', AdminController.updateUserStatus);

// Cài đặt hệ thống
router.get('/settings', AdminController.showSettings);
router.get('/api/settings', AdminController.getSettings);
router.get('/api/settings/:type', AdminController.getSettings);
router.post('/settings/:type', AdminController.updateSettings);
router.post('/settings/:type/reset', AdminController.resetSettings);

// Thống kê và báo cáo
router.get('/statistics', AdminController.statistics);

// API endpoints
router.get('/api/stats/overview', AdminController.getStatsOverview);
router.get('/api/stats/sales', AdminController.getSalesStats);
router.get('/api/revenue-stats', AdminController.getRevenueStats);
router.get('/api/revenue-breakdown', AdminController.getRevenueBreakdown);
router.get('/api/quick-stats', AdminController.getQuickStats);
router.get('/api/global-search', AdminController.globalSearch);
router.get('/api/health-check', AdminController.healthCheck);

// ✅ EXISTING API ENDPOINTS FOR PRODUCTS
router.get('/api/products', async (req, res) => {
  try {
    console.log('📡 Admin API: Getting products list');
    
    const { page = 1, limit = 25, search, category, brand, status } = req.query;
    
    // Build filter
    let filter = {};
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (category) filter.category = category;
    if (brand) filter.brand = brand;
    
    if (status === 'active') filter.inStock = true;
    else if (status === 'inactive') filter.inStock = false;
    else if (status === 'featured') filter.isFeatured = true;
    
    // Get products with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [products, totalProducts] = await Promise.all([
      Product.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Product.countDocuments(filter)
    ]);
    
    console.log(`✅ Admin API: Found ${products.length} products (${totalProducts} total)`);
    
    res.json({
      success: true,
      data: products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalProducts,
        pages: Math.ceil(totalProducts / parseInt(limit))
      }
    });
    
  } catch (error) {
    console.error('❌ Admin API Products Error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách sản phẩm',
      error: error.message
    });
  }
});

router.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy sản phẩm'
      });
    }
    
    res.json({
      success: true,
      data: product
    });
    
  } catch (error) {
    console.error('❌ Admin API Get Product Error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy thông tin sản phẩm',
      error: error.message
    });
  }
});

// Export & Maintenance
router.get('/export/all-data', AdminController.exportAllData);
router.post('/maintenance/cleanup', AdminController.cleanupData);

module.exports = router;