const express = require('express');
const router = express.Router();
const VirtualTryOnController = require('../controllers/virtualTryOnController');
const { uploadSingle } = require('../middleware/upload');
const { optionalAuth } = require('../middleware/auth');

console.log('🎭 Virtual Try-On routes loaded');

// Apply optional auth to all routes
router.use(optionalAuth);

// =====================================
// WEB ROUTES
// =====================================

/**
 * Show virtual try-on page for a product
 * GET /virtual-tryon/:productId
 */
router.get('/:productId', VirtualTryOnController.showTryOnPage);

/**
 * Show try-on history page
 * GET /virtual-tryon/history
 */
router.get('/user/history', VirtualTryOnController.showHistoryPage);

/**
 * Share try-on result (public view)
 * GET /virtual-tryon/share/:resultId
 */
router.get('/share/:resultId', async (req, res) => {
  try {
    const { resultId } = req.params;
    const VirtualTryOn = require('../models/VirtualTryOn');
    
    const result = await VirtualTryOn.findById(resultId)
      .populate('productId', 'name price images')
      .lean();
    
    if (!result || !result.isPublic) {
      req.flash('error', 'Kết quả không tồn tại hoặc không được chia sẻ công khai');
      return res.redirect('/');
    }
    
    res.render('virtual-tryon/share', {
      title: `Kết quả thử đồ ảo - ${result.productName} - SportShop`,
      result: result,
      product: result.productId
    });
    
  } catch (error) {
    console.error('❌ Share result error:', error);
    req.flash('error', 'Có lỗi khi tải kết quả');
    res.redirect('/');
  }
});

// =====================================
// API ROUTES
// =====================================

/**
 * Process virtual try-on
 * POST /virtual-tryon/api/process
 */
router.post('/api/process', 
  uploadSingle,
  VirtualTryOnController.processImage
);

/**
 * Batch virtual try-on
 * POST /virtual-tryon/api/batch
 */
router.post('/api/batch',
  uploadSingle,
  VirtualTryOnController.batchTryOn
);

/**
 * Get try-on history
 * GET /virtual-tryon/api/history
 */
router.get('/api/history', VirtualTryOnController.getHistory);

/**
 * Delete try-on result
 * DELETE /virtual-tryon/api/result/:id
 */
router.delete('/api/result/:id', VirtualTryOnController.deleteResult);

/**
 * Get result details
 * GET /virtual-tryon/api/result/:id
 */
router.get('/api/result/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session?.user?.id || null;
    const sessionId = req.sessionID;
    
    const VirtualTryOn = require('../models/VirtualTryOn');
    
    const query = { _id: id };
    if (userId) {
      query.userId = userId;
    } else {
      query.sessionId = sessionId;
    }
    
    const result = await VirtualTryOn.findOne(query)
      .populate('productId', 'name price images')
      .lean();
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy kết quả'
      });
    }
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('❌ Get result error:', error);
    res.status(500).json({
      success: false,
      message: 'Có lỗi khi lấy kết quả'
    });
  }
});

/**
 * Toggle result publicity
 * PUT /virtual-tryon/api/result/:id/publicity
 */
router.put('/api/result/:id/publicity', async (req, res) => {
  try {
    const { id } = req.params;
    const { isPublic } = req.body;
    const userId = req.session?.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Vui lòng đăng nhập'
      });
    }
    
    const VirtualTryOn = require('../models/VirtualTryOn');
    
    const result = await VirtualTryOn.findOneAndUpdate(
      { _id: id, userId: userId },
      { isPublic: Boolean(isPublic) },
      { new: true }
    );
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy kết quả'
      });
    }
    
    res.json({
      success: true,
      message: isPublic ? 'Đã công khai kết quả' : 'Đã ẩn kết quả',
      data: { isPublic: result.isPublic }
    });
    
  } catch (error) {
    console.error('❌ Toggle publicity error:', error);
    res.status(500).json({
      success: false,
      message: 'Có lỗi khi cập nhật'
    });
  }
});

module.exports = router;