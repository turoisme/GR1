// routes/auth.js
const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { requireGuest, loginRateLimit, recordLoginAttempt, logUserActivity } = require('../middleware/auth');

console.log('🔐 Auth routes loaded');

// =====================================
// AUTHENTICATION ROUTES
// =====================================

/**
 * Hiển thị trang đăng nhập
 * GET /auth/login
 */
router.get('/login', 
  requireGuest, 
  logUserActivity('view_login_page'),
  AuthController.showLogin
);

/**
 * Xử lý đăng nhập
 * POST /auth/login
 */
router.post('/login', 
  requireGuest,
  loginRateLimit,
  recordLoginAttempt,
  logUserActivity('login_attempt'),
  AuthController.login
);

/**
 * Hiển thị trang đăng ký
 * GET /auth/register
 */
router.get('/register', 
  requireGuest,
  logUserActivity('view_register_page'),
  AuthController.showRegister
);

/**
 * Xử lý đăng ký
 * POST /auth/register
 */
router.post('/register', 
  requireGuest,
  loginRateLimit, // Also apply rate limit to registration
  logUserActivity('register_attempt'),
  AuthController.register
);

/**
 * Đăng xuất
 * POST /auth/logout
 * GET /auth/logout (for convenience)
 */
router.post('/logout', 
  logUserActivity('logout'),
  AuthController.logout
);

router.get('/logout', 
  logUserActivity('logout'),
  AuthController.logout
);

// =====================================
// PASSWORD RESET ROUTES
// =====================================

/**
 * Hiển thị trang quên mật khẩu
 * GET /auth/forgot-password
 */
router.get('/forgot-password', 
  requireGuest,
  logUserActivity('view_forgot_password'),
  AuthController.showForgotPassword
);

/**
 * Xử lý quên mật khẩu
 * POST /auth/forgot-password
 */
router.post('/forgot-password', 
  requireGuest,
  loginRateLimit,
  logUserActivity('forgot_password_request'),
  AuthController.forgotPassword
);

/**
 * Hiển thị trang đặt lại mật khẩu
 * GET /auth/reset-password/:token
 */
router.get('/reset-password/:token', 
  requireGuest,
  logUserActivity('view_reset_password'),
  async (req, res) => {
    try {
      const { token } = req.params;
      
      if (!token) {
        req.flash('error', 'Token không hợp lệ');
        return res.redirect('/auth/forgot-password');
      }
      
      // TODO: Verify token validity
      
      res.render('auth/reset-password', {
        title: 'Đặt lại mật khẩu - SportShop',
        currentPage: 'reset-password',
        token: token,
        error: req.flash('error'),
        success: req.flash('success')
      });
      
    } catch (error) {
      console.error('Show Reset Password Error:', error);
      req.flash('error', 'Có lỗi xảy ra');
      res.redirect('/auth/forgot-password');
    }
  }
);

/**
 * Xử lý đặt lại mật khẩu
 * POST /auth/reset-password/:token
 */
router.post('/reset-password/:token', 
  requireGuest,
  loginRateLimit,
  logUserActivity('reset_password_attempt'),
  async (req, res) => {
    try {
      const { token } = req.params;
      const { password, confirmPassword } = req.body;
      
      // Validation
      if (!password || password.length < 6) {
        req.flash('error', 'Mật khẩu phải có ít nhất 6 ký tự');
        return res.redirect(`/auth/reset-password/${token}`);
      }
      
      if (password !== confirmPassword) {
        req.flash('error', 'Mật khẩu xác nhận không khớp');
        return res.redirect(`/auth/reset-password/${token}`);
      }
      
      // TODO: Implement password reset logic
      
      req.flash('success', 'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập với mật khẩu mới.');
      res.redirect('/auth/login');
      
    } catch (error) {
      console.error('Reset Password Error:', error);
      req.flash('error', 'Có lỗi xảy ra khi đặt lại mật khẩu');
      res.redirect(`/auth/reset-password/${req.params.token}`);
    }
  }
);

// =====================================
// API ROUTES
// =====================================

/**
 * Kiểm tra trạng thái đăng nhập
 * GET /auth/api/status
 */
router.get('/api/status', AuthController.checkStatus);

/**
 * Đăng nhập nhanh cho development
 * POST /auth/api/quick-login
 */
router.post('/api/quick-login', AuthController.quickLogin);

/**
 * API đăng nhập
 * POST /auth/api/login
 */
router.post('/api/login', 
  requireGuest,
  loginRateLimit,
  recordLoginAttempt,
  async (req, res) => {
    try {
      const { email, password, remember } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email và mật khẩu là bắt buộc'
        });
      }
      
      const User = require('../models/User');
      const user = await User.findByEmail(email);
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Email hoặc mật khẩu không đúng'
        });
      }
      
      if (user.isLocked()) {
        const lockTime = Math.ceil((user.lockUntil - Date.now()) / (1000 * 60));
        return res.status(423).json({
          success: false,
          message: `Tài khoản bị khóa. Thử lại sau ${lockTime} phút.`
        });
      }
      
      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Tài khoản đã bị vô hiệu hóa'
        });
      }
      
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        await user.incLoginAttempts();
        return res.status(401).json({
          success: false,
          message: 'Email hoặc mật khẩu không đúng'
        });
      }
      
      // Reset login attempts
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
      
      if (remember) {
        req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
      }
      
      // Merge carts
      await AuthController.mergeGuestCart(req);
      
      res.json({
        success: true,
        message: 'Đăng nhập thành công',
        data: {
          user: {
            id: user._id,
            email: user.email,
            fullName: user.fullName,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            initials: user.initials
          },
          redirectTo: '/user/account'
        }
      });
      
    } catch (error) {
      console.error('API Login Error:', error);
      res.status(500).json({
        success: false,
        message: 'Có lỗi xảy ra khi đăng nhập'
      });
    }
  }
);

/**
 * API đăng ký
 * POST /auth/api/register
 */
router.post('/api/register', 
  requireGuest,
  loginRateLimit,
  async (req, res) => {
    try {
      const { firstName, lastName, email, password, confirmPassword, phone, agreeTerms } = req.body;
      
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
      
      if (!agreeTerms) {
        errors.push('Bạn phải đồng ý với điều khoản sử dụng');
      }
      
      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: errors.join('; ')
        });
      }
      
      const User = require('../models/User');
      
      // Check existing email
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'Email này đã được sử dụng'
        });
      }
      
      // Create user
      const userData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.toLowerCase().trim(),
        password: password,
        phone: phone ? phone.replace(/[\s\-\(\)]/g, '') : undefined
      };
      
      const user = await User.createUser(userData);
      
      // Auto login
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
      
      // Merge carts
      await AuthController.mergeGuestCart(req);
      
      res.json({
        success: true,
        message: 'Đăng ký thành công',
        data: {
          user: {
            id: user._id,
            email: user.email,
            fullName: user.fullName,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            initials: user.initials
          },
          redirectTo: '/user/account'
        }
      });
      
    } catch (error) {
      console.error('API Register Error:', error);
      
      if (error.code === 11000 && error.keyPattern?.email) {
        return res.status(409).json({
          success: false,
          message: 'Email này đã được sử dụng'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Có lỗi xảy ra khi đăng ký'
      });
    }
  }
);

/**
 * API đăng xuất
 * POST /auth/api/logout
 */
router.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Có lỗi xảy ra khi đăng xuất'
      });
    }
    
    res.clearCookie('connect.sid');
    
    res.json({
      success: true,
      message: 'Đăng xuất thành công',
      data: {
        redirectTo: '/'
      }
    });
  });
});

// =====================================
// SOCIAL LOGIN ROUTES (for future)
// =====================================

/**
 * Google OAuth login
 * GET /auth/google
 */
router.get('/google', (req, res) => {
  // TODO: Implement Google OAuth
  res.status(501).json({
    success: false,
    message: 'Google login chưa được triển khai'
  });
});

/**
 * Facebook OAuth login
 * GET /auth/facebook
 */
router.get('/facebook', (req, res) => {
  // TODO: Implement Facebook OAuth
  res.status(501).json({
    success: false,
    message: 'Facebook login chưa được triển khai'
  });
});

// =====================================
// ERROR HANDLING
// =====================================

// Handle 404 for auth routes
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