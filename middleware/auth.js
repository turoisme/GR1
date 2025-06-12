// middleware/auth.js

/**
 * Middleware yêu cầu người dùng đăng nhập
 * Dùng cho các trang/API cần authentication
 */
const requireAuth = (req, res, next) => {
  console.log('🔐 Auth check:', {
    path: req.path,
    method: req.method,
    hasSession: !!req.session,
    hasUser: !!req.session?.user,
    sessionId: req.sessionID
  });
  
  if (req.session && req.session.user) {
    // User is authenticated
    return next();
  }
  
  // Store the original URL to redirect after login
  if (req.method === 'GET' && !req.xhr && !req.path.startsWith('/api/')) {
    req.session.returnTo = req.originalUrl;
    console.log('💾 Stored return URL:', req.originalUrl);
  }
  
  // Handle AJAX/API requests
  if (req.xhr || req.headers.accept?.includes('json') || req.path.startsWith('/api/')) {
    return res.status(401).json({
      success: false,
      message: 'Vui lòng đăng nhập để tiếp tục',
      redirectTo: '/auth/login'
    });
  }
  
  // Redirect to login page
  req.flash('error', 'Vui lòng đăng nhập để tiếp tục');
  res.redirect('/auth/login');
};

/**
 * Middleware chỉ cho phép khách (chưa đăng nhập)
 * Dùng cho trang login, register
 */
const requireGuest = (req, res, next) => {
  console.log('👤 Guest check:', {
    path: req.path,
    hasUser: !!req.session?.user
  });
  
  if (req.session && req.session.user) {
    // User is already logged in, redirect to account
    if (req.xhr || req.headers.accept?.includes('json')) {
      return res.json({
        success: false,
        message: 'Bạn đã đăng nhập',
        redirectTo: '/user/account'
      });
    }
    
    return res.redirect('/user/account');
  }
  
  next();
};

/**
 * Middleware yêu cầu quyền admin
 * Dùng cho trang quản trị
 */
const requireAdmin = (req, res, next) => {
  console.log('⚡ Admin check:', {
    path: req.path,
    hasUser: !!req.session?.user,
    userRole: req.session?.user?.role
  });
  
  // Check if user is logged in
  if (!req.session || !req.session.user) {
    req.session.returnTo = req.originalUrl;
    
    if (req.xhr || req.headers.accept?.includes('json')) {
      return res.status(401).json({
        success: false,
        message: 'Vui lòng đăng nhập để tiếp tục',
        redirectTo: '/auth/login'
      });
    }
    
    req.flash('error', 'Vui lòng đăng nhập để truy cập trang quản trị');
    return res.redirect('/auth/login');
  }
  
  // Check if user has admin role
  if (req.session.user.role !== 'admin') {
    if (req.xhr || req.headers.accept?.includes('json')) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền truy cập trang này'
      });
    }
    
    return res.status(403).render('error', {
      title: 'Không có quyền truy cập - SportShop',
      error: 'Bạn không có quyền truy cập trang quản trị. Chỉ admin mới có thể truy cập.',
      currentPage: 'error'
    });
  }
  
  next();
};

/**
 * Middleware tùy chọn cho auth
 * Không bắt buộc đăng nhập nhưng sẽ load thông tin user nếu có
 */
const optionalAuth = (req, res, next) => {
  // User info will be available in res.locals.user via the global middleware
  next();
};

/**
 * Middleware kiểm tra tài khoản bị khóa
 */
const checkAccountStatus = async (req, res, next) => {
  if (!req.session?.user) {
    return next();
  }
  
  try {
    const User = require('../models/User');
    const user = await User.findById(req.session.user.id);
    
    if (!user) {
      // User not found, clear session
      req.session.destroy();
      
      if (req.xhr || req.headers.accept?.includes('json')) {
        return res.status(401).json({
          success: false,
          message: 'Tài khoản không tồn tại',
          redirectTo: '/auth/login'
        });
      }
      
      req.flash('error', 'Tài khoản không tồn tại');
      return res.redirect('/auth/login');
    }
    
    if (!user.isActive) {
      // Account deactivated, clear session
      req.session.destroy();
      
      if (req.xhr || req.headers.accept?.includes('json')) {
        return res.status(403).json({
          success: false,
          message: 'Tài khoản đã bị vô hiệu hóa'
        });
      }
      
      req.flash('error', 'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ hỗ trợ.');
      return res.redirect('/auth/login');
    }
    
    if (user.isLocked()) {
      // Account locked, clear session
      req.session.destroy();
      
      const lockTime = Math.ceil((user.lockUntil - Date.now()) / (1000 * 60));
      
      if (req.xhr || req.headers.accept?.includes('json')) {
        return res.status(423).json({
          success: false,
          message: `Tài khoản bị khóa tạm thời. Thử lại sau ${lockTime} phút.`
        });
      }
      
      req.flash('error', `Tài khoản bị khóa tạm thời do đăng nhập sai quá nhiều lần. Thử lại sau ${lockTime} phút.`);
      return res.redirect('/auth/login');
    }
    
    next();
    
  } catch (error) {
    console.error('Check Account Status Error:', error);
    next(); // Continue without blocking
  }
};

/**
 * Middleware rate limiting cho login
 */
const loginRateLimit = (() => {
  const attempts = new Map(); // IP -> { count, lastAttempt }
  const MAX_ATTEMPTS = 5;
  const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
  
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    const attemptData = attempts.get(ip);
    
    if (attemptData) {
      // Reset counter if window expired
      if (now - attemptData.lastAttempt > WINDOW_MS) {
        attempts.delete(ip);
      } else if (attemptData.count >= MAX_ATTEMPTS) {
        const remainingTime = Math.ceil((WINDOW_MS - (now - attemptData.lastAttempt)) / 1000 / 60);
        
        if (req.xhr || req.headers.accept?.includes('json')) {
          return res.status(429).json({
            success: false,
            message: `Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau ${remainingTime} phút.`
          });
        }
        
        req.flash('error', `Quá nhiều lần thử đăng nhập từ IP này. Vui lòng thử lại sau ${remainingTime} phút.`);
        return res.redirect('/auth/login');
      }
    }
    
    next();
  };
})();

/**
 * Middleware ghi nhận lần thử đăng nhập
 */
const recordLoginAttempt = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  
  // Record login attempt (this would be handled by loginRateLimit middleware)
  console.log('🔐 Login attempt from IP:', ip);
  
  next();
};

/**
 * Middleware xác thực API token (cho tương lai)
 */
const requireApiToken = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'API token required'
    });
  }
  
  // TODO: Verify token
  // For now, just pass through
  next();
};

/**
 * Middleware kiểm tra quyền truy cập resource
 */
const checkResourceOwnership = (resourceType) => {
  return async (req, res, next) => {
    if (!req.session?.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const userId = req.session.user.id;
    const resourceId = req.params.id || req.params.resourceId;
    
    try {
      let Model;
      switch (resourceType) {
        case 'cart':
          Model = require('../models/Cart');
          const cart = await Model.findById(resourceId);
          if (!cart || (cart.userId && cart.userId.toString() !== userId)) {
            return res.status(403).json({
              success: false,
              message: 'Access denied'
            });
          }
          break;
          
        case 'order':
          // TODO: Implement when Order model is ready
          break;
          
        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid resource type'
          });
      }
      
      next();
      
    } catch (error) {
      console.error('Check Resource Ownership Error:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking resource ownership'
      });
    }
  };
};

/**
 * Middleware log hoạt động user (cho audit trail)
 */
const logUserActivity = (action) => {
  return (req, res, next) => {
    if (req.session?.user) {
      console.log('👤 User Activity:', {
        userId: req.session.user.id,
        email: req.session.user.email,
        action: action,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });
      
      // TODO: Save to audit log in database
    }
    
    next();
  };
};

/**
 * Middleware tự động gia hạn session
 */
const refreshSession = (req, res, next) => {
  if (req.session?.user) {
    // Update session timestamp
    req.session.touch();
    
    // Update user's last activity if it's been more than 5 minutes
    const now = Date.now();
    const lastUpdate = req.session.lastActivityUpdate || 0;
    
    if (now - lastUpdate > 5 * 60 * 1000) { // 5 minutes
      req.session.lastActivityUpdate = now;
      
      // Async update user's last activity (don't wait)
      const User = require('../models/User');
      User.findByIdAndUpdate(req.session.user.id, {
        lastLogin: new Date()
      }).catch(err => {
        console.error('Error updating user last activity:', err);
      });
    }
  }
  
  next();
};

/**
 * Middleware kiểm tra email đã được xác thực
 */
const requireEmailVerification = (req, res, next) => {
  if (!req.session?.user) {
    return requireAuth(req, res, next);
  }
  
  if (!req.session.user.isVerified) {
    if (req.xhr || req.headers.accept?.includes('json')) {
      return res.status(403).json({
        success: false,
        message: 'Vui lòng xác thực email để tiếp tục',
        redirectTo: '/user/verify-email'
      });
    }
    
    req.flash('error', 'Vui lòng xác thực email để sử dụng tính năng này');
    return res.redirect('/user/verify-email');
  }
  
  next();
};

/**
 * Middleware cập nhật thông tin user trong session từ database
 */
const syncUserSession = async (req, res, next) => {
  if (!req.session?.user) {
    return next();
  }
  
  try {
    const User = require('../models/User');
    const user = await User.findById(req.session.user.id)
      .select('firstName lastName email role isActive isVerified')
      .lean();
    
    if (!user || !user.isActive) {
      req.session.destroy();
      return next();
    }
    
    // Update session with latest user data
    req.session.user = {
      ...req.session.user,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      role: user.role,
      isVerified: user.isVerified,
      initials: `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
    };
    
    next();
    
  } catch (error) {
    console.error('Sync User Session Error:', error);
    next(); // Continue without blocking
  }
};

module.exports = {
  requireAuth,
  requireGuest,
  requireAdmin,
  optionalAuth,
  checkAccountStatus,
  loginRateLimit,
  recordLoginAttempt,
  requireApiToken,
  checkResourceOwnership,
  logUserActivity,
  refreshSession,
  requireEmailVerification,
  syncUserSession
};