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