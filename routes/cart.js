const express = require('express');
const router = express.Router();
const CartController = require('../controllers/cartController');

console.log('Cart routes loaded'); // Debug log

// Web routes
router.get('/', CartController.index);                    // GET /cart - Hiển thị giỏ hàng
router.get('/checkout', CartController.checkout);        // GET /cart/checkout - Trang thanh toán

// API routes
router.get('/api', CartController.getCartInfo);          // GET /cart/api - Lấy thông tin giỏ hàng
router.get('/count', CartController.getCartCount);       // GET /cart/count - Lấy số lượng giỏ hàng (THÊM MỚI)
router.post('/add', CartController.addItem);             // POST /cart/add - Thêm sản phẩm
router.put('/update/:itemId', CartController.updateItem); // PUT /cart/update/:itemId - Cập nhật số lượng
router.delete('/remove/:itemId', CartController.removeItem); // DELETE /cart/remove/:itemId - Xóa sản phẩm
router.delete('/clear', CartController.clearCart);       // DELETE /cart/clear - Xóa tất cả

// Checkout processing
router.post('/checkout', CartController.processCheckout); // POST /cart/checkout - Xử lý thanh toán

module.exports = router;