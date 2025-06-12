// routes/user.js
const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');
const { 
  requireAuth, 
  checkAccountStatus, 
  refreshSession, 
  logUserActivity,
  syncUserSession 
} = require('../middleware/auth');

console.log('👤 User routes loaded');

// =====================================
// MIDDLEWARE - Apply to all user routes
// =====================================

// All user routes require authentication
router.use(requireAuth);

// Check account status and sync session
router.use(checkAccountStatus);
router.use(syncUserSession);

// Refresh session on activity
router.use(refreshSession);

// =====================================
// USER ACCOUNT ROUTES
// =====================================

/**
 * Trang tài khoản chính - Dashboard
 * GET /user/account
 */
router.get('/account', 
  logUserActivity('view_account_dashboard'),
  UserController.account
);

/**
 * Redirect /user to /user/account
 * GET /user/
 */
router.get('/', (req, res) => {
  res.redirect('/user/account');
});

// =====================================
// PROFILE MANAGEMENT ROUTES
// =====================================

/**
 * Trang chỉnh sửa thông tin cá nhân
 * GET /user/profile
 */
router.get('/profile', 
  logUserActivity('view_profile_page'),
  UserController.showProfile
);

/**
 * Cập nhật thông tin cá nhân
 * POST /user/profile
 * PUT /user/profile
 */
router.post('/profile', 
  logUserActivity('update_profile'),
  UserController.updateProfile
);

router.put('/profile', 
  logUserActivity('update_profile'),
  UserController.updateProfile
);

/**
 * Thay đổi mật khẩu
 * POST /user/change-password
 */
router.post('/change-password', 
  logUserActivity('change_password'),
  UserController.changePassword
);

// =====================================
// ADDRESS MANAGEMENT ROUTES
// =====================================

/**
 * Trang quản lý địa chỉ
 * GET /user/addresses
 */
router.get('/addresses', 
  logUserActivity('view_addresses'),
  UserController.showAddresses
);

/**
 * Thêm địa chỉ mới
 * POST /user/addresses
 */
router.post('/addresses', 
  logUserActivity('add_address'),
  UserController.addAddress
);

/**
 * Cập nhật địa chỉ
 * PUT /user/addresses/:addressId
 */
router.put('/addresses/:addressId', 
  logUserActivity('update_address'),
  UserController.updateAddress
);

/**
 * Xóa địa chỉ
 * DELETE /user/addresses/:addressId
 */
router.delete('/addresses/:addressId', 
  logUserActivity('delete_address'),
  UserController.deleteAddress
);

// =====================================
// FAVORITES ROUTES
// =====================================

/**
 * Trang sản phẩm yêu thích
 * GET /user/favorites
 */
router.get('/favorites', 
  logUserActivity('view_favorites'),
  UserController.showFavorites
);

/**
 * Thêm/Xóa sản phẩm yêu thích
 * POST /user/favorites/:productId
 */
router.post('/favorites/:productId', 
  logUserActivity('toggle_favorite'),
  UserController.toggleFavorite
);

/**
 * API: Kiểm tra sản phẩm có trong danh sách yêu thích không
 * GET /user/favorites/check/:productId
 */
router.get('/favorites/check/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.session.user.id;
    
    const User = require('../models/User');
    const user = await User.findById(userId).select('favoriteProducts');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tài khoản'
      });
    }
    
    const isFavorite = user.favoriteProducts.includes(productId);
    
    res.json({
      success: true,
      data: {
        isFavorite: isFavorite,
        productId: productId
      }
    });
    
  } catch (error) {
    console.error('Check Favorite Error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi kiểm tra danh sách yêu thích'
    });
  }
});

// =====================================
// ORDER ROUTES (Placeholder)
// =====================================

/**
 * Danh sách đơn hàng
 * GET /user/orders
 */
router.get('/orders', 
  logUserActivity('view_orders'),
  (req, res) => {
    // TODO: Implement when Order model is ready
    res.render('user/orders', {
      title: 'Đơn hàng của tôi - SportShop',
      currentPage: 'orders',
      orders: [],
      pagination: {
        currentPage: 1,
        totalPages: 0,
        hasNext: false,
        hasPrev: false
      },
      success: req.flash('success'),
      error: req.flash('error')
    });
  }
);

/**
 * Chi tiết đơn hàng
 * GET /user/orders/:orderId
 */
router.get('/orders/:orderId', 
  logUserActivity('view_order_detail'),
  (req, res) => {
    // TODO: Implement when Order model is ready
    const { orderId } = req.params;
    
    res.render('user/order-detail', {
      title: `Đơn hàng #${orderId} - SportShop`,
      currentPage: 'orders',
      order: null,
      orderId: orderId,
      success: req.flash('success'),
      error: req.flash('error')
    });
  }
);

/**
 * Hủy đơn hàng
 * POST /user/orders/:orderId/cancel
 */
router.post('/orders/:orderId/cancel', 
  logUserActivity('cancel_order'),
  (req, res) => {
    // TODO: Implement when Order model is ready
    res.json({
      success: false,
      message: 'Tính năng hủy đơn hàng chưa được triển khai'
    });
  }
);

// =====================================
// NOTIFICATION SETTINGS
// =====================================

/**
 * Trang cài đặt thông báo
 * GET /user/notifications
 */
router.get('/notifications', 
  logUserActivity('view_notification_settings'),
  async (req, res) => {
    try {
      const userId = req.session.user.id;
      const User = require('../models/User');
      const user = await User.findById(userId).select('notifications');
      
      if (!user) {
        req.flash('error', 'Không tìm thấy thông tin tài khoản');
        return res.redirect('/user/account');
      }
      
      res.render('user/notifications', {
        title: 'Cài đặt thông báo - SportShop',
        currentPage: 'notifications',
        user: user,
        notifications: user.notifications,
        success: req.flash('success'),
        error: req.flash('error')
      });
      
    } catch (error) {
      console.error('Show Notifications Error:', error);
      res.status(500).render('error', {
        title: 'Lỗi - SportShop',
        error: 'Không thể tải trang cài đặt thông báo'
      });
    }
  }
);

/**
 * Cập nhật cài đặt thông báo
 * POST /user/notifications
 */
router.post('/notifications', 
  logUserActivity('update_notification_settings'),
  async (req, res) => {
    try {
      const userId = req.session.user.id;
      const { emailOrders, emailPromotions, emailNewsletter, smsOrders, smsPromotions } = req.body;
      
      const User = require('../models/User');
      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy tài khoản'
        });
      }
      
      // Update notification preferences
      user.notifications = {
        email: {
          orders: !!emailOrders,
          promotions: !!emailPromotions,
          newsletter: !!emailNewsletter
        },
        sms: {
          orders: !!smsOrders,
          promotions: !!smsPromotions
        }
      };
      
      await user.save();
      
      res.json({
        success: true,
        message: 'Cập nhật cài đặt thông báo thành công!',
        data: {
          notifications: user.notifications
        }
      });
      
    } catch (error) {
      console.error('Update Notifications Error:', error);
      res.status(500).json({
        success: false,
        message: 'Có lỗi xảy ra khi cập nhật cài đặt thông báo'
      });
    }
  }
);

// =====================================
// API ROUTES
// =====================================

/**
 * API: Lấy thông tin tài khoản
 * GET /user/api/profile
 */
router.get('/api/profile', 
  logUserActivity('api_get_profile'),
  UserController.getProfileAPI
);

/**
 * API: Cập nhật thông tin cá nhân
 * PUT /user/api/profile
 */
router.put('/api/profile', 
  logUserActivity('api_update_profile'),
  UserController.updateProfile
);

/**
 * API: Lấy danh sách địa chỉ
 * GET /user/api/addresses
 */
router.get('/api/addresses', async (req, res) => {
  try {
    const userId = req.session.user.id;
    const User = require('../models/User');
    const user = await User.findById(userId).select('addresses');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tài khoản'
      });
    }
    
    res.json({
      success: true,
      data: {
        addresses: user.addresses,
        defaultAddress: user.getDefaultAddress()
      }
    });
    
  } catch (error) {
    console.error('Get Addresses API Error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách địa chỉ'
    });
  }
});

/**
 * API: Lấy danh sách sản phẩm yêu thích
 * GET /user/api/favorites
 */
router.get('/api/favorites', async (req, res) => {
  try {
    const userId = req.session.user.id;
    const User = require('../models/User');
    const user = await User.findById(userId).populate('favoriteProducts');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tài khoản'
      });
    }
    
    res.json({
      success: true,
      data: {
        favorites: user.favoriteProducts,
        count: user.favoriteProducts.length
      }
    });
    
  } catch (error) {
    console.error('Get Favorites API Error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách yêu thích'
    });
  }
});

/**
 * API: Thống kê tài khoản
 * GET /user/api/stats
 */
router.get('/api/stats', 
  logUserActivity('api_get_stats'),
  async (req, res) => {
    try {
      const userId = req.session.user.id;
      const User = require('../models/User');
      const Cart = require('../models/Cart');
      
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy tài khoản'
        });
      }
      
      // Get current cart
      const cart = await Cart.findBySessionId(req.sessionID, userId);
      
      // Calculate account age
      const accountAge = Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      
      const stats = {
        accountInfo: {
          joinDate: user.createdAt,
          accountAge: accountAge,
          lastLogin: user.lastLogin,
          isVerified: user.isVerified
        },
        orderStats: {
          totalOrders: user.totalOrders || 0,
          totalSpent: user.totalSpent || 0,
          averageOrderValue: user.totalOrders > 0 ? (user.totalSpent / user.totalOrders) : 0
        },
        currentActivity: {
          cartItems: cart.totalItems,
          cartTotal: cart.finalTotal,
          favoriteProducts: user.favoriteProducts.length,
          savedAddresses: user.addresses.length
        },
        preferences: {
          notifications: user.notifications,
          defaultAddress: user.getDefaultAddress()
        }
      };
      
      res.json({
        success: true,
        data: stats
      });
      
    } catch (error) {
      console.error('Get Stats API Error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy thống kê tài khoản'
      });
    }
  }
);

/**
 * API: Xóa tài khoản (deactivate)
 * DELETE /user/api/account
 */
router.delete('/api/account', 
  logUserActivity('deactivate_account'),
  async (req, res) => {
    try {
      const { password, reason } = req.body;
      const userId = req.session.user.id;
      
      if (!password) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng nhập mật khẩu để xác nhận'
        });
      }
      
      const User = require('../models/User');
      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy tài khoản'
        });
      }
      
      // Verify password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        return res.status(400).json({
          success: false,
          message: 'Mật khẩu không đúng'
        });
      }
      
      // Deactivate account instead of deleting
      user.isActive = false;
      user.updatedAt = new Date();
      await user.save();
      
      // Clear session
      req.session.destroy();
      
      console.log('🗑️ Account deactivated:', {
        userId: user._id,
        email: user.email,
        reason: reason || 'No reason provided'
      });
      
      res.json({
        success: true,
        message: 'Tài khoản đã được vô hiệu hóa thành công',
        data: {
          redirectTo: '/'
        }
      });
      
    } catch (error) {
      console.error('Deactivate Account Error:', error);
      res.status(500).json({
        success: false,
        message: 'Có lỗi xảy ra khi vô hiệu hóa tài khoản'
      });
    }
  }
);

// =====================================
// ADMIN ROUTES (for user management)
// =====================================

/**
 * API: Export user data (GDPR compliance)
 * GET /user/api/export
 */
router.get('/api/export', 
  logUserActivity('export_user_data'),
  async (req, res) => {
    try {
      const userId = req.session.user.id;
      const User = require('../models/User');
      const Cart = require('../models/Cart');
      
      const user = await User.findById(userId).populate('favoriteProducts');
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy tài khoản'
        });
      }
      
      // Get cart data
      const cart = await Cart.findOne({ userId: userId }).populate('items.product');
      
      // Prepare export data
      const exportData = {
        profile: user.toPublicJSON(),
        cart: cart ? {
          items: cart.items,
          totalItems: cart.totalItems,
          totalPrice: cart.totalPrice
        } : null,
        exportDate: new Date().toISOString(),
        exportedBy: 'SportShop System'
      };
      
      // Set headers for file download
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="sportshop-data-${userId}.json"`);
      
      res.json(exportData);
      
    } catch (error) {
      console.error('Export User Data Error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi xuất dữ liệu tài khoản'
      });
    }
  }
);

// =====================================
// ERROR HANDLING
// =====================================

// Handle 404 for user routes
router.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({
      success: false,
      message: 'API endpoint không tồn tại'
    });
  } else {
    res.status(404).render('404', {
      title: 'Trang không tìm thấy - SportShop',
      currentPage: '404'
    });
  }
});

module.exports = router;