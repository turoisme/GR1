require('dotenv').config();
const express = require('express');
const path = require('path');
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

// Connect to MongoDB
connectDB();

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration with MongoDB store
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
  resave: false,
  saveUninitialized: true, // Changed to true to ensure session is created
  name: 'sportshop.sid', // Custom session name
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    touchAfter: 24 * 3600, // lazy session update
    ttl: 7 * 24 * 60 * 60 // 7 days
  }),
  cookie: {
    secure: false, // Set to false for development (HTTP)
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: 'lax' // Add sameSite policy
  }
}));

// Custom middleware to make cart available in all views
app.use(async (req, res, next) => {
  try {
    const Cart = require('./models/Cart');
    
    // Ensure session exists and has ID
    if (!req.session.id || !req.sessionID) {
      console.log('⚠️  No session ID, regenerating session');
      req.session.regenerate((err) => {
        if (err) console.error('Session regeneration error:', err);
      });
    }
    
    // Use sessionID (more reliable than session.id)
    const sessionId = req.sessionID || req.session.id;
    console.log('🔑 Using session ID:', sessionId);
    
    // Find or create cart for session
    const cart = await Cart.findBySessionId(sessionId);
    
    res.locals.cartItemCount = cart ? cart.totalItems : 0;
    res.locals.cart = cart;
    
    next();
  } catch (error) {
    console.error('Cart middleware error:', error);
    res.locals.cartItemCount = 0;
    res.locals.cart = null;
    next();
  }
});

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/products', productRoutes);
app.use('/cart', cartRoutes);
app.use('/', homeRoutes);

// 404 Error Handler
app.use((req, res) => {
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

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('🚀 SportShop server đang chạy:');
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`📂 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🕐 Started at: ${new Date().toLocaleString('vi-VN')}`);
  
  // Cleanup expired carts every hour
  setInterval(async () => {
    try {
      const Cart = require('./models/Cart');
      await Cart.cleanupExpiredCarts();
    } catch (error) {
      console.error('Cart cleanup error:', error);
    }
  }, 60 * 60 * 1000); // Every hour
});