/**
 * Cart Controller - MongoDB Version - Đầy đủ
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
      console.log('🛒 Cart index - Session ID:', sessionId);
      
      // Get cart for current session
      const cart = await Cart.findBySessionId(sessionId);
      console.log('📦 Cart found:', {
        sessionId: cart.sessionId,
        itemCount: cart.totalItems,
        items: cart.items.length,
        total: cart.getFormattedFinalTotal()
      });
      
      res.render('cart/index', {
        title: 'Giỏ hàng - SportShop',
        cart: cart,
        currentPage: 'cart'
      });
      
    } catch (error) {
      console.error('❌ Cart Controller Index Error:', error);
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
      
      console.log('➕ Add to cart request:', { productId, quantity, color, size, sessionId });
      
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
        data: {
          cartItemCount: cart.totalItems,
          cartTotal: cart.getFormattedTotal(),
          cartFinalTotal: cart.getFormattedFinalTotal(),
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
      const cart = await Cart.findBySessionId(sessionId);
      
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
      
      const productName = item.product.name || 'Sản phẩm';
      
      // Update item quantity
      cart.updateItemQuantity(itemId, qty);
      await cart.save();
      
      console.log('✅ Cart item updated:', {
        productName: productName,
        newQuantity: qty,
        newTotal: cart.getFormattedFinalTotal()
      });
      
      res.json({
        success: true,
        message: `Đã cập nhật số lượng ${productName}`,
        data: {
          cartItemCount: cart.totalItems,
          cartTotal: cart.getFormattedTotal(),
          cartFinalTotal: cart.getFormattedFinalTotal(),
          item: {
            id: itemId,
            quantity: qty,
            subtotal: item.subtotal
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
      
      console.log('🗑️ Remove cart item:', { itemId, sessionId });
      
      // Get cart
      const cart = await Cart.findBySessionId(sessionId);
      
      if (cart.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Giỏ hàng trống'
        });
      }
      
      // Find item to get product name for message
      const item = cart.items.find(item => item._id.toString() === itemId);
      const productName = item ? (item.product.name || 'Sản phẩm') : 'Sản phẩm';
      
      if (!item) {
        return res.status(404).json({
          success: false,
          message: 'Sản phẩm không tồn tại trong giỏ hàng'
        });
      }
      
      // Remove item
      cart.removeItem(itemId);
      await cart.save();
      
      console.log('✅ Cart item removed:', {
        productName: productName,
        remainingItems: cart.totalItems
      });
      
      res.json({
        success: true,
        message: `Đã xóa ${productName} khỏi giỏ hàng`,
        data: {
          cartItemCount: cart.totalItems,
          cartTotal: cart.getFormattedTotal(),
          cartFinalTotal: cart.getFormattedFinalTotal(),
          isEmpty: cart.isEmpty()
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
      
      console.log('🧹 Clear cart:', { sessionId });
      
      // Get cart
      const cart = await Cart.findBySessionId(sessionId);
      
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
      
      console.log('✅ Cart cleared:', {
        sessionId: sessionId,
        removedItems: itemCount
      });
      
      res.json({
        success: true,
        message: `Đã xóa tất cả ${itemCount} sản phẩm khỏi giỏ hàng`,
        data: {
          cartItemCount: 0,
          cartTotal: '0đ',
          cartFinalTotal: '0đ',
          isEmpty: true
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
      const cart = await Cart.findBySessionId(sessionId);
      
      console.log('📊 Get cart info:', {
        sessionId: sessionId,
        items: cart.totalItems
      });
      
      res.json({
        success: true,
        data: {
          sessionId: cart.sessionId,
          items: cart.items.map(item => ({
            id: item._id,
            product: {
              id: item.product._id,
              name: item.product.name,
              image: item.product.image,
              price: item.product.price
            },
            quantity: item.quantity,
            color: item.color,
            size: item.size,
            priceAtTime: item.priceAtTime,
            subtotal: item.subtotal,
            formattedSubtotal: item.subtotal.toLocaleString('vi-VN') + 'đ'
          })),
          summary: {
            totalItems: cart.totalItems,
            totalPrice: cart.totalPrice,
            formattedTotalPrice: cart.getFormattedTotal(),
            shippingFee: cart.shippingFee,
            formattedShippingFee: cart.getFormattedShippingFee(),
            finalTotal: cart.finalTotal,
            formattedFinalTotal: cart.getFormattedFinalTotal(),
            isEmpty: cart.isEmpty()
          }
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
   * Trang checkout
   * GET /cart/checkout
   */
  static async checkout(req, res) {
    try {
      const sessionId = req.sessionID || req.session.id;
      const cart = await Cart.findBySessionId(sessionId);
      
      console.log('💳 Checkout page:', {
        sessionId: sessionId,
        items: cart.totalItems,
        total: cart.getFormattedFinalTotal()
      });
      
      if (cart.isEmpty()) {
        console.log('⚠️ Empty cart redirect to cart page');
        return res.redirect('/cart');
      }
      
      res.render('cart/checkout', {
        title: 'Thanh toán - SportShop',
        cart: cart,
        currentPage: 'checkout'
      });
      
    } catch (error) {
      console.error('❌ Cart Controller Checkout Error:', error);
      res.status(500).render('error', {
        title: 'Lỗi thanh toán - SportShop',
        error: 'Không thể tải trang thanh toán',
        currentPage: 'error'
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
      const cart = await Cart.findBySessionId(sessionId);
      
      console.log('🏪 Process checkout:', {
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
          message: 'Xin lỗi! Hiện tại chúng tôi chỉ giao hàng trong khu vực Hà Nội.'
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
      
      // Validate Hà Nội districts
      const hanoiDistricts = [
        'badinh', 'hoankiem', 'tayho', 'longbien', 'caugiay', 'dongda', 
        'haibatrung', 'hoangmai', 'thanhxuan', 'namtulem', 'bactulem', 
        'hadong', 'sontay', 'bavi', 'chuongmy', 'danphuong', 'hoaiduc', 
        'melinh', 'myduc', 'phuxuyen', 'phuctho', 'quocoai', 'socson', 
        'thachthat', 'thanhoai', 'thuynguyen', 'unghoa'
      ];
      
      const normalizedDistrict = district.toLowerCase().replace(/\s+/g, '');
      if (!hanoiDistricts.includes(normalizedDistrict)) {
        return res.status(400).json({
          success: false,
          message: 'Quận/huyện không hợp lệ hoặc không nằm trong khu vực giao hàng'
        });
      }
      
      // Validate payment method
      const validPaymentMethods = ['cod', 'bank', 'momo'];
      if (!validPaymentMethods.includes(paymentMethod)) {
        return res.status(400).json({
          success: false,
          message: 'Phương thức thanh toán không hợp lệ'
        });
      }
      
      // Generate order ID
      const orderId = 'SP' + Date.now() + Math.floor(Math.random() * 1000);
      
      // Calculate delivery date (1-2 days for Hanoi)
      const deliveryDate = new Date();
      deliveryDate.setDate(deliveryDate.getDate() + (district.includes('noi') ? 1 : 2));
      
      // Create comprehensive order data
      const orderData = {
        // Order Info
        orderId: orderId,
        sessionId: sessionId,
        status: 'confirmed',
        paymentStatus: paymentMethod === 'cod' ? 'pending' : 'waiting_payment',
        
        // Customer Info
        customer: {
          name: customerName.trim(),
          email: customerEmail.toLowerCase().trim(),
          phone: cleanPhone,
          address: {
            detail: shippingAddress.trim(),
            district: district,
            city: 'Hà Nội',
            fullAddress: `${shippingAddress.trim()}, ${district}, Hà Nội`
          }
        },
        
        // Items Info
        items: cart.items.map(item => ({
          productId: item.product._id,
          productName: item.product.name,
          productImage: item.product.image,
          quantity: item.quantity,
          color: item.color,
          size: item.size,
          priceAtTime: item.priceAtTime,
          subtotal: item.subtotal
        })),
        
        // Pricing Info
        pricing: {
          totalItems: cart.totalItems,
          subtotal: cart.totalPrice,
          shippingFee: cart.shippingFee,
          finalTotal: cart.finalTotal,
          currency: 'VND'
        },
        
        // Payment Info
        payment: {
          method: paymentMethod,
          status: paymentMethod === 'cod' ? 'pending' : 'waiting_payment',
          bankInfo: paymentMethod === 'bank' ? {
            bankName: 'Vietcombank',
            accountNumber: '1234567890',
            accountName: 'Nguyễn Thanh Tân',
            transferContent: `SportShop ${customerName.split(' ').pop()}`
          } : null
        },
        
        // Delivery Info
        delivery: {
          method: 'standard',
          estimatedDate: deliveryDate,
          fee: cart.shippingFee,
          address: `${shippingAddress.trim()}, ${district}, Hà Nội`,
          notes: notes.trim(),
          trackingNumber: 'SP' + Date.now()
        },
        
        // Timestamps
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Log order creation
      console.log('📦 New order created:', {
        orderId: orderData.orderId,
        customer: orderData.customer.name,
        district: orderData.customer.address.district,
        total: orderData.pricing.finalTotal.toLocaleString('vi-VN') + 'đ',
        paymentMethod: orderData.payment.method,
        items: orderData.pricing.totalItems
      });
      
      // TODO: Save order to database (Order model)
      // const Order = require('../models/Order');
      // const savedOrder = await Order.create(orderData);
      
      // TODO: Send confirmation email
      // await EmailService.sendOrderConfirmation(orderData);
      
      // TODO: Send SMS notification
      // await SMSService.sendOrderNotification(orderData);
      
      // TODO: Update product stock
      // await ProductService.updateStock(orderData.items);
      
      // TODO: Create delivery tracking
      // await DeliveryService.createTracking(orderData);
      
      // Clear cart after successful checkout
      cart.status = 'checked_out';
      cart.orderId = orderId;
      await cart.save();
      
      // Create response message based on payment method
      let responseMessage = '';
      let additionalInfo = {};
      
      switch (paymentMethod) {
        case 'cod':
          responseMessage = `🎉 Đặt hàng thành công! Mã đơn hàng: ${orderId}. Chúng tôi sẽ giao hàng và thu tiền tại địa chỉ của bạn trong 1-2 ngày tới.`;
          additionalInfo = {
            deliveryTime: '1-2 ngày',
            paymentNote: 'Thanh toán khi nhận hàng'
          };
          break;
          
        case 'bank':
          responseMessage = `🎉 Đặt hàng thành công! Mã đơn hàng: ${orderId}. Vui lòng chuyển khoản theo thông tin đã cung cấp. Chúng tôi sẽ xử lý đơn hàng ngay sau khi nhận được thanh toán.`;
          additionalInfo = {
            transferInfo: orderData.payment.bankInfo,
            paymentNote: 'Vui lòng chuyển khoản trong 30 phút'
          };
          break;
          
        case 'momo':
          responseMessage = `🎉 Đặt hàng thành công! Mã đơn hàng: ${orderId}. Vui lòng thanh toán qua MoMo. Chúng tôi sẽ xử lý đơn hàng ngay sau khi nhận được thanh toán.`;
          additionalInfo = {
            paymentNote: 'Thanh toán qua ví MoMo'
          };
          break;
      }
      
      // Success response
      res.json({
        success: true,
        message: responseMessage,
        data: {
          orderId: orderData.orderId,
          trackingNumber: orderData.delivery.trackingNumber,
          totalAmount: orderData.pricing.finalTotal,
          formattedTotal: orderData.pricing.finalTotal.toLocaleString('vi-VN') + 'đ',
          paymentMethod: orderData.payment.method,
          estimatedDelivery: orderData.delivery.estimatedDate.toLocaleDateString('vi-VN'),
          customer: {
            name: orderData.customer.name,
            phone: orderData.customer.phone,
            address: orderData.customer.address.fullAddress
          },
          ...additionalInfo
        }
      });
      
    } catch (error) {
      console.error('❌ Cart Controller ProcessCheckout Error:', error);
      res.status(500).json({
        success: false,
        message: 'Đã xảy ra lỗi khi xử lý đơn hàng. Vui lòng thử lại sau.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Kiểm tra trạng thái đơn hàng
   * GET /cart/order/:orderId
   */
  static async checkOrderStatus(req, res) {
    try {
      const { orderId } = req.params;
      
      console.log('🔍 Check order status:', { orderId });
      
      // TODO: Get order from database
      // const Order = require('../models/Order');
      // const order = await Order.findOne({ orderId });
      
      // Mock order status for now
      const mockOrder = {
        orderId: orderId,
        status: 'confirmed',
        paymentStatus: 'pending',
        estimatedDelivery: new Date(Date.now() + 24 * 60 * 60 * 1000),
        trackingNumber: 'SP' + orderId.slice(-8)
      };
      
      res.json({
        success: true,
        data: mockOrder
      });
      
    } catch (error) {
      console.error('❌ Cart Controller CheckOrderStatus Error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi kiểm tra trạng thái đơn hàng'
      });
    }
  }

  /**
   * Hủy đơn hàng
   * POST /cart/cancel/:orderId
   */
  static async cancelOrder(req, res) {
    try {
      const { orderId } = req.params;
      const { reason = 'Khách hàng hủy' } = req.body;
      
      console.log('❌ Cancel order:', { orderId, reason });
      
      // TODO: Update order status in database
      // const Order = require('../models/Order');
      // await Order.updateOne({ orderId }, { 
      //   status: 'cancelled', 
      //   cancelReason: reason,
      //   cancelledAt: new Date()
      // });
      
      res.json({
        success: true,
        message: `Đơn hàng ${orderId} đã được hủy thành công`
      });
      
    } catch (error) {
      console.error('❌ Cart Controller CancelOrder Error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi hủy đơn hàng'
      });
    }
  }
}

module.exports = CartController;