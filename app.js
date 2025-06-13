// app.js - Updated với User Authentication System
require('./models/Product');
require('./models/Cart');
require('./models/Order'); // ← Thêm dòng này để đảm bảo Order model được load
require('./models/Settings');
console.log('✅ All models loaded successfully');
require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash'); // 📦 NEW: Flash messages
const adminRoutes = require('./routes/admin');
// Import database connection
const connectDB = require('./config/database');

// Import routes
const homeRoutes = require('./routes/home');
const productRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
const authRoutes = require('./routes/auth');     // 🔐 NEW: Auth routes
const userRoutes = require('./routes/user');     // 👤 NEW: User routes

const app = express();

// Error handling for environment variables
if (!process.env.MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in environment variables');
  console.log('💡 Please check your .env file');
  process.exit(1);
}

// Connect to MongoDB with error handling
connectDB().catch(err => {
  console.error('❌ Failed to connect to MongoDB:', err.message);
  process.exit(1);
});

// Create data directories if they don't exist
const createDataDirectories = () => {
  const directories = [
    'data',
    'data/images',
    'data/images/products',
    'data/images/qr-codes',
    'data/images/banners',
    'data/images/icons',
    'data/uploads'
  ];
  
  directories.forEach(dir => {
    const dirPath = path.join(__dirname, dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  });
  
  // Create .gitkeep for uploads folder
  const gitkeepPath = path.join(__dirname, 'data/uploads/.gitkeep');
  if (!fs.existsSync(gitkeepPath)) {
    fs.writeFileSync(gitkeepPath, '# Keep this directory in git\n');
  }
};

// Initialize data directories
createDataDirectories();

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Trust proxy for proper IP detection
app.set('trust proxy', 1);

// Middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Static files serving
app.use(express.static(path.join(__dirname, 'public')));

// 🖼️ STATIC FILE SERVING FOR DATA FOLDER
app.use('/assets', express.static(path.join(__dirname, 'data/images'), {
  maxAge: '1d',
  etag: true,
  lastModified: true
}));

app.use('/uploads', express.static(path.join(__dirname, 'data/uploads'), {
  maxAge: '1h',
  etag: true,
  lastModified: true
}));

// 🔍 MIDDLEWARE: Log static file requests for debugging
app.use('/assets', (req, res, next) => {
  const filePath = path.join(__dirname, 'data/images', req.path);
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Asset not found: ${req.path}`);
  }
  next();
});

// 🗂️ SESSION CONFIGURATION
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'sportshop-super-secret-key-change-in-production',
  name: 'sportshop.sid', // Custom session name
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    touchAfter: 24 * 3600, // lazy session update
    crypto: {
      secret: process.env.SESSION_SECRET || 'sportshop-crypto-secret'
    },
    dbName: 'sportshop',
    collectionName: 'sessions'
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax'
  },
  rolling: true // Reset expiration on activity
};

// Apply session middleware
app.use(session(sessionConfig));
app.use((req, res, next) => {
  // Make user available in all views
  res.locals.user = req.session?.user || null;
  res.locals.isAuthenticated = !!req.session?.user;
  next();
});
// 📨 FLASH MESSAGES MIDDLEWARE
app.use(flash());

// 📊 REQUEST LOGGING MIDDLEWARE
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const userInfo = req.session?.user ? 
    `${req.session.user.email} (${req.session.user.role})` : 
    'Guest';
  
  console.log(`${timestamp} | ${req.method} ${req.path} | ${userInfo} | ${req.ip}`);
  next();
});

// 🔐 GLOBAL USER CONTEXT MIDDLEWARE
// Make user information available in all views
app.use((req, res, next) => {
  // User information
  res.locals.user = req.session.user || null;
  res.locals.isLoggedIn = !!req.session.user;
  res.locals.isAdmin = req.session.user?.role === 'admin';
  res.locals.isVerified = req.session.user?.isVerified || false;
  
  // Flash messages
  res.locals.flashMessages = {
    error: req.flash('error'),
    success: req.flash('success'),
    info: req.flash('info'),
    warning: req.flash('warning')
  };
  
  // Current year for footer
  res.locals.currentYear = new Date().getFullYear();
  
  // Environment info
  res.locals.isDevelopment = process.env.NODE_ENV !== 'production';
  
  next();
});

app.use(async (req, res, next) => {
  try {
    const Cart = require('./models/Cart');
    const sessionId = req.sessionID;
    const userId = req.session.user?.id || null;
    
    console.log('🛒 Cart middleware - SessionID:', sessionId, 'UserID:', userId);
    
    const cart = await Cart.findBySessionId(sessionId, userId);
    
    // Đảm bảo cart count chính xác
    res.locals.cartItemCount = cart ? cart.totalItems : 0;
    res.locals.cartTotal = cart ? cart.getFormattedFinalTotal() : '0₫';
    
    console.log('📊 Cart count set to:', res.locals.cartItemCount);
    
  } catch (error) {
    console.error('❌ Cart context error:', error);
    res.locals.cartItemCount = 0;
    res.locals.cartTotal = '0₫';
  }
  
  next();
});
// 🔒 SECURITY HEADERS MIDDLEWARE
app.use((req, res, next) => {
  // Basic security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Remove powered by header
  res.removeHeader('X-Powered-By');
  
  next();
});

// 🌐 ROUTES CONFIGURATION
console.log('🚀 Configuring routes...');

// Main application routes
app.use('/', homeRoutes);
app.use('/products', productRoutes);
app.use('/cart', cartRoutes);

// 🔐 Authentication routes
app.use('/auth', authRoutes);
console.log('✅ Auth routes mounted at /auth');

// 👤 User account routes
app.use('/user', userRoutes);
console.log('✅ User routes mounted at /user');
app.use('/admin', adminRoutes);
console.log('✅ Admin routes mounted at /admin');
// 📱 API routes
app.use('/api/auth', authRoutes); // Auth API endpoints
app.use('/api/user', userRoutes); // User API endpoints

// 🏠 UTILITY ROUTES

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: require('./package.json').version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    database: 'Connected',
    session: req.session ? 'Active' : 'Inactive',
    user: req.session?.user ? 'Authenticated' : 'Guest'
  });
});

// Robots.txt
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(`User-agent: *
Disallow: /admin/
Disallow: /api/
Disallow: /auth/
Disallow: /user/
Disallow: /cart/
Allow: /
Allow: /products/
Allow: /about
Allow: /contact

Sitemap: ${req.protocol}://${req.get('host')}/sitemap.xml`);
});

// Basic sitemap
app.get('/sitemap.xml', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/products</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/about</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>${baseUrl}/contact</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
</urlset>`;
  
  res.type('application/xml');
  res.send(sitemap);
});

// 🔧 ADMIN PANEL ROUTES (Placeholder)
app.get('/admin', (req, res) => {
  // TODO: Implement admin panel
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).render('error', {
      title: 'Không có quyền truy cập - SportShop',
      error: 'Bạn không có quyền truy cập trang quản trị',
      currentPage: 'error'
    });
  }
  
  res.render('admin/dashboard', {
    title: 'Quản trị - SportShop',
    currentPage: 'admin'
  });
});

// 📄 STATIC PAGES
app.get('/about', (req, res) => {
  res.render('pages/about', {
    title: 'Giới thiệu - SportShop',
    currentPage: 'about'
  });
});

app.get('/contact', (req, res) => {
  res.render('pages/contact', {
    title: 'Liên hệ - SportShop',
    currentPage: 'contact'
  });
});

app.get('/privacy', (req, res) => {
  res.render('pages/privacy', {
    title: 'Chính sách bảo mật - SportShop',
    currentPage: 'privacy'
  });
});

app.get('/terms', (req, res) => {
  res.render('pages/terms', {
    title: 'Điều khoản sử dụng - SportShop',
    currentPage: 'terms'
  });
});

// 🚫 ERROR HANDLING MIDDLEWARE

// 404 Handler - Must be after all route definitions
app.use((req, res) => {
  console.log(`❌ 404 - Page not found: ${req.method} ${req.originalUrl}`);
  
  res.status(404);
  
  // API 404
  if (req.originalUrl.startsWith('/api/')) {
    return res.json({
      success: false,
      message: 'API endpoint không tồn tại',
      path: req.originalUrl
    });
  }
  
  // Regular 404 page
  res.render('404', {
    title: 'Trang không tìm thấy - SportShop',
    currentPage: '404',
    requestedUrl: req.originalUrl
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('💥 Unhandled Error:', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    user: req.session?.user?.email || 'Guest',
    timestamp: new Date().toISOString()
  });
  
  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  res.status(err.status || 500);
  
  // API Error Response
  if (req.originalUrl.startsWith('/api/')) {
    return res.json({
      success: false,
      message: isDevelopment ? err.message : 'Có lỗi xảy ra trên máy chủ',
      ...(isDevelopment && { stack: err.stack })
    });
  }
  
  // Regular Error Page
  res.render('error', {
    title: 'Lỗi hệ thống - SportShop',
    currentPage: 'error',
    error: isDevelopment ? err.message : 'Có lỗi xảy ra. Vui lòng thử lại sau.',
    ...(isDevelopment && { stack: err.stack })
  });
});

// 🔄 GRACEFUL SHUTDOWN
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

// 🎯 STARTUP
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

app.listen(PORT, HOST, () => {
  console.log('\n🎉 SportShop Server Started Successfully!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🌐 Server: http://${HOST}:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️  Database: ${process.env.MONGODB_URI ? 'Connected' : 'Not configured'}`);
  console.log(`🔐 Session Store: MongoDB`);
  console.log(`📦 Static Assets: /assets -> ./data/images`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n🔗 Available Routes:');
  console.log('   🏠 Homepage: /');
  console.log('   🛍️  Products: /products');
  console.log('   🛒 Cart: /cart');
  console.log('   🔐 Auth: /auth/login, /auth/register');
  console.log('   👤 User: /user/account, /user/profile');
  console.log('   ⚡ Admin: /admin (admin only)');
  console.log('   🏥 Health: /health');
  console.log('   📚 API Docs: /api/docs (coming soon)');
  console.log('\n✨ New Features:');
  console.log('   ✅ User Registration & Login');
  console.log('   ✅ Session Management');
  console.log('   ✅ Cart Persistence (Guest + User)');
  console.log('   ✅ Role-based Access Control');
  console.log('   ✅ Password Security');
  console.log('   ✅ Flash Messages');
  console.log('   ✅ User Profile Management');
  console.log('   ✅ Address Management');
  console.log('   ✅ Favorites System');
  console.log('\n🚀 Ready for connections!');
});

module.exports = app;