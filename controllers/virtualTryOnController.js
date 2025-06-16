// controllers/virtualTryOnController.js
class VirtualTryOnController {
  
  /**
   * Trang chọn sản phẩm để thử đồ ảo
   * GET /virtual-tryon
   */
  static async showSelectPage(req, res) {
    try {
      const Product = require('../models/Product');
      
      // Lấy danh sách sản phẩm để thử
      const products = await Product.find({ inStock: { $ne: false } })
        .sort({ createdAt: -1 })
        .limit(20);

      res.render('products/virtual-tryon-select', {
        title: 'Chọn sản phẩm thử đồ ảo - SportShop',
        currentPage: 'virtual-tryon',
        products: products,
        success: req.flash('success'),
        error: req.flash('error')
      });

    } catch (error) {
      console.error('❌ Show virtual try-on select error:', error);
      req.flash('error', 'Có lỗi khi tải danh sách sản phẩm');
      res.redirect('/products');
    }
  }

  /**
   * Trang Virtual Try-On cho sản phẩm cụ thể
   * GET /virtual-tryon/:productId
   */
  static async showTryOnPage(req, res) {
    try {
      const { productId } = req.params;
      const Product = require('../models/Product');
      
      const product = await Product.findById(productId);
      if (!product) {
        req.flash('error', 'Sản phẩm không tồn tại');
        return res.redirect('/virtual-tryon');
      }

      // Get related products (same category)
      const relatedProducts = await Product.find({
        category: product.category,
        _id: { $ne: productId }
      }).limit(8);

      res.render('products/virtual-tryon', {
        title: `Thử đồ ảo - ${product.name} - SportShop`,
        currentPage: 'virtual-tryon',
        product: product,
        relatedProducts: relatedProducts,
        success: req.flash('success'),
        error: req.flash('error')
      });

    } catch (error) {
      console.error('❌ Show virtual try-on page error:', error);
      req.flash('error', 'Có lỗi khi tải trang thử đồ');
      res.redirect('/virtual-tryon');
    }
  }

  /**
   * Trang lịch sử thử đồ
   * GET /virtual-tryon/user/history
   */
  static async showHistoryPage(req, res) {
    try {
      // Kiểm tra đăng nhập
      if (!req.session?.user) {
        req.flash('error', 'Vui lòng đăng nhập để xem lịch sử thử đồ');
        return res.redirect('/auth/login');
      }

      // Tạm thời trả về empty history
      res.render('user/try-on-history', {
        title: 'Lịch sử thử đồ ảo - SportShop',
        currentPage: 'try-on-history',
        history: [], // Sẽ implement sau
        success: req.flash('success'),
        error: req.flash('error')
      });

    } catch (error) {
      console.error('❌ Show history page error:', error);
      req.flash('error', 'Có lỗi khi tải lịch sử thử đồ');
      res.redirect('/user/account');
    }
  }

  /**
   * API: Xử lý thử đồ ảo
   * POST /virtual-tryon/api/process
   */
  static async processImage(req, res) {
    try {
      const { productId } = req.body;
      
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng upload ảnh của bạn'
        });
      }

      if (!productId) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng chọn sản phẩm'
        });
      }

      // Lấy thông tin sản phẩm
      const Product = require('../models/Product');
      const product = await Product.findById(productId);
      
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Sản phẩm không tồn tại'
        });
      }

      console.log('🎭 Processing virtual try-on for:', {
        productId,
        productName: product.name,
        fileSize: req.file.size,
        fileName: req.file.originalname
      });

      // Tạm thời mock response (sẽ implement AI sau)
      const mockResult = {
        id: Date.now().toString(),
        resultImage: product.imageUrl || '/images/products/mock-result.jpg',
        originalImage: '/images/products/mock-original.jpg',
        product: {
          id: productId,
          name: product.name,
          price: product.price
        },
        createdAt: new Date(),
        settings: {
          strength: parseFloat(req.body.strength) || 0.8,
          guidance_scale: parseFloat(req.body.guidance_scale) || 7.5,
          steps: parseInt(req.body.steps) || 20
        }
      };

      console.log('✅ Mock virtual try-on result generated');

      // Simulate processing time
      setTimeout(() => {
        res.json({
          success: true,
          data: mockResult,
          message: 'Xử lý thành công! (Đây là kết quả demo - chưa có AI thật)'
        });
      }, 2000);

    } catch (error) {
      console.error('❌ Virtual try-on process error:', error);
      res.status(500).json({
        success: false,
        message: 'Có lỗi xảy ra khi xử lý ảnh: ' + error.message
      });
    }
  }

  /**
   * API: Batch virtual try-on
   * POST /virtual-tryon/api/batch
   */
  static async batchTryOn(req, res) {
    try {
      const { productIds } = req.body;
      
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng upload ảnh của bạn'
        });
      }

      if (!productIds || !Array.isArray(JSON.parse(productIds))) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng chọn ít nhất một sản phẩm'
        });
      }

      const productIdArray = JSON.parse(productIds);
      const results = [];

      // Mock batch processing
      for (const productId of productIdArray) {
        const mockResult = {
          success: true,
          data: {
            id: Date.now().toString() + '_' + productId,
            resultImage: '/images/products/mock-result.jpg',
            originalImage: '/images/products/mock-original.jpg',
            product: {
              id: productId,
              name: `Product ${productId}`,
              price: 299000
            },
            createdAt: new Date()
          }
        };
        results.push(mockResult);
      }

      res.json({
        success: true,
        data: results,
        message: `Xử lý thành công ${results.length} sản phẩm!`
      });

    } catch (error) {
      console.error('❌ Batch try-on error:', error);
      res.status(500).json({
        success: false,
        message: 'Có lỗi khi xử lý batch try-on: ' + error.message
      });
    }
  }

  /**
   * API: Lấy lịch sử thử đồ
   * GET /virtual-tryon/api/history
   */
  static async getHistory(req, res) {
    try {
      // Tạm thời trả về empty array
      res.json({
        success: true,
        data: []
      });

    } catch (error) {
      console.error('❌ Get history error:', error);
      res.status(500).json({
        success: false,
        message: 'Có lỗi khi lấy lịch sử thử đồ'
      });
    }
  }

  /**
   * API: Xóa kết quả thử đồ
   * DELETE /virtual-tryon/api/result/:id
   */
  static async deleteResult(req, res) {
    try {
      const { id } = req.params;

      // Mock delete
      console.log('🗑️ Mock deleting try-on result:', id);

      res.json({
        success: true,
        message: 'Đã xóa kết quả thử đồ'
      });

    } catch (error) {
      console.error('❌ Delete result error:', error);
      res.status(500).json({
        success: false,
        message: 'Có lỗi khi xóa kết quả'
      });
    }
  }
}

module.exports = VirtualTryOnController;