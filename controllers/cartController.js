/**
 * Cart Controller - MongoDB Version
 * Xử lý giỏ hàng với MongoDB
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
      console.log('Cart index - Session ID:', sessionId); // Debug log
      
      // Get cart for current session
      const cart = await Cart.findBySessionId(sessionId);
      console.log('Cart found:', {
        sessionId: cart.sessionId,
        itemCount: cart.totalItems,
        items: cart.items.length
      }); // Debug log
      
      res.render('cart/index', {
        title: 'Giỏ hàng - SportShop',
        cart: cart,
        currentPage: 'cart'
      });
      
    } catch (error) {
      console.error('Cart Controller Index Error:', error);
      res.status(500).render('error', {
        title: 'Lỗi giỏ hàng - SportShop',
        error: 'Không thể tải giỏ hàng',
        currentPage: 'error'
      });
    }
  }

  /**
   * Thêm sản phẩm vào giỏ hàng
   * POST /cart/add
   */
  static async addItem(req, res) {
    try {
      const { productId, quantity = 1, color, size } = req.body;
      const sessionId = req.sessionID || req.session.id;
      
      console.log('Add to cart request:', { productId, quantity, color, size, sessionId });
      
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
      
      // Validate ObjectId format
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
      
      // Validate color and size
      if (!product.colors.includes(color)) {
        return res.status(400).json({
          success: false,
          message: 'Màu sắc không hợp lệ'
        });
      }
      
      if (!product.sizes.includes(size)) {
        return res.status(400).json({
          success: false,
          message: 'Kích cỡ không hợp lệ'
        });
      }
      
      // Get or create cart
      const cart = await Cart.findBySessionId(sessionId);
      
      // Add item to cart
      await cart.addItem(productId, qty, color, size);
      
      console.log('✅ Item added to cart:', {
        sessionId: cart.sessionId,
        totalItems: cart.totalItems,
        productName: product.name
      });
      
      res.json({
        success: true,
        message: `Đã thêm ${product.name} (${color}, ${size}) vào giỏ hàng`,
        cart: {
          sessionId: cart.sessionId,
          totalItems: cart.totalItems,
          totalPrice: cart.getFormattedTotal(),
          finalTotal: cart.getFormattedFinalTotal()
        }
      });
      
    } catch (error) {
      console.error('Cart Controller AddItem Error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi thêm sản phẩm vào giỏ hàng',
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
      
      // Get cart
      const cart = await Cart.findBySessionId(req.session.id);
      
      if (cart.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Giỏ hàng trống'
        });
      }
      
      // Find item to get product name for message
      const item = cart.items.find(item => item._id.toString() === itemId);
      const productName = item ? item.product.name || 'Sản phẩm' : 'Sản phẩm';
      
      // Remove item
      cart.removeItem(itemId);
      await cart.save();
      
      res.json({
        success: true,
        message: `Đã xóa ${productName} khỏi giỏ hàng`,
        cart: {
          totalItems: cart.totalItems,
          totalPrice: cart.getFormattedTotal(),
          finalTotal: cart.getFormattedFinalTotal(),
          isEmpty: cart.isEmpty()
        }
      });
      
    } catch (error) {
      console.error('Cart Controller RemoveItem Error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi xóa sản phẩm khỏi giỏ hàng',
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
      
      // Validate quantity
      const qty = parseInt(quantity);
      if (isNaN(qty) || qty < 1 || qty > 10) {
        return res.status(400).json({
          success: false,
          message: 'Số lượng phải từ 1 đến 10'
        });
      }
      
      // Get cart
      const cart = await Cart.findBySessionId(req.session.id);
      
      // Update item quantity
      cart.updateItemQuantity(itemId, qty);
      await cart.save();
      
      res.json({
        success: true,
        message: 'Đã cập nhật số lượng sản phẩm',
        cart: {
          totalItems: cart.totalItems,
          totalPrice: cart.getFormattedTotal(),
          finalTotal: cart.getFormattedFinalTotal()
        }
      });
      
    } catch (error) {
      console.error('Cart Controller UpdateItem Error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi cập nhật số lượng sản phẩm',
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
      // Get cart
      const cart = await Cart.findBySessionId(req.session.id);
      
      if (cart.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Giỏ hàng đã trống'
        });
      }
      
      // Clear cart
      cart.clear();
      await cart.save();
      
      res.json({
        success: true,
        message: 'Đã xóa tất cả sản phẩm khỏi giỏ hàng',
        cart: {
          totalItems: 0,
          totalPrice: '0đ',
          finalTotal: '0đ',
          isEmpty: true
        }
      });
      
    } catch (error) {
      console.error('Cart Controller ClearCart Error:', error);
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
      const cart = await Cart.findBySessionId(req.session.id);
      
      res.json({
        success: true,
        data: {
          items: cart.items,
          totalItems: cart.totalItems,
          totalPrice: cart.totalPrice,
          formattedTotalPrice: cart.getFormattedTotal(),
          shippingFee: cart.shippingFee,
          formattedShippingFee: cart.getFormattedShippingFee(),
          finalTotal: cart.finalTotal,
          formattedFinalTotal: cart.getFormattedFinalTotal(),
          isEmpty: cart.isEmpty()
        }
      });
      
    } catch (error) {
      console.error('Cart Controller GetCartInfo Error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy thông tin giỏ hàng',
        error: error.message
      });
    }
  }

  /**
   * Trang checkout
   * GET /cart/checkout
   */
  static async checkout(req, res) {
    try {
      const cart = await Cart.findBySessionId(req.session.id);
      
      if (cart.isEmpty()) {
        return res.redirect('/cart');
      }
      
      res.render('cart/checkout', {
        title: 'Thanh toán - SportShop',
        cart: cart,
        currentPage: 'checkout'
      });
      
    } catch (error) {
      console.error('Cart Controller Checkout Error:', error);
      res.status(500).render('error', {
        title: 'Lỗi thanh toán - SportShop',
        error: 'Không thể tải trang thanh toán',
        currentPage: 'error'
      });
    }
  }

  /**
   * Xử lý thanh toán
   * POST /cart/checkout
   */
  static async processCheckout(req, res) {
    try {
      const cart = await Cart.findBySessionId(req.session.id);
      
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
        paymentMethod = 'cod',
        notes = ''
      } = req.body;
      
      // Validation
      if (!customerName || !customerEmail || !customerPhone || !shippingAddress) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng điền đầy đủ thông tin'
        });
      }
      
      // TODO: Create order in database
      const orderData = {
        sessionId: req.session.id,
        items: cart.items,
        customer: {
          name: customerName,
          email: customerEmail,
          phone: customerPhone,
          address: shippingAddress
        },
        totalItems: cart.totalItems,
        totalPrice: cart.totalPrice,
        shippingFee: cart.shippingFee,
        finalTotal: cart.finalTotal,
        paymentMethod: paymentMethod,
        notes: notes,
        status: 'pending',
        createdAt: new Date()
      };
      
      console.log('Order created:', orderData);
      
      // Clear cart after successful checkout
      cart.status = 'checked_out';
      await cart.save();
      
      res.json({
        success: true,
        message: 'Đặt hàng thành công! Chúng tôi sẽ liên hệ với bạn sớm nhất.',
        orderId: 'SP' + Date.now() // Temporary order ID
      });
      
    } catch (error) {
      console.error('Cart Controller ProcessCheckout Error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi xử lý thanh toán',
        error: error.message
      });
    }
  }
}

module.exports = CartController;