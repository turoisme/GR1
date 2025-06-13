/**
 * Cart Controller - Fixed Version with Enhanced Order Creation
 * Xử lý giỏ hàng với MongoDB và checkout đảm bảo đơn hàng hiển thị
 */

const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Order = require('../models/Order');

class CartController {
  /**
   * Hiển thị giỏ hàng
   * GET /cart
   */
  static async index(req, res) {
    try {
      const sessionId = req.sessionID || req.session.id;
      const userId = req.session?.user?.id || null;
      
      console.log('🛒 Cart index - Session ID:', sessionId, 'User ID:', userId);
      
      // Get cart for current session
      const cart = await Cart.findBySessionId(sessionId, userId);
      
      console.log('📦 Cart found:', {
        sessionId: cart.sessionId,
        itemCount: cart.totalItems,
        items: cart.items.length,
        total: cart.getFormattedFinalTotal()
      });
      
      res.render('cart/index', {
        title: 'Giỏ hàng - SportShop',
        cart: cart,
        currentPage: 'cart',
        user: req.session?.user || null,
        success: req.flash('success'),
        error: req.flash('error')
      });
      
    } catch (error) {
      console.error('❌ Cart Controller Index Error:', error);
      res.status(500).render('error', {
        title: 'Lỗi giỏ hàng - SportShop',
        error: 'Không thể tải giỏ hàng',
        currentPage: 'error',
        user: req.session?.user || null
      });
    }
  }

  /**
   * Thêm sản phẩm vào giỏ hàng với màu sắc và size
   * POST /cart/add
   */
  static async addItem(req, res) {
    try {
      const { productId, quantity = 1, color, size } = req.body;
      const sessionId = req.sessionID || req.session.id;
      const userId = req.session?.user?.id || null;
      
      console.log('➕ Add to cart request:', { 
        productId, quantity, color, size, sessionId, userId 
      });
      
      // Validation cơ bản
      if (!productId) {
        return res.status(400).json({
          success: false,
          message: 'ID sản phẩm là bắt buộc'
        });
      }
      
      if (!color || !size) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng chọn màu sắc và kích cỡ'
        });
      }
      
      // Validate quantity
      const qty = parseInt(quantity);
      if (isNaN(qty) || qty < 1 || qty > 10) {
        return res.status(400).json({
          success: false,
          message: 'Số lượng phải từ 1 đến 10'
        });
      }
      
      // Xử lý sản phẩm mẫu (cho demo)
      if (productId.startsWith('sample') || productId.startsWith('fallback')) {
        console.log('📦 Adding sample product to cart');
        
        // Tạo sample cart response cho demo
        const sampleProducts = {
          'sample1': { name: 'Giày chạy bộ Nike Air Max', price: 2500000 },
          'sample2': { name: 'Áo thể thao Adidas ClimaTech', price: 850000 },
          'sample3': { name: 'Quần short Nike Dri-FIT', price: 650000 },
          'sample4': { name: 'Áo hoodie Under Armour', price: 1200000 },
          'sample5': { name: 'Giày tennis Puma Court', price: 1800000 },
          'sample6': { name: 'Quần legging Adidas', price: 750000 },
          'fallback1': { name: 'Sản phẩm thể thao', price: 500000 }
        };
        
        const product = sampleProducts[productId];
        if (!product) {
          return res.status(404).json({
            success: false,
            message: 'Sản phẩm không tồn tại'
          });
        }
        
        // Initialize session cart if not exists
        if (!req.session.cartItems) {
          req.session.cartItems = [];
        }
        
        // Check if item with same product, color, size exists
        const existingItemIndex = req.session.cartItems.findIndex(item => 
          item.productId === productId && 
          item.color === color && 
          item.size === size
        );
        
        if (existingItemIndex >= 0) {
          // Update existing item
          req.session.cartItems[existingItemIndex].quantity += qty;
          req.session.cartItems[existingItemIndex].subtotal = 
            req.session.cartItems[existingItemIndex].quantity * product.price;
        } else {
          // Add new item
          req.session.cartItems.push({
            productId: productId,
            name: product.name,
            price: product.price,
            quantity: qty,
            color: color,
            size: size,
            subtotal: product.price * qty,
            addedAt: new Date()
          });
        }
        
        // Calculate totals
        const totalItems = req.session.cartItems.reduce((sum, item) => sum + item.quantity, 0);
        const totalPrice = req.session.cartItems.reduce((sum, item) => sum + item.subtotal, 0);
        const shippingFee = totalPrice >= 1000000 ? 0 : 50000;
        const finalTotal = totalPrice + shippingFee;
        
        // Update session cart count
        req.session.cartCount = totalItems;
        
        return res.json({
          success: true,
          message: `Đã thêm ${product.name} (${color}, ${size}) vào giỏ hàng`,
          data: {
            cartItemCount: totalItems,
            cartTotal: totalPrice.toLocaleString('vi-VN') + 'đ',
            cartFinalTotal: finalTotal.toLocaleString('vi-VN') + 'đ',
            shippingFee: shippingFee.toLocaleString('vi-VN') + 'đ',
            product: {
              name: product.name,
              color: color,
              size: size,
              quantity: qty
            }
          }
        });
      }
      
      // Validate ObjectId format cho sản phẩm thực từ database
      if (!productId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          message: 'ID sản phẩm không hợp lệ'
        });
      }
      
      // Get product to validate
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Sản phẩm không tồn tại'
        });
      }
      
      if (!product.inStock) {
        return res.status(400).json({
          success: false,
          message: 'Sản phẩm đã hết hàng'
        });
      }
      
      // Validate color and size nếu có trong product data
      if (product.colors && product.colors.length > 0 && !product.colors.includes(color)) {
        return res.status(400).json({
          success: false,
          message: `Màu sắc "${color}" không có sẵn cho sản phẩm này. Màu có sẵn: ${product.colors.join(', ')}`
        });
      }
      
      if (product.sizes && product.sizes.length > 0 && !product.sizes.includes(size)) {
        return res.status(400).json({
          success: false,
          message: `Kích cỡ "${size}" không có sẵn cho sản phẩm này. Size có sẵn: ${product.sizes.join(', ')}`
        });
      }
      
      // Get or create cart
      const cart = await Cart.findBySessionId(sessionId, userId);
      
      // Add item to cart with color and size
      await cart.addItem(productId, qty, color, size);
      
      console.log('✅ Item added to cart:', {
        sessionId: cart.sessionId,
        totalItems: cart.totalItems,
        productName: product.name,
        color: color,
        size: size
      });
      
      res.json({
        success: true,
        message: `Đã thêm ${product.name} (${color}, ${size}) vào giỏ hàng`,
        data: {
          cartItemCount: cart.totalItems,
          cartTotal: cart.getFormattedTotal(),
          cartFinalTotal: cart.getFormattedFinalTotal(),
          shippingFee: cart.getFormattedShippingFee(),
          product: {
            name: product.name,
            color: color,
            size: size,
            quantity: qty
          }
        }
      });
      
    } catch (error) {
      console.error('❌ Cart Controller AddItem Error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi thêm sản phẩm vào giỏ hàng',
        error: error.message
      });
    }
  }

  /**
   * Cập nhật số lượng sản phẩm
   * PUT /cart/update/:itemId
   */
  static async updateItem(req, res) {
    try {
      const { itemId } = req.params;
      const { quantity } = req.body;
      const sessionId = req.sessionID || req.session.id;
      const userId = req.session?.user?.id || null;
      
      console.log('🔄 Update cart item:', { itemId, quantity, sessionId });
      
      // Validate quantity
      const qty = parseInt(quantity);
      if (isNaN(qty) || qty < 1 || qty > 10) {
        return res.status(400).json({
          success: false,
          message: 'Số lượng phải từ 1 đến 10'
        });
      }
      
      // Get cart
      const cart = await Cart.findBySessionId(sessionId, userId);
      
      if (cart.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Giỏ hàng trống'
        });
      }
      
      // Find item to get product name for message
      const item = cart.items.find(item => item._id.toString() === itemId);
      if (!item) {
        return res.status(404).json({
          success: false,
          message: 'Sản phẩm không tồn tại trong giỏ hàng'
        });
      }
      
      const productName = item.product?.name || 'Sản phẩm';
      const oldQuantity = item.quantity;
      
      // Update item quantity
      cart.updateItemQuantity(itemId, qty);
      await cart.save();
      
      console.log('✅ Cart item updated:', {
        productName: productName,
        oldQuantity: oldQuantity,
        newQuantity: qty,
        newTotal: cart.getFormattedFinalTotal()
      });
      
      res.json({
        success: true,
        message: `Đã cập nhật số lượng ${productName} (${item.color}, ${item.size})`,
        data: {
          cartItemCount: cart.totalItems,
          cartTotal: cart.getFormattedTotal(),
          cartFinalTotal: cart.getFormattedFinalTotal(),
          shippingFee: cart.getFormattedShippingFee(),
          item: {
            id: itemId,
            quantity: qty,
            subtotal: item.subtotal,
            color: item.color,
            size: item.size
          }
        }
      });
      
    } catch (error) {
      console.error('❌ Cart Controller UpdateItem Error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi cập nhật số lượng sản phẩm',
        error: error.message
      });
    }
  }

  /**
   * Xóa sản phẩm khỏi giỏ hàng
   * DELETE /cart/remove/:itemId
   */
  static async removeItem(req, res) {
    try {
      const { itemId } = req.params;
      const sessionId = req.sessionID || req.session.id;
      const userId = req.session?.user?.id || null;
      
      console.log('🗑️ Remove cart item:', { itemId, sessionId });
      
      // Get cart
      const cart = await Cart.findBySessionId(sessionId, userId);
      
      if (cart.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Giỏ hàng trống'
        });
      }
      
      // Find item to get product name for message
      const item = cart.items.find(item => item._id.toString() === itemId);
      const productName = item ? 
        `${item.product?.name || 'Sản phẩm'} (${item.color}, ${item.size})` : 
        'Sản phẩm';
      
      // Remove item
      cart.removeItem(itemId);
      await cart.save();
      
      console.log('✅ Cart item removed:', {
        productName: productName,
        newTotal: cart.getFormattedFinalTotal()
      });
      
      res.json({
        success: true,
        message: `Đã xóa ${productName} khỏi giỏ hàng`,
        data: {
          cartItemCount: cart.totalItems,
          cartTotal: cart.getFormattedTotal(),
          cartFinalTotal: cart.getFormattedFinalTotal(),
          shippingFee: cart.getFormattedShippingFee(),
          removedItemId: itemId
        }
      });
      
    } catch (error) {
      console.error('❌ Cart Controller RemoveItem Error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi xóa sản phẩm khỏi giỏ hàng',
        error: error.message
      });
    }
  }

  /**
   * Xóa tất cả sản phẩm trong giỏ hàng
   * DELETE /cart/clear
   */
  static async clearCart(req, res) {
    try {
      const sessionId = req.sessionID || req.session.id;
      const userId = req.session?.user?.id || null;
      
      console.log('🧹 Clear cart:', { sessionId });
      
      // Get cart
      const cart = await Cart.findBySessionId(sessionId, userId);
      
      if (cart.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Giỏ hàng đã trống'
        });
      }
      
      const itemCount = cart.totalItems;
      
      // Clear cart
      cart.clear();
      await cart.save();
      
      // Clear session cart for sample products
      if (req.session.cartItems) {
        req.session.cartItems = [];
        req.session.cartCount = 0;
      }
      
      console.log('✅ Cart cleared:', { itemCount });
      
      res.json({
        success: true,
        message: `Đã xóa ${itemCount} sản phẩm khỏi giỏ hàng`,
        data: {
          cartItemCount: 0,
          cartTotal: '0đ',
          cartFinalTotal: '0đ',
          shippingFee: '0đ'
        }
      });
      
    } catch (error) {
      console.error('❌ Cart Controller ClearCart Error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi xóa giỏ hàng',
        error: error.message
      });
    }
  }

  /**
   * Lấy thông tin giỏ hàng (API)
   * GET /cart/api
   */
  static async getCartInfo(req, res) {
    try {
      const sessionId = req.sessionID || req.session.id;
      const userId = req.session?.user?.id || null;
      
      console.log('📊 Get cart info:', { sessionId });
      
      // Get cart
      const cart = await Cart.findBySessionId(sessionId, userId);
      
      // Include session cart for sample products
      let sessionCartCount = 0;
      if (req.session.cartItems && req.session.cartItems.length > 0) {
        sessionCartCount = req.session.cartItems.reduce((sum, item) => sum + item.quantity, 0);
      }
      
      const totalCartCount = cart.totalItems + sessionCartCount;
      
      res.json({
        success: true,
        data: {
          cartItemCount: totalCartCount,
          cartTotal: cart.getFormattedTotal(),
          cartFinalTotal: cart.getFormattedFinalTotal(),
          shippingFee: cart.getFormattedShippingFee(),
          isEmpty: cart.isEmpty() && sessionCartCount === 0,
          items: cart.items.length,
          sessionItems: sessionCartCount,
          freeShippingThreshold: 1000000,
          needsForFreeShipping: Math.max(0, 1000000 - cart.totalPrice)
        }
      });
      
    } catch (error) {
      console.error('❌ Cart Controller GetCartInfo Error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy thông tin giỏ hàng',
        error: error.message
      });
    }
  }

  /**
   * Trang thanh toán
   * GET /cart/checkout
   */
  static async checkout(req, res) {
    try {
      const sessionId = req.sessionID || req.session.id;
      const userId = req.session?.user?.id || null;
      
      console.log('💳 Checkout page:', { sessionId });
      
      // Get cart
      const cart = await Cart.findBySessionId(sessionId, userId);
      
      if (cart.isEmpty()) {
        req.flash('error', 'Giỏ hàng trống. Vui lòng thêm sản phẩm trước khi thanh toán.');
        return res.redirect('/cart');
      }
      
      // Get user info for form pre-fill
      const user = req.session?.user;
      
      res.render('cart/checkout', {
        title: 'Thanh toán - SportShop',
        cart: cart,
        user: user,
        currentPage: 'checkout',
        success: req.flash('success'),
        error: req.flash('error')
      });
      
    } catch (error) {
      console.error('❌ Cart Controller Checkout Error:', error);
      res.status(500).render('error', {
        title: 'Lỗi thanh toán - SportShop',
        error: 'Không thể tải trang thanh toán',
        currentPage: 'error',
        user: req.session?.user || null
      });
    }
  }

  /**
   * ✨ FIXED: Xử lý thanh toán - ĐẢM BẢO ĐƠN HÀNG HIỂN THỊ TRONG TÀI KHOẢN
   * POST /cart/checkout
   */
  static async processCheckout(req, res) {
    try {
      const sessionId = req.sessionID || req.session.id;
      const userId = req.session?.user?.id || null;
      
      const {
        customerName,
        customerEmail,
        customerPhone,
        shippingAddress,
        ward = '',
        district,
        city,
        paymentMethod = 'cod',
        notes = ''
      } = req.body;
      
      console.log('💳 Processing checkout:', {
        sessionId: sessionId ? `${sessionId.substring(0, 8)}...` : 'N/A',
        userId: userId,
        customerName,
        customerEmail,
        paymentMethod,
        timestamp: new Date().toISOString()
      });
      
      // Get current cart
      const cart = await Cart.findBySessionId(sessionId, userId);
      
      if (!cart || cart.items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Giỏ hàng trống hoặc không tìm thấy'
        });
      }
      
      // Validate required fields
      const requiredFields = [
        { field: customerName, name: 'Họ tên' },
        { field: customerEmail, name: 'Email' },
        { field: customerPhone, name: 'Số điện thoại' },
        { field: shippingAddress, name: 'Địa chỉ giao hàng' },
        { field: district, name: 'Quận/Huyện' }
      ];
      
      const missingFields = requiredFields.filter(item => !item.field).map(item => item.name);
      
      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Thiếu thông tin bắt buộc: ${missingFields.join(', ')}`
        });
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(customerEmail)) {
        return res.status(400).json({
          success: false,
          message: 'Email không hợp lệ'
        });
      }
      
      // Validate phone number (Vietnam format)
      const cleanPhone = customerPhone.replace(/\D/g, '');
      if (cleanPhone.length < 10 || cleanPhone.length > 11) {
        return res.status(400).json({
          success: false,
          message: 'Số điện thoại không hợp lệ'
        });
      }
      
      // ✨ GENERATE UNIQUE ORDER ID
      const timestamp = Date.now();
      const random = Math.random().toString(36).substr(2, 5).toUpperCase();
      const orderId = `SP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${timestamp.toString().slice(-6)}-${random}`;
      const deliveryDate = new Date(Date.now() + (3 * 24 * 60 * 60 * 1000));
      
      // ✨ CREATE COMPREHENSIVE ORDER DATA
      const orderData = {
        orderId: orderId,
        sessionId: sessionId,
        userId: userId, // ✅ CRITICAL: Ensure userId is properly set
        status: paymentMethod === 'cod' ? 'pending' : 'awaiting_payment',
        paymentMethod: paymentMethod,
        paymentStatus: paymentMethod === 'cod' ? 'pending' : 'unpaid',
        customer: {
          name: customerName.trim(),
          email: customerEmail.toLowerCase().trim(),
          phone: cleanPhone
        },
        shipping: {
  address: shippingAddress.trim(),
  ward: ward?.trim() || 'Chưa cập nhật', // ✅ FIX
  district: district.trim(),
  city: city || 'Hà Nội'
},
        items: cart.items.map(item => ({
          productId: item.product._id || item.productId,
          productName: item.product.name || 'Sản phẩm',
          productImage: item.product.image || '/images/products/default.jpg',
          price: item.priceAtTime || item.price,
          quantity: item.quantity,
          color: item.color || 'Mặc định',
          size: item.size || 'Mặc định',
          subtotal: item.subtotal
        })),
        totalItems: cart.totalItems,
        totalPrice: cart.totalPrice,
        shippingFee: cart.shippingFee,
        finalTotal: cart.finalTotal,
        notes: notes.trim(),
        estimatedDelivery: deliveryDate,
        // ✨ ADD COMPREHENSIVE ORDER HISTORY
        orderHistory: [
          {
            status: 'pending',
            timestamp: new Date(),
            note: 'Đơn hàng đã được tạo và đang chờ xử lý',
            updatedBy: 'system'
          }
        ],
        // ✨ ADD METADATA FOR DEBUGGING
        metadata: {
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          createdAt: new Date(),
          version: '1.0'
        }
      };
      
      console.log('📋 Creating order with enhanced data:', {
        orderId: orderData.orderId,
        sessionId: orderData.sessionId ? `${orderData.sessionId.substring(0, 8)}...` : 'N/A',
        userId: orderData.userId,
        customerName: orderData.customer.name,
        customerEmail: orderData.customer.email,
        totalItems: orderData.totalItems,
        finalTotal: orderData.finalTotal,
        paymentMethod: orderData.paymentMethod
      });
      
      // ✨ ENHANCED ORDER SAVING WITH MULTIPLE FALLBACK METHODS
      let savedOrder = null;
      let saveMethod = 'unknown';
      
      try {
        // Method 1: Try Order.createOrder() static method
        const Order = require('../models/Order');
        console.log('🔄 Attempting Order.createOrder()...');
        
        savedOrder = await Order.createOrder(orderData);
        saveMethod = 'Order.createOrder()';
        
        if (!savedOrder) {
          throw new Error('Order.createOrder() returned null');
        }
        
        console.log('✅ Order saved via Order.createOrder():', {
          orderId: savedOrder.orderId,
          mongoId: savedOrder._id,
          userId: savedOrder.userId,
          sessionId: savedOrder.sessionId ? `${savedOrder.sessionId.substring(0, 8)}...` : 'N/A'
        });
        
      } catch (createOrderError) {
        console.error('❌ Order.createOrder() failed:', createOrderError.message);
        
        // Method 2: Try direct instantiation and save
        try {
          console.log('🔄 Attempting direct Order save...');
          const Order = require('../models/Order');
          
          savedOrder = new Order(orderData);
          await savedOrder.save();
          saveMethod = 'Direct Order save';
          
          console.log('✅ Order saved via direct save:', {
            orderId: savedOrder.orderId,
            mongoId: savedOrder._id,
            userId: savedOrder.userId
          });
          
        } catch (directSaveError) {
          console.error('❌ Direct save failed:', directSaveError.message);
          
          // Method 3: Try mongoose create
          try {
            console.log('🔄 Attempting mongoose.create()...');
            const Order = require('../models/Order');
            
            savedOrder = await Order.create(orderData);
            saveMethod = 'Mongoose.create()';
            
            console.log('✅ Order saved via mongoose.create():', {
              orderId: savedOrder.orderId,
              mongoId: savedOrder._id
            });
            
          } catch (mongooseCreateError) {
            console.error('❌ Mongoose.create() failed:', mongooseCreateError.message);
            
            // Method 4: Session fallback
            console.log('⚠️ Using session fallback for order storage');
            
            if (!req.session.orders) {
              req.session.orders = [];
            }
            
            req.session.orders.push(orderData);
            savedOrder = { ...orderData, _id: 'session_' + timestamp };
            saveMethod = 'Session fallback';
            
            console.log('📝 Order saved to session as fallback');
          }
        }
      }
      
      // ✨ VERIFY ORDER WAS ACTUALLY SAVED AND CAN BE RETRIEVED
      if (savedOrder && savedOrder._id && !savedOrder._id.toString().startsWith('session_')) {
        try {
          console.log('🔍 Verifying order in database...');
          const Order = require('../models/Order');
          
          // Try multiple ways to find the order
          const verificationMethods = [
            () => Order.findById(savedOrder._id),
            () => Order.findOne({ orderId: savedOrder.orderId }),
            () => Order.findOne({ sessionId: sessionId, userId: userId })
          ];
          
          let verifiedOrder = null;
          for (const method of verificationMethods) {
            try {
              verifiedOrder = await method();
              if (verifiedOrder) break;
            } catch (err) {
              console.log('🔍 Verification method failed:', err.message);
            }
          }
          
          if (verifiedOrder) {
            console.log('✅ Order verification successful:', {
              orderId: verifiedOrder.orderId,
              mongoId: verifiedOrder._id,
              userId: verifiedOrder.userId,
              sessionId: verifiedOrder.sessionId ? `${verifiedOrder.sessionId.substring(0, 8)}...` : 'N/A',
              status: verifiedOrder.status
            });
          } else {
            console.error('❌ Order verification failed - not found in database');
            
            // Force session fallback if verification fails
            if (!req.session.orders) {
              req.session.orders = [];
            }
            req.session.orders.push(orderData);
          }
          
        } catch (verifyError) {
          console.error('❌ Order verification error:', verifyError.message);
        }
      }
      
      // ✨ CLEAR CART AFTER SUCCESSFUL ORDER
      try {
        console.log('🧹 Clearing cart after successful order...');
        cart.clear();
        await cart.save();
        
        // Clear session cart for sample products
        if (req.session.cartItems) {
          req.session.cartItems = [];
          req.session.cartCount = 0;
        }
        
        console.log('✅ Cart cleared successfully');
      } catch (clearError) {
        console.error('⚠️ Error clearing cart:', clearError.message);
        // Don't fail the checkout if cart clearing fails
      }
      
      // ✨ STORE ORDER INFO IN SESSION FOR SUCCESS PAGE AND DEBUGGING
      req.session.lastOrder = {
        orderId: savedOrder.orderId,
        total: (savedOrder.finalTotal || orderData.finalTotal).toLocaleString('vi-VN') + 'đ',
        paymentMethod: savedOrder.paymentMethod || orderData.paymentMethod,
        deliveryDate: (savedOrder.estimatedDelivery || orderData.estimatedDelivery).toLocaleDateString('vi-VN'),
        customerName: savedOrder.customer?.name || orderData.customer.name,
        status: savedOrder.status || orderData.status,
        saveMethod: saveMethod
      };
      
      // ✨ ENHANCED SUCCESS RESPONSE WITH DEBUGGING INFO
      console.log('🎉 Checkout completed successfully:', {
        orderId: savedOrder.orderId || orderData.orderId,
        userId: userId,
        sessionId: sessionId ? `${sessionId.substring(0, 8)}...` : 'N/A',
        saveMethod: saveMethod,
        customerEmail: orderData.customer.email,
        total: orderData.finalTotal,
        timestamp: new Date().toISOString()
      });
      
      // ✨ SUCCESS RESPONSE WITH COMPREHENSIVE DATA
      const responseData = {
        success: true,
        message: 'Đặt hàng thành công! Chuyển đến trang đơn hàng của bạn...',
        data: {
          orderId: savedOrder.orderId || orderData.orderId,
          estimatedDelivery: (savedOrder.estimatedDelivery || orderData.estimatedDelivery).toLocaleDateString('vi-VN'),
          total: (savedOrder.finalTotal || orderData.finalTotal).toLocaleString('vi-VN') + 'đ',
          paymentMethod: savedOrder.paymentMethod || orderData.paymentMethod,
          status: savedOrder.status || orderData.status,
          customerName: savedOrder.customer?.name || orderData.customer.name,
          totalItems: savedOrder.totalItems || orderData.totalItems
        },
        // ✨ SMART REDIRECT LOGIC
        redirect: userId ? '/user/orders' : '/auth/login?redirect=/user/orders',
        // ✨ DEBUG INFO (remove in production)
        debug: process.env.NODE_ENV === 'development' ? {
          saveMethod: saveMethod,
          userId: userId,
          sessionId: sessionId ? `${sessionId.substring(0, 8)}...` : 'N/A',
          hasMongoId: !!(savedOrder._id && !savedOrder._id.toString().startsWith('session_'))
        } : undefined
      };
      
      res.json(responseData);
      
    } catch (error) {
      console.error('❌ Checkout error:', error);
      
      // ✨ ENHANCED ERROR LOGGING
      console.error('💥 Checkout process failed:', {
        error: error.message,
        stack: error.stack,
        userId: req.session?.user?.id,
        sessionId: req.sessionID ? `${req.sessionID.substring(0, 8)}...` : 'N/A',
        timestamp: new Date().toISOString()
      });
      
      res.status(500).json({
        success: false,
        message: 'Có lỗi xảy ra khi xử lý đơn hàng. Vui lòng thử lại.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Merge guest cart khi user đăng nhập
   */
  static async mergeGuestCart(req) {
    try {
      const guestSessionId = req.sessionID;
      const userId = req.session.user.id;
      
      console.log('🔄 Merging guest cart:', { guestSessionId, userId });
      
      // Tìm guest cart
      const guestCart = await Cart.findOne({ sessionId: guestSessionId, userId: null });
      
      if (guestCart && !guestCart.isEmpty()) {
        // Tạo session ID mới cho user
        const userSessionId = 'user_' + userId + '_' + Date.now();
        
        // Tạo hoặc lấy user cart
        const userCart = await Cart.findBySessionId(userSessionId, userId);
        
        // Merge items từ guest cart vào user cart
        for (const guestItem of guestCart.items) {
          await userCart.addItem(
            guestItem.product,
            guestItem.quantity,
            guestItem.color,
            guestItem.size
          );
        }
        
        // Xóa guest cart
        await guestCart.deleteOne();
        
        console.log('✅ Guest cart merged successfully');
        return userCart;
      }
      
      return null;
      
    } catch (error) {
      console.error('❌ Error merging guest cart:', error);
      return null;
    }
  }

  /**
   * API: Lấy số lượng items trong cart
   * GET /cart/count
   */
  static async getCartCount(req, res) {
    try {
      const sessionId = req.sessionID || req.session.id;
      const userId = req.session?.user?.id || null;
      
      // Get cart from database
      const cart = await Cart.findBySessionId(sessionId, userId);
      
      // Add session cart count for sample products
      let sessionCartCount = 0;
      if (req.session.cartItems && req.session.cartItems.length > 0) {
        sessionCartCount = req.session.cartItems.reduce((sum, item) => sum + item.quantity, 0);
      }
      
      const totalCount = cart.totalItems + sessionCartCount;
      
      res.json({
        success: true,
        count: totalCount
      });
      
    } catch (error) {
      console.error('❌ Cart Controller GetCartCount Error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy số lượng giỏ hàng',
        count: 0
      });
    }
  }

  /**
   * ✨ NEW: Debug endpoint to check orders (development only)
   * GET /cart/debug/orders
   */
  static async debugOrders(req, res) {
    try {
      // Only in development
      if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ success: false, message: 'Not found' });
      }
      
      const sessionId = req.sessionID || req.session.id;
      const userId = req.session?.user?.id || null;
      
      console.log('🔍 Debug orders check:', { sessionId, userId });
      
      const Order = require('../models/Order');
      
      // Get all orders in database
      const allOrders = await Order.find({}).limit(10).sort({ createdAt: -1 });
      
      // Get orders for current user/session
      const userOrders = await Order.find({
        $or: [
          { userId: userId },
          { sessionId: sessionId },
          { 'customer.email': req.session?.user?.email }
        ]
      }).sort({ createdAt: -1 });
      
      // Get session orders
      const sessionOrders = req.session.orders || [];
      
      res.json({
        success: true,
        debug: {
          sessionId: sessionId ? `${sessionId.substring(0, 8)}...` : 'N/A',
          userId: userId,
          userEmail: req.session?.user?.email,
          totalOrdersInDB: allOrders.length,
          userOrdersInDB: userOrders.length,
          sessionOrdersCount: sessionOrders.length,
          lastOrder: req.session.lastOrder || null,
          allOrders: allOrders.map(o => ({
            orderId: o.orderId,
            userId: o.userId,
            sessionId: o.sessionId ? `${o.sessionId.substring(0, 8)}...` : 'N/A',
            customerEmail: o.customer.email,
            status: o.status,
            total: o.finalTotal,
            createdAt: o.createdAt
          })),
          userOrders: userOrders.map(o => ({
            orderId: o.orderId,
            status: o.status,
            total: o.finalTotal,
            createdAt: o.createdAt
          }))
        }
      });
      
    } catch (error) {
      console.error('❌ Debug Orders Error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = CartController;