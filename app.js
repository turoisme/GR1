require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo');

// Import database connection
const connectDB = require('./config/database');

// Import routes
const homeRoutes = require('./routes/home');
const productRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');

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

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Static files serving
app.use(express.static(path.join(__dirname, 'public')));

// 🖼️ STATIC FILE SERVING FOR DATA FOLDER
// Serve images from data/images as /assets
app.use('/assets', express.static(path.join(__dirname, 'data/images'), {
  maxAge: '1d', // Cache for 1 day
  etag: true,
  lastModified: true
}));

// Serve uploads from data/uploads as /uploads
app.use('/uploads', express.static(path.join(__dirname, 'data/uploads'), {
  maxAge: '1h', // Cache for 1 hour (uploads change more frequently)
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

// Session configuration with MongoDB store
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
  resave: false,
  saveUninitialized: true,
  name: 'sportshop.sid',
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    touchAfter: 24 * 3600,
    ttl: 7 * 24 * 60 * 60
  }),
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  }
}));

// Custom middleware to make cart available in all views with fallback
app.use(async (req, res, next) => {
  try {
    // Ensure session exists and has ID
    if (!req.session.id || !req.sessionID) {
      console.log('⚠️  No session ID, regenerating session');
      req.session.regenerate((err) => {
        if (err) console.error('Session regeneration error:', err);
      });
    }
    
    // Use sessionID (more reliable than session.id)
    const sessionId = req.sessionID || req.session.id;
    
    // Try to find cart with timeout
    const Cart = require('./models/Cart');
    let cart = null;
    
    try {
      // Set a shorter timeout for cart operations
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Cart timeout')), 3000); // 3s timeout
      });
      
      const cartPromise = Cart.findBySessionId(sessionId);
      cart = await Promise.race([cartPromise, timeoutPromise]);
      
    } catch (cartError) {
      console.log('⚠️  Cart operation failed, using fallback:', cartError.message);
      
      // Fallback: create empty cart object
      cart = {
        sessionId: sessionId,
        items: [],
        totalItems: 0,
        totalPrice: 0,
        shippingFee: 0,
        finalTotal: 0,
        isEmpty: () => true,
        getFormattedTotal: () => '0đ',
        getFormattedFinalTotal: () => '0đ'
      };
    }
    
    res.locals.cartItemCount = cart ? cart.totalItems : 0;
    res.locals.cart = cart;
    
    next();
    
  } catch (error) {
    console.error('Cart middleware error:', error.message);
    
    // Fallback for any error
    res.locals.cartItemCount = 0;
    res.locals.cart = {
      items: [],
      totalItems: 0,
      isEmpty: () => true
    };
    next();
  }
});

// Request logging middleware
app.use((req, res, next) => {
  // Only log non-asset requests to reduce noise
  if (!req.path.startsWith('/assets') && !req.path.startsWith('/css') && !req.path.startsWith('/js')) {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  }
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  const dataStats = {
    productsImages: fs.readdirSync(path.join(__dirname, 'data/images/products')).length,
    qrCodes: fs.readdirSync(path.join(__dirname, 'data/images/qr-codes')).length,
    banners: fs.readdirSync(path.join(__dirname, 'data/images/banners')).length,
    uploads: fs.readdirSync(path.join(__dirname, 'data/uploads')).length
  };
  
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development',
    dataFolder: dataStats
  });
});

// 🖼️ API ENDPOINT: Get available images
app.get('/api/images', (req, res) => {
  try {
    const { category = 'products' } = req.query;
    const validCategories = ['products', 'qr-codes', 'banners', 'icons'];
    
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category'
      });
    }
    
    const imagesDir = path.join(__dirname, 'data/images', category);
    const files = fs.readdirSync(imagesDir)
      .filter(file => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file))
      .map(file => ({
        name: file,
        url: `/assets/${category}/${file}`,
        size: fs.statSync(path.join(imagesDir, file)).size,
        modified: fs.statSync(path.join(imagesDir, file)).mtime
      }));
    
    res.json({
      success: true,
      category: category,
      images: files,
      count: files.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error reading images directory',
      error: error.message
    });
  }
});

// Routes
app.use('/products', productRoutes);
app.use('/cart', cartRoutes);
app.use('/', homeRoutes);

// 404 Error Handler
app.use((req, res) => {
  // Check if it's a missing asset
  if (req.path.startsWith('/assets/')) {
    console.log(`❌ Missing asset: ${req.path}`);
    return res.status(404).json({
      error: 'Asset not found',
      path: req.path,
      suggestion: 'Check if the file exists in data/images/ folder'
    });
  }
  
  res.status(404).render('404', { 
    title: 'Trang không tìm thấy - SportShop',
    currentPage: '404'
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Global Error:', err);
  
  if (res.headersSent) {
    return next(err);
  }
  
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Đã xảy ra lỗi server' 
    : err.message;
    
  res.status(statusCode).render('error', {
    title: `Lỗi ${statusCode} - SportShop`,
    error: message,
    statusCode: statusCode
  });
});

// Start server with improved error handling
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  console.log('🚀 SportShop server đang chạy:');
  console.log(`📍 Local: http://localhost:${PORT}`);
  console.log(`📍 Network: http://127.0.0.1:${PORT}`);
  console.log(`📂 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🕐 Started at: ${new Date().toLocaleString('vi-VN')}`);
  console.log(`💾 Session Store: MongoDB`);
  console.log(`🗄️  Database: Connected`);
  console.log(`📁 Static Assets: /assets -> data/images/`);
  console.log(`📤 Upload Folder: /uploads -> data/uploads/`);
  
  // Cleanup expired carts every hour
  setInterval(async () => {
    try {
      const Cart = require('./models/Cart');
      await Cart.cleanupExpiredCarts();
    } catch (error) {
      console.error('Cart cleanup error:', error);
    }
  }, 60 * 60 * 1000);
});

// Server error handling
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} đã được sử dụng!`);
    console.log('💡 Thử các giải pháp sau:');
    console.log('1. Chạy: PORT=3001 npm run dev');
    console.log('2. Hoặc tìm và tắt process đang dùng port 3000');
  } else if (err.code === 'EACCES') {
    console.error(`❌ Không có quyền truy cập port ${PORT}`);
    console.log('💡 Thử port khác: PORT=8080 npm run dev');
  } else {
    console.error('❌ Server error:', err);
  }
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('💤 Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('\n🛑 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('💤 Process terminated');
    process.exit(0);
  });
});