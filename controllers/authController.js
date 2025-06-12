// controllers/authController.js
const User = require('../models/User');
const Cart = require('../models/Cart');
const crypto = require('crypto');

class AuthController {
  /**
   * Hiển thị trang đăng nhập
   * GET /auth/login
   */
  static async showLogin(req, res) {
    try {
      // Redirect if already logged in
      if (req.session.user) {
        return res.redirect('/user/account');
      }
      
      res.render('auth/login', {
        title: 'Đăng nhập - SportShop',
        currentPage: 'login',
        error: req.flash('error'),
        success: req.flash('success'),
        returnTo: req.query.returnTo || req.session.returnTo || ''
      });
    } catch (error) {
      console.error('Auth ShowLogin Error:', error);
      res.status(500).render('error', {
        title: 'Lỗi - SportShop',
        error: 'Không thể tải trang đăng nhập',
        currentPage: 'error'
      });
    }
  }

  /**
   * Xử lý đăng nhập
   * POST /auth/login
   */
  static async login(req, res) {
    try {
      const { email, password, remember } = req.body;
      
      console.log('🔐 Login attempt:', { email, remember: !!remember });
      
      // Validation
      if (!email || !password) {
        req.flash('error', 'Vui lòng nhập đầy đủ email và mật khẩu');
        return res.redirect('/auth/login');
      }
      
      // Find user
      const user = await User.findByEmail(email);
      if (!user) {
        req.flash('error', 'Email hoặc mật khẩu không đúng');
        return res.redirect('/auth/login');
      }
      
      // Check if account is locked
      if (user.isLocked()) {
        const lockTime = Math.ceil((user.lockUntil - Date.now()) / (1000 * 60));
        req.flash('error', `Tài khoản đã bị khóa do đăng nhập sai quá nhiều lần. Thử lại sau ${lockTime} phút.`);
        return res.redirect('/auth/login');
      }
      
      // Check if account is active
      if (!user.isActive) {
        req.flash('error', 'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ hỗ trợ.');
        return res.redirect('/auth/login');
      }
      
      // Verify password
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        await user.incLoginAttempts();
        req.flash('error', 'Email hoặc mật khẩu không đúng');
        return res.redirect('/auth/login');
      }
      
      // Reset login attempts on successful login
      if (user.loginAttempts > 0) {
        await user.resetLoginAttempts();
      }
      
      // Update last login
      user.lastLogin = new Date();
      await user.save();
      
      // Create session
      req.session.user = {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        initials: user.initials,
        isVerified: user.isVerified
      };
      
      // Set remember me cookie (30 days)
      if (remember) {
        req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
      }
      
      // Merge guest cart with user cart
      await AuthController.mergeGuestCart(req);
      
      console.log('✅ User logged in successfully:', {
        userId: user._id,
        email: user.email,
        fullName: user.fullName,
        sessionId: req.sessionID
      });
      
      // Redirect to intended page or account
      const redirectTo = req.body.returnTo || req.session.returnTo || '/user/account';
      delete req.session.returnTo;
      
      req.flash('success', `Chào mừng ${user.firstName}! Đăng nhập thành công.`);
      res.redirect(redirectTo);
      
    } catch (error) {
      console.error('Auth Login Error:', error);
      req.flash('error', 'Có lỗi xảy ra khi đăng nhập. Vui lòng thử lại.');
      res.redirect('/auth/login');
    }
  }

  /**
   * Hiển thị trang đăng ký
   * GET /auth/register
   */
  static async showRegister(req, res) {
    try {
      if (req.session.user) {
        return res.redirect('/user/account');
      }
      
      res.render('auth/register', {
        title: 'Đăng ký tài khoản - SportShop',
        currentPage: 'register',
        error: req.flash('error'),
        success: req.flash('success')
      });
    } catch (error) {
      console.error('Auth ShowRegister Error:', error);
      res.status(500).render('error', {
        title: 'Lỗi - SportShop',
        error: 'Không thể tải trang đăng ký',
        currentPage: 'error'
      });
    }
  }

  /**
   * Xử lý đăng ký
   * POST /auth/register
   */
  static async register(req, res) {
    try {
      const { firstName, lastName, email, password, confirmPassword, phone, agreeTerms, birthDate, gender } = req.body;
      
      console.log('📝 Registration attempt:', { email, firstName, lastName });
      
      // Validation
      const errors = [];
      
      if (!firstName || firstName.trim().length < 2) {
        errors.push('Họ phải có ít nhất 2 ký tự');
      }
      
      if (!lastName || lastName.trim().length < 2) {
        errors.push('Tên phải có ít nhất 2 ký tự');
      }
      
      if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        errors.push('Email không hợp lệ');
      }
      
      if (!password || password.length < 6) {
        errors.push('Mật khẩu phải có ít nhất 6 ký tự');
      }
      
      if (password !== confirmPassword) {
        errors.push('Mật khẩu xác nhận không khớp');
      }
      
      if (phone && !/^[0-9]{10,11}$/.test(phone.replace(/[\s\-\(\)]/g, ''))) {
        errors.push('Số điện thoại phải có 10-11 chữ số');
      }
      
      if (!agreeTerms) {
        errors.push('Bạn phải đồng ý với điều khoản sử dụng và chính sách bảo mật');
      }
      
      if (errors.length > 0) {
        req.flash('error', errors.join('; '));
        return res.redirect('/auth/register');
      }
      
      // Check if email already exists
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        req.flash('error', 'Email này đã được sử dụng. Vui lòng chọn email khác hoặc đăng nhập.');
        return res.redirect('/auth/register');
      }
      
      // Create user data
      const userData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.toLowerCase().trim(),
        password: password,
        phone: phone ? phone.replace(/[\s\-\(\)]/g, '') : undefined,
        birthDate: birthDate || undefined,
        gender: gender || 'male'
      };
      
      // Create user
      const user = await User.createUser(userData);
      
      console.log('✅ New user registered:', {
        userId: user._id,
        email: user.email,
        fullName: user.fullName
      });
      
      // Auto login after registration
      req.session.user = {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        initials: user.initials,
        isVerified: user.isVerified
      };
      
      // Merge guest cart with new user account
      await AuthController.mergeGuestCart(req);
      
      req.flash('success', `Chào mừng ${user.firstName}! Tài khoản đã được tạo thành công. Hãy hoàn thiện thông tin cá nhân của bạn.`);
      res.redirect('/user/account');
      
    } catch (error) {
      console.error('Auth Register Error:', error);
      
      if (error.code === 11000 && error.keyPattern?.email) {
        req.flash('error', 'Email này đã được sử dụng. Vui lòng chọn email khác.');
      } else {
        req.flash('error', 'Có lỗi xảy ra khi đăng ký tài khoản. Vui lòng thử lại.');
      }
      
      res.redirect('/auth/register');
    }
  }

  /**
   * Đăng xuất
   * POST /auth/logout
   * GET /auth/logout
   */
  static async logout(req, res) {
    try {
      const userInfo = req.session.user;
      
      console.log('👋 User logout:', {
        userId: userInfo?.id,
        email: userInfo?.email,
        sessionId: req.sessionID
      });
      
      req.session.destroy((err) => {
        if (err) {
          console.error('Session destroy error:', err);
          return res.redirect('/user/account');
        }
        
        res.clearCookie('connect.sid');
        res.clearCookie('sportshop.sid');
        
        res.redirect('/?logout=success');
      });
      
    } catch (error) {
      console.error('Auth Logout Error:', error);
      res.redirect('/');
    }
  }

  /**
   * Hiển thị trang quên mật khẩu
   * GET /auth/forgot-password
   */
  static async showForgotPassword(req, res) {
    try {
      if (req.session.user) {
        return res.redirect('/user/account');
      }
      
      res.render('auth/forgot-password', {
        title: 'Quên mật khẩu - SportShop',
        currentPage: 'forgot-password',
        error: req.flash('error'),
        success: req.flash('success')
      });
    } catch (error) {
      console.error('Auth ShowForgotPassword Error:', error);
      res.status(500).render('error', {
        title: 'Lỗi - SportShop',
        error: 'Không thể tải trang quên mật khẩu'
      });
    }
  }

  /**
   * Xử lý quên mật khẩu
   * POST /auth/forgot-password
   */
  static async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      
      if (!email) {
        req.flash('error', 'Vui lòng nhập email');
        return res.redirect('/auth/forgot-password');
      }
      
      const user = await User.findByEmail(email);
      if (!user) {
        // Don't reveal if email exists or not for security
        req.flash('success', 'Nếu email tồn tại trong hệ thống, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu.');
        return res.redirect('/auth/forgot-password');
      }
      
      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
      user.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      
      await user.save();
      
      // TODO: Send email with reset link
      console.log('🔑 Password reset token generated:', {
        email: user.email,
        token: resetToken,
        expires: user.passwordResetExpires
      });
      
      req.flash('success', 'Chúng tôi đã gửi hướng dẫn đặt lại mật khẩu đến email của bạn. Vui lòng kiểm tra hộp thư.');
      res.redirect('/auth/forgot-password');
      
    } catch (error) {
      console.error('Auth ForgotPassword Error:', error);
      req.flash('error', 'Có lỗi xảy ra. Vui lòng thử lại sau.');
      res.redirect('/auth/forgot-password');
    }
  }

  /**
   * Merge guest cart with user cart after login/register
   */
  static async mergeGuestCart(req) {
    try {
      const sessionId = req.sessionID;
      const userId = req.session.user.id;
      
      console.log('🔄 Merging guest cart:', { sessionId, userId });
      
      // Find guest cart (by sessionId only)
      const guestCart = await Cart.findOne({ 
        sessionId: sessionId, 
        userId: null 
      }).populate('items.product');
      
      if (!guestCart || guestCart.isEmpty()) {
        console.log('📦 No guest cart to merge');
        return;
      }
      
      // Find existing user cart
      let userCart = await Cart.findOne({ userId: userId }).populate('items.product');
      
      if (!userCart) {
        // Convert guest cart to user cart
        guestCart.userId = userId;
        guestCart.sessionId = sessionId; // Keep sessionId for current session
        await guestCart.save();
        
        console.log('✅ Guest cart converted to user cart:', {
          userId: userId,
          items: guestCart.totalItems,
          total: guestCart.getFormattedFinalTotal()
        });
        
        return;
      }
      
      // Merge carts
      let mergedItems = 0;
      
      for (const guestItem of guestCart.items) {
        // Find existing item with same product, color, size
        const existingItemIndex = userCart.items.findIndex(item => 
          item.product._id.toString() === guestItem.product._id.toString() &&
          item.color === guestItem.color &&
          item.size === guestItem.size
        );
        
        if (existingItemIndex >= 0) {
          // Update existing item quantity
          userCart.items[existingItemIndex].quantity += guestItem.quantity;
          userCart.items[existingItemIndex].subtotal = 
            userCart.items[existingItemIndex].quantity * userCart.items[existingItemIndex].priceAtTime;
        } else {
          // Add new item
          userCart.items.push({
            product: guestItem.product._id,
            quantity: guestItem.quantity,
            color: guestItem.color,
            size: guestItem.size,
            priceAtTime: guestItem.priceAtTime,
            subtotal: guestItem.subtotal,
            addedAt: guestItem.addedAt
          });
        }
        
        mergedItems++;
      }
      
      // Update user cart sessionId and totals
      userCart.sessionId = sessionId;
      userCart.calculateTotals();
      await userCart.save();
      
      // Delete guest cart
      await Cart.deleteOne({ _id: guestCart._id });
      
      console.log('✅ Carts merged successfully:', {
        userId: userId,
        mergedItems: mergedItems,
        totalItems: userCart.totalItems,
        total: userCart.getFormattedFinalTotal()
      });
      
    } catch (error) {
      console.error('❌ Error merging carts:', error);
      // Don't throw error - cart merging is not critical
    }
  }

  /**
   * API: Check login status
   * GET /auth/api/status
   */
  static async checkStatus(req, res) {
    try {
      const isLoggedIn = !!req.session.user;
      const user = req.session.user || null;
      
      res.json({
        success: true,
        data: {
          isLoggedIn: isLoggedIn,
          user: user ? {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            initials: user.initials,
            isVerified: user.isVerified
          } : null
        }
      });
      
    } catch (error) {
      console.error('Auth CheckStatus Error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi kiểm tra trạng thái đăng nhập'
      });
    }
  }

  /**
   * API: Quick login for development (remove in production)
   * POST /auth/api/quick-login
   */
  static async quickLogin(req, res) {
    try {
      // Only in development
      if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ success: false, message: 'Not found' });
      }
      
      const { email } = req.body;
      const user = await User.findByEmail(email || 'test@example.com');
      
      if (!user) {
        // Create test user
        const testUser = await User.createUser({
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          password: '123456',
          phone: '0123456789'
        });
        
        req.session.user = {
          id: testUser._id,
          email: testUser.email,
          fullName: testUser.fullName,
          firstName: testUser.firstName,
          lastName: testUser.lastName,
          role: testUser.role,
          initials: testUser.initials,
          isVerified: testUser.isVerified
        };
        
        return res.json({
          success: true,
          message: 'Test user created and logged in',
          data: { user: req.session.user }
        });
      }
      
      req.session.user = {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        initials: user.initials,
        isVerified: user.isVerified
      };
      
      res.json({
        success: true,
        message: 'Quick login successful',
        data: { user: req.session.user }
      });
      
    } catch (error) {
      console.error('Auth QuickLogin Error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi đăng nhập nhanh'
      });
    }
  }
}

module.exports = AuthController;