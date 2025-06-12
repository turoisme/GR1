/**
 * Cart Controller - Complete Version with MongoDB and Color/Size Support
 * Xử lý giỏ hàng với MongoDB và checkout chỉ giao hàng Hà Nội
 */

const Cart = require('../models/Cart');
const Product = require('../models/Product');

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
   * Xử lý thanh toán - CHỈ GIAO HÀNG HÀ NỘI
   * POST /cart/checkout
   */
  static async processCheckout(req, res) {
    try {
      const sessionId = req.sessionID || req.session.id;
      const userId = req.session?.user?.id || null;
      const cart = await Cart.findBySessionId(sessionId, userId);
      
      console.log('🏪 Process checkout started:', {
        sessionId: sessionId,
        items: cart.totalItems,
        total: cart.finalTotal
      });
      
      if (cart.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Giỏ hàng trống'
        });
      }
      
      const {
        customerName,
        customerEmail,
        customerPhone,
        shippingAddress,
        city,
        district,
        ward = '',
        paymentMethod = 'cod',
        notes = ''
      } = req.body;
      
      // Validation đầy đủ
      if (!customerName || !customerEmail || !customerPhone || !shippingAddress || !district) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng điền đầy đủ thông tin bắt buộc'
        });
      }
      
      // ⚠️ CHÍNH SÁCH: CHỈ GIAO HÀNG HÀ NỘI
      if (city !== 'hanoi') {
        return res.status(400).json({
          success: false,
          message: 'Hiện tại chúng tôi chỉ giao hàng trong khu vực Hà Nội.'
        });
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(customerEmail)) {
        return res.status(400).json({
          success: false,
          message: 'Định dạng email không hợp lệ'
        });
      }
      
      // Validate phone format (10-11 digits)
      const phoneRegex = /^[0-9]{10,11}$/;
      const cleanPhone = customerPhone.replace(/[\s\-\(\)]/g, '');
      if (!phoneRegex.test(cleanPhone)) {
        return res.status(400).json({
          success: false,
          message: 'Số điện thoại phải có 10-11 chữ số'
        });
      }
      
      // Generate order ID
      const orderId = 'SP' + Date.now() + Math.floor(Math.random() * 1000);
      
      // Calculate delivery date (1-2 days for Hanoi)
      const deliveryDate = new Date();
      deliveryDate.setDate(deliveryDate.getDate() + 2);
      
      // Create order data
      const orderData = {
        orderId: orderId,
        sessionId: sessionId,
        userId: userId,
        status: 'confirmed',
        paymentStatus: paymentMethod === 'cod' ? 'pending' : 'paid',
        paymentMethod: paymentMethod,
        customer: {
          name: customerName.trim(),
          email: customerEmail.toLowerCase().trim(),
          phone: cleanPhone
        },
        shipping: {
          address: shippingAddress.trim(),
          ward: ward.trim(),
          district: district.trim(),
          city: 'Hà Nội'
        },
        items: cart.items,
        totalItems: cart.totalItems,
        totalPrice: cart.totalPrice,
        shippingFee: cart.shippingFee,
        finalTotal: cart.finalTotal,
        notes: notes.trim(),
        estimatedDelivery: deliveryDate,
        createdAt: new Date()
      };
      
      console.log('📋 Order created:', {
        orderId: orderData.orderId,
        customerName: orderData.customer.name,
        totalItems: orderData.totalItems,
        finalTotal: orderData.finalTotal
      });
      
      // Clear cart after successful order
      cart.clear();
      await cart.save();
      
      // Clear session cart
      if (req.session.cartItems) {
        req.session.cartItems = [];
        req.session.cartCount = 0;
      }
      
      console.log('✅ Checkout completed:', {
        orderId: orderData.orderId,
        total: orderData.finalTotal
      });
      
      // Success response
      res.json({
        success: true,
        message: 'Đặt hàng thành công!',
        data: {
          orderId: orderData.orderId,
          estimatedDelivery: orderData.estimatedDelivery.toLocaleDateString('vi-VN'),
          total: orderData.finalTotal.toLocaleString('vi-VN') + 'đ',
          paymentMethod: orderData.paymentMethod
        }
      });
      
    } catch (error) {
      console.error('❌ Cart Controller ProcessCheckout Error:', error);
      res.status(500).json({
        success: false,
        message: 'Có lỗi xảy ra khi xử lý đơn hàng. Vui lòng thử lại.',
        error: error.message
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
}

module.exports = CartController;