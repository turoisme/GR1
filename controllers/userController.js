// controllers/userController.js
const User = require('../models/User');
const Cart = require('../models/Cart');
const Product = require('../models/Product');

class UserController {
  /**
   * Trang tài khoản chính - Dashboard
   * GET /user/account
   */
  static async account(req, res) {
    try {
      const userId = req.session.user.id;
      const user = await User.findById(userId);
      
      if (!user) {
        req.flash('error', 'Không tìm thấy thông tin tài khoản');
        return res.redirect('/auth/login');
      }
      
      console.log('👤 User account accessed:', {
        userId: user._id,
        email: user.email,
        fullName: user.fullName
      });
      
      // Get user statistics (mock data since Order model not implemented yet)
      const userStats = {
        totalOrders: user.totalOrders || 0,
        totalSpent: user.totalSpent || 0,
        joinedDate: user.createdAt,
        lastLogin: user.lastLogin,
        addressCount: user.addresses.length,
        favoriteCount: user.favoriteProducts.length
      };
      
      // Get recent orders (mock data)
      const recentOrders = [];
      
      // Get current cart
      const cart = await Cart.findBySessionId(req.sessionID, userId);
      
      // Get favorite products
      const favoriteProducts = await Product.find({
        _id: { $in: user.favoriteProducts }
      }).limit(6);
      
      res.render('user/account', {
        title: 'Tài khoản của tôi - SportShop',
        currentPage: 'account',
        user: user,
        userStats: userStats,
        recentOrders: recentOrders,
        cart: cart,
        favoriteProducts: favoriteProducts,
        success: req.flash('success'),
        error: req.flash('error')
      });
      
    } catch (error) {
      console.error('User Account Error:', error);
      res.status(500).render('error', {
        title: 'Lỗi - SportShop',
        error: 'Không thể tải trang tài khoản',
        currentPage: 'error'
      });
    }
  }

  /**
   * Hiển thị danh sách đơn hàng - SỬA LỖI KHÔNG HIỂN THỊ ĐƠN HÀNG
   * GET /user/orders
   */
  static async getOrders(req, res) {
    try {
      const sessionId = req.sessionID || req.session.id;
      const userId = req.session?.user?.id || null;
      
      console.log('📦 Get orders:', { sessionId, userId });
      
      let orders = [];
      
      // TRY MULTIPLE METHODS TO FIND ORDERS
      try {
        const Order = require('../models/Order');
        
        // Method 1: Find by userId if user is logged in
        if (userId) {
          const userOrders = await Order.find({ 
            $or: [
              { userId: userId },
              { sessionId: sessionId },
              { 'customer.email': req.session?.user?.email }
            ]
          }).sort({ createdAt: -1 });
          orders = orders.concat(userOrders);
        }
        
        // Method 2: Find by sessionId
        const sessionOrders = await Order.find({ sessionId }).sort({ createdAt: -1 });
        orders = orders.concat(sessionOrders);
        
        // Remove duplicates based on orderId
        const uniqueOrders = orders.filter((order, index, self) => 
          index === self.findIndex(o => o.orderId === order.orderId)
        );
        
        orders = uniqueOrders;
        
        console.log('📋 Found orders from database:', {
          totalOrders: orders.length,
          orderIds: orders.map(o => o.orderId)
        });
        
      } catch (orderError) {
        console.log('⚠️ Database query failed, checking session orders:', orderError.message);
        orders = [];
      }
      
      // Fallback: Check session orders if database fails
      if (req.session.orders && req.session.orders.length > 0) {
        const sessionOrders = req.session.orders.map(orderData => ({
          orderId: orderData.orderId,
          status: orderData.status,
          customer: orderData.customer,
          items: orderData.items,
          totalItems: orderData.totalItems,
          finalTotal: orderData.finalTotal,
          paymentMethod: orderData.paymentMethod,
          estimatedDelivery: orderData.estimatedDelivery,
          createdAt: new Date(orderData.createdAt || Date.now()),
          isSessionOrder: true // Flag to identify session orders
        }));
        
        // Merge with database orders, avoiding duplicates
        sessionOrders.forEach(sessionOrder => {
          const exists = orders.find(o => o.orderId === sessionOrder.orderId);
          if (!exists) {
            orders.push(sessionOrder);
          }
        });
        
        console.log('📋 Added session orders:', sessionOrders.length);
      }
      
      // Sort by creation date (newest first)
      orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      // Calculate summary statistics
      const totalOrders = orders.length;
      const pendingOrders = orders.filter(o => o.status === 'pending').length;
      const completedOrders = orders.filter(o => o.status === 'delivered').length;
      const totalSpent = orders
        .filter(o => o.status !== 'cancelled')
        .reduce((sum, o) => sum + (o.finalTotal || 0), 0);
      
      console.log('📊 Order summary:', {
        total: totalOrders,
        pending: pendingOrders,
        completed: completedOrders,
        totalSpent: totalSpent
      });
      
      res.render('user/orders', {
        title: 'Đơn hàng của tôi - SportShop',
        currentPage: 'orders',
        user: req.session?.user || null,
        orders: orders,
        totalOrders: totalOrders,
        pendingOrders: pendingOrders,
        completedOrders: completedOrders,
        totalSpent: totalSpent,
        success: req.flash('success'),
        error: req.flash('error')
      });
      
    } catch (error) {
      console.error('❌ Error getting orders:', error);
      res.status(500).render('error', {
        title: 'Lỗi - SportShop',
        error: 'Không thể tải danh sách đơn hàng',
        currentPage: 'error',
        user: req.session?.user || null
      });
    }
  }

  /**
   * Hiển thị chi tiết đơn hàng
   * GET /user/orders/:orderId
   */
  static async getOrderDetail(req, res) {
    try {
      const { orderId } = req.params;
      const sessionId = req.sessionID || req.session.id;
      const userId = req.session?.user?.id || null;
      
      console.log('📋 Get order detail:', { orderId, sessionId, userId });
      
      let order = null;
      
      // Try to find order in database first
      try {
        const Order = require('../models/Order');
        
        // Find order with access permission check
        const query = { orderId };
        if (userId) {
          query.$or = [
            { userId: userId },
            { sessionId: sessionId },
            { 'customer.email': req.session?.user?.email }
          ];
        } else {
          query.sessionId = sessionId;
        }
        
        order = await Order.findOne(query);
        
        console.log('🔍 Database order found:', !!order);
        
      } catch (orderError) {
        console.log('⚠️ Database query failed:', orderError.message);
      }
      
      // Fallback: Check session orders
      if (!order && req.session.orders) {
        const sessionOrder = req.session.orders.find(o => o.orderId === orderId);
        if (sessionOrder) {
          order = {
            ...sessionOrder,
            createdAt: new Date(sessionOrder.createdAt || Date.now()),
            isSessionOrder: true
          };
          console.log('🔍 Session order found:', !!order);
        }
      }
      
      if (!order) {
        req.flash('error', 'Không tìm thấy đơn hàng');
        return res.redirect('/user/orders');
      }
      
      res.render('user/order-detail', {
        title: `Đơn hàng #${order.orderId} - SportShop`,
        currentPage: 'orders',
        user: req.session?.user || null,
        order: order,
        success: req.flash('success'),
        error: req.flash('error')
      });
      
    } catch (error) {
      console.error('❌ Error getting order detail:', error);
      req.flash('error', 'Không thể tải chi tiết đơn hàng');
      res.redirect('/user/orders');
    }
  }

  /**
   * Hủy đơn hàng
   * POST /user/orders/:orderId/cancel
   */
  static async cancelOrder(req, res) {
    try {
      const { orderId } = req.params;
      const { reason = 'Customer request' } = req.body;
      const sessionId = req.sessionID || req.session.id;
      const userId = req.session?.user?.id || null;
      
      console.log('❌ Cancelling order:', { orderId, reason });
      
      let order = null;
      let isSessionOrder = false;
      
      // Try to find and cancel order in database first
      try {
        const Order = require('../models/Order');
        
        order = await Order.findOne({ orderId });
        
        if (order) {
          // Check access permission
          const hasAccess = (userId && order.userId && order.userId.toString() === userId) || 
                           (order.sessionId === sessionId);
          
          if (!hasAccess) {
            return res.json({
              success: false,
              message: 'Bạn không có quyền hủy đơn hàng này'
            });
          }
          
          // Check if order can be cancelled
          if (order.status === 'delivered') {
            return res.json({
              success: false,
              message: 'Không thể hủy đơn hàng đã giao'
            });
          }
          
          if (order.status === 'cancelled') {
            return res.json({
              success: false,
              message: 'Đơn hàng đã được hủy trước đó'
            });
          }
          
          // Cancel order in database
          await order.cancel(reason);
          
          console.log('✅ Order cancelled in database:', orderId);
        }
        
      } catch (orderError) {
        console.log('⚠️ Database cancel failed:', orderError.message);
      }
      
      // Also cancel in session if exists
      if (req.session.orders) {
        const sessionOrderIndex = req.session.orders.findIndex(o => o.orderId === orderId);
        if (sessionOrderIndex > -1) {
          req.session.orders[sessionOrderIndex].status = 'cancelled';
          req.session.orders[sessionOrderIndex].cancelReason = reason;
          isSessionOrder = true;
          console.log('✅ Order cancelled in session:', orderId);
        }
      }
      
      if (!order && !isSessionOrder) {
        return res.json({
          success: false,
          message: 'Không tìm thấy đơn hàng'
        });
      }
      
      res.json({
        success: true,
        message: 'Đơn hàng đã được hủy thành công',
        data: {
          orderId: orderId,
          status: 'cancelled',
          cancelReason: reason
        }
      });
      
    } catch (error) {
      console.error('❌ Error cancelling order:', error);
      res.json({
        success: false,
        message: 'Có lỗi xảy ra khi hủy đơn hàng. Vui lòng thử lại.'
      });
    }
  }

  /**
   * Đặt lại đơn hàng
   * POST /user/orders/:orderId/reorder
   */
  static async reorderOrder(req, res) {
    try {
      const { orderId } = req.params;
      const sessionId = req.sessionID || req.session.id;
      const userId = req.session?.user?.id || null;
      
      console.log('🔄 Reordering:', { orderId, sessionId, userId });
      
      let order = null;
      
      // Try to find order in database first
      try {
        const Order = require('../models/Order');
        order = await Order.findOne({ orderId });
      } catch (orderError) {
        console.log('⚠️ Database query failed:', orderError.message);
      }
      
      // Fallback: Check session orders
      if (!order && req.session.orders) {
        const sessionOrder = req.session.orders.find(o => o.orderId === orderId);
        if (sessionOrder) {
          order = sessionOrder;
        }
      }
      
      if (!order) {
        return res.json({
          success: false,
          message: 'Không tìm thấy đơn hàng'
        });
      }
      
      // Get current cart
      const cart = await Cart.findBySessionId(sessionId, userId);
      
      // Add all items from the order to cart
      let addedItems = 0;
      if (order.items && order.items.length > 0) {
        for (const item of order.items) {
          try {
            await cart.addItem(
              item.productId,
              item.quantity,
              item.color || 'Mặc định',
              item.size || 'Mặc định'
            );
            addedItems++;
          } catch (addError) {
            console.log('⚠️ Failed to add item to cart:', addError.message);
          }
        }
      }
      
      res.json({
        success: true,
        message: `Đã thêm ${addedItems} sản phẩm vào giỏ hàng`,
        data: {
          addedItems: addedItems,
          totalItems: cart.totalItems,
          cartTotal: cart.getFormattedFinalTotal()
        }
      });
      
    } catch (error) {
      console.error('❌ Error reordering:', error);
      res.json({
        success: false,
        message: 'Có lỗi xảy ra khi đặt lại đơn hàng'
      });
    }
  }

  /**
   * Trang chỉnh sửa thông tin cá nhân
   * GET /user/profile
   */
  static async showProfile(req, res) {
    try {
      const userId = req.session.user.id;
      const user = await User.findById(userId);
      
      if (!user) {
        req.flash('error', 'Không tìm thấy thông tin tài khoản');
        return res.redirect('/auth/login');
      }
      
      res.render('user/profile', {
        title: 'Thông tin cá nhân - SportShop',
        currentPage: 'profile',
        user: user,
        success: req.flash('success'),
        error: req.flash('error')
      });
      
    } catch (error) {
      console.error('User ShowProfile Error:', error);
      res.status(500).render('error', {
        title: 'Lỗi - SportShop',
        error: 'Không thể tải trang thông tin cá nhân'
      });
    }
  }

  /**
   * Cập nhật thông tin cá nhân
   * POST /user/profile
   */
  static async updateProfile(req, res) {
    try {
      const { firstName, lastName, phone, birthDate, gender } = req.body;
      const userId = req.session.user.id;
      
      console.log('📝 Update profile request:', {
        userId,
        firstName,
        lastName,
        phone,
        birthDate,
        gender
      });
      
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy tài khoản'
        });
      }
      
      // Validation
      const errors = [];
      
      if (!firstName || firstName.trim().length < 2) {
        errors.push('Họ phải có ít nhất 2 ký tự');
      }
      
      if (!lastName || lastName.trim().length < 2) {
        errors.push('Tên phải có ít nhất 2 ký tự');
      }
      
      if (phone && !/^[0-9]{10,11}$/.test(phone.replace(/[\s\-\(\)]/g, ''))) {
        errors.push('Số điện thoại không hợp lệ');
      }
      
      if (birthDate && new Date(birthDate) > new Date()) {
        errors.push('Ngày sinh không hợp lệ');
      }
      
      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: errors.join('; ')
        });
      }
      
      // Update user info
      user.firstName = firstName?.trim() || user.firstName;
      user.lastName = lastName?.trim() || user.lastName;
      user.phone = phone ? phone.replace(/[\s\-\(\)]/g, '') : user.phone;
      user.birthDate = birthDate || user.birthDate;
      user.gender = gender || user.gender;
      
      await user.save();
      
      // Update session
      req.session.user.firstName = user.firstName;
      req.session.user.lastName = user.lastName;
      req.session.user.fullName = user.fullName;
      req.session.user.initials = user.initials;
      
      console.log('✅ Profile updated successfully:', {
        userId: user._id,
        fullName: user.fullName,
        phone: user.phone
      });
      
      res.json({
        success: true,
        message: 'Cập nhật thông tin thành công!',
        data: {
          fullName: user.fullName,
          initials: user.initials,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          birthDate: user.birthDate,
          gender: user.gender
        }
      });
      
    } catch (error) {
      console.error('Update Profile Error:', error);
      res.status(500).json({
        success: false,
        message: 'Có lỗi xảy ra khi cập nhật thông tin'
      });
    }
  }

  /**
   * Trang danh sách địa chỉ
   * GET /user/addresses
   */
  static async showAddresses(req, res) {
    try {
      const userId = req.session.user.id;
      const user = await User.findById(userId);
      
      if (!user) {
        req.flash('error', 'Không tìm thấy thông tin tài khoản');
        return res.redirect('/auth/login');
      }
      
      res.render('user/addresses', {
        title: 'Địa chỉ giao hàng - SportShop',
        currentPage: 'addresses',
        user: user,
        addresses: user.addresses,
        success: req.flash('success'),
        error: req.flash('error')
      });
      
    } catch (error) {
      console.error('User ShowAddresses Error:', error);
      res.status(500).render('error', {
        title: 'Lỗi - SportShop',
        error: 'Không thể tải danh sách địa chỉ'
      });
    }
  }

  /**
   * Thêm địa chỉ mới
   * POST /user/addresses
   */
  static async addAddress(req, res) {
    try {
      const { type, fullName, phone, address, district, city, zipCode, isDefault } = req.body;
      const userId = req.session.user.id;
      
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy tài khoản'
        });
      }
      
      // Validation
      if (!fullName || !phone || !address || !district) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng điền đầy đủ thông tin bắt buộc'
        });
      }
      
      const addressData = {
        type: type || 'home',
        fullName: fullName.trim(),
        phone: phone.replace(/[\s\-\(\)]/g, ''),
        address: address.trim(),
        district: district,
        city: city || 'Hà Nội',
        zipCode: zipCode || '',
        isDefault: !!isDefault
      };
      
      await user.addAddress(addressData);
      
      console.log('✅ Address added:', {
        userId: user._id,
        addressCount: user.addresses.length
      });
      
      res.json({
        success: true,
        message: 'Thêm địa chỉ thành công!',
        data: {
          addressCount: user.addresses.length
        }
      });
      
    } catch (error) {
      console.error('Add Address Error:', error);
      res.status(500).json({
        success: false,
        message: 'Có lỗi xảy ra khi thêm địa chỉ'
      });
    }
  }

  /**
   * Cập nhật địa chỉ
   * PUT /user/addresses/:addressId
   */
  static async updateAddress(req, res) {
    try {
      const { addressId } = req.params;
      const { type, fullName, phone, address, district, city, zipCode, isDefault } = req.body;
      const userId = req.session.user.id;
      
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy tài khoản'
        });
      }
      
      const updateData = {
        type: type || 'home',
        fullName: fullName?.trim(),
        phone: phone?.replace(/[\s\-\(\)]/g, ''),
        address: address?.trim(),
        district: district,
        city: city || 'Hà Nội',
        zipCode: zipCode || '',
        isDefault: !!isDefault
      };
      
      const result = await user.updateAddress(addressId, updateData);
      if (!result) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy địa chỉ'
        });
      }
      
      console.log('✅ Address updated:', {
        userId: user._id,
        addressId: addressId
      });
      
      res.json({
        success: true,
        message: 'Cập nhật địa chỉ thành công!'
      });
      
    } catch (error) {
      console.error('Update Address Error:', error);
      res.status(500).json({
        success: false,
        message: 'Có lỗi xảy ra khi cập nhật địa chỉ'
      });
    }
  }

  /**
   * Xóa địa chỉ
   * DELETE /user/addresses/:addressId
   */
  static async deleteAddress(req, res) {
    try {
      const { addressId } = req.params;
      const userId = req.session.user.id;
      
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy tài khoản'
        });
      }
      
      const result = await user.removeAddress(addressId);
      if (!result) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy địa chỉ'
        });
      }
      
      console.log('✅ Address deleted:', {
        userId: user._id,
        addressId: addressId,
        remainingAddresses: user.addresses.length
      });
      
      res.json({
        success: true,
        message: 'Xóa địa chỉ thành công!',
        data: {
          addressCount: user.addresses.length
        }
      });
      
    } catch (error) {
      console.error('Delete Address Error:', error);
      res.status(500).json({
        success: false,
        message: 'Có lỗi xảy ra khi xóa địa chỉ'
      });
    }
  }

  /**
   * Trang sản phẩm yêu thích
   * GET /user/favorites
   */
  static async showFavorites(req, res) {
    try {
      const userId = req.session.user.id;
      const user = await User.findById(userId).populate('favoriteProducts');
      
      if (!user) {
        req.flash('error', 'Không tìm thấy thông tin tài khoản');
        return res.redirect('/auth/login');
      }
      
      res.render('user/favorites', {
        title: 'Sản phẩm yêu thích - SportShop',
        currentPage: 'favorites',
        user: user,
        favoriteProducts: user.favoriteProducts,
        success: req.flash('success'),
        error: req.flash('error')
      });
      
    } catch (error) {
      console.error('User ShowFavorites Error:', error);
      res.status(500).render('error', {
        title: 'Lỗi - SportShop',
        error: 'Không thể tải danh sách yêu thích'
      });
    }
  }

  /**
   * Thêm/Xóa sản phẩm yêu thích
   * POST /user/favorites/:productId
   */
  static async toggleFavorite(req, res) {
    try {
      const { productId } = req.params;
      const userId = req.session.user.id;
      
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy tài khoản'
        });
      }
      
      // Check if product exists
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy sản phẩm'
        });
      }
      
      const favoriteIndex = user.favoriteProducts.indexOf(productId);
      let action = '';
      
      if (favoriteIndex > -1) {
        // Remove from favorites
        user.favoriteProducts.splice(favoriteIndex, 1);
        action = 'removed';
      } else {
        // Add to favorites
        user.favoriteProducts.push(productId);
        action = 'added';
      }
      
      await user.save();
      
      console.log('❤️ Favorite toggled:', {
        userId: user._id,
        productId: productId,
        productName: product.name,
        action: action,
        totalFavorites: user.favoriteProducts.length
      });
      
      res.json({
        success: true,
        message: action === 'added' ? 
          `Đã thêm ${product.name} vào danh sách yêu thích` : 
          `Đã xóa ${product.name} khỏi danh sách yêu thích`,
        data: {
          isFavorite: action === 'added',
          favoriteCount: user.favoriteProducts.length
        }
      });
      
    } catch (error) {
      console.error('Toggle Favorite Error:', error);
      res.status(500).json({
        success: false,
        message: 'Có lỗi xảy ra khi cập nhật danh sách yêu thích'
      });
    }
  }

  /**
   * Thay đổi mật khẩu
   * POST /user/change-password
   */
  static async changePassword(req, res) {
    try {
      const { currentPassword, newPassword, confirmPassword } = req.body;
      const userId = req.session.user.id;
      
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy tài khoản'
        });
      }
      
      // Validation
      if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng điền đầy đủ thông tin'
        });
      }
      
      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Mật khẩu mới phải có ít nhất 6 ký tự'
        });
      }
      
      if (newPassword !== confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'Mật khẩu xác nhận không khớp'
        });
      }
      
      // Verify current password
      const isCurrentPasswordValid = await user.comparePassword(currentPassword);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          message: 'Mật khẩu hiện tại không đúng'
        });
      }
      
      // Update password
      user.password = newPassword;
      await user.save();
      
      console.log('🔒 Password changed:', {
        userId: user._id,
        email: user.email
      });
      
      res.json({
        success: true,
        message: 'Thay đổi mật khẩu thành công!'
      });
      
    } catch (error) {
      console.error('Change Password Error:', error);
      res.status(500).json({
        success: false,
        message: 'Có lỗi xảy ra khi thay đổi mật khẩu'
      });
    }
  }

  /**
   * API: Lấy thông tin tài khoản
   * GET /user/api/profile
   */
  static async getProfileAPI(req, res) {
    try {
      const userId = req.session.user.id;
      const user = await User.findById(userId).select('-password -emailVerificationToken -passwordResetToken');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy tài khoản'
        });
      }
      
      res.json({
        success: true,
        data: user.toPublicJSON()
      });
      
    } catch (error) {
      console.error('Get Profile API Error:', error);
      res.status(500).json({
        success: false,
        message: 'Có lỗi xảy ra khi lấy thông tin tài khoản'
      });
    }
  }
}

module.exports = UserController;