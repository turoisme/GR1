/**
 * Home Controller - MongoDB Version
 * Xử lý các trang chính của website
 */

const Product = require('../models/Product');

class HomeController {
  /**
   * Trang chủ
   * GET /
   */
  static async index(req, res) {
    try {
      console.log('HomeController.index called - MongoDB version');
      
      // Lấy sản phẩm nổi bật từ MongoDB
      const featuredProducts = await Product.getFeaturedProducts(6);
      
      // Lấy danh mục sản phẩm
      const categories = Product.getCategories();
      
      // Lấy một vài sản phẩm cho mỗi danh mục (optional)
      const productsByCategory = {};
      for (const category of categories) {
        const categoryProducts = await Product.getProductsByCategory(category.id, 4);
        productsByCategory[category.id] = categoryProducts;
      }
      
      // Lấy thương hiệu
      const brands = Product.getBrands();
      
      res.render('home/index', {
        title: 'SportShop - Thời trang thể thao chất lượng cao',
        metaDescription: 'Khám phá bộ sưu tập quần áo thể thao hiện đại, chất lượng cao từ các thương hiệu nổi tiếng như Nike, Adidas, Under Armour.',
        featuredProducts: featuredProducts,
        categories: categories,
        productsByCategory: productsByCategory,
        brands: brands,
        currentPage: 'home',
        showHero: true
      });
      
    } catch (error) {
      console.error('Home Controller Index Error:', error);
      
      // Fallback với dữ liệu rỗng
      res.render('home/index', {
        title: 'SportShop - Thời trang thể thao chất lượng cao',
        featuredProducts: [],
        categories: Product.getCategories(),
        productsByCategory: {},
        brands: Product.getBrands(),
        currentPage: 'home',
        showHero: true
      });
    }
  }

  /**
   * Trang giới thiệu
   * GET /about
   */
  static async about(req, res) {
    try {
      res.render('home/about', {
        title: 'Giới thiệu - SportShop',
        currentPage: 'about'
      });
    } catch (error) {
      console.error('Home Controller About Error:', error);
      res.status(500).render('error', {
        title: 'Lỗi - SportShop',
        error: 'Không thể tải trang giới thiệu',
        currentPage: 'error'
      });
    }
  }

  /**
   * Trang liên hệ
   * GET /contact
   */
  static async contact(req, res) {
    try {
      res.render('home/contact', {
        title: 'Liên hệ - SportShop',
        currentPage: 'contact'
      });
    } catch (error) {
      console.error('Home Controller Contact Error:', error);
      res.status(500).render('error', {
        title: 'Lỗi - SportShop',
        error: 'Không thể tải trang liên hệ',
        currentPage: 'error'
      });
    }
  }

  /**
   * Trang tìm kiếm
   * GET /search
   */
  static async search(req, res) {
    try {
      const { q = '', category = 'all', brand = 'all' } = req.query;
      const query = q.trim();
      
      let products = [];
      let searchPerformed = false;
      
      if (query.length >= 2) {
        searchPerformed = true;
        
        // Tìm kiếm sản phẩm
        let searchResults = await Product.searchProducts(query);
        
        // Lọc theo category và brand nếu có
        products = searchResults.filter(product => {
          if (category && category !== 'all' && product.category !== category) return false;
          if (brand && brand !== 'all' && product.brand !== brand) return false;
          return true;
        });
      }
      
      const categories = Product.getCategories();
      const brands = Product.getBrands();
      
      res.render('home/search', {
        title: query ? `Tìm kiếm: "${query}" - SportShop` : 'Tìm kiếm - SportShop',
        query: query,
        products: products,
        searchPerformed: searchPerformed,
        resultCount: products.length,
        categories: categories,
        brands: brands,
        filters: {
          category: category,
          brand: brand
        },
        currentPage: 'search'
      });
      
    } catch (error) {
      console.error('Home Controller Search Error:', error);
      res.status(500).render('error', {
        title: 'Lỗi tìm kiếm - SportShop',
        error: 'Không thể thực hiện tìm kiếm',
        currentPage: 'error'
      });
    }
  }

  /**
   * API endpoint tìm kiếm gợi ý
   * GET /search/suggestions
   */
  static async searchSuggestions(req, res) {
    try {
      const { q } = req.query;
      
      if (!q || q.trim().length < 2) {
        return res.json({
          success: true,
          suggestions: []
        });
      }
      
      // Tìm kiếm sản phẩm để lấy gợi ý
      const products = await Product.searchProducts(q.trim());
      
      // Tạo danh sách gợi ý từ tên sản phẩm và thương hiệu
      const suggestions = [];
      const seenSuggestions = new Set();
      
      products.slice(0, 5).forEach(product => {
        // Gợi ý từ tên sản phẩm
        if (!seenSuggestions.has(product.name.toLowerCase())) {
          suggestions.push({
            type: 'product',
            text: product.name,
            url: `/products/${product._id}`
          });
          seenSuggestions.add(product.name.toLowerCase());
        }
        
        // Gợi ý từ thương hiệu
        if (!seenSuggestions.has(product.brand.toLowerCase())) {
          suggestions.push({
            type: 'brand',
            text: product.brand,
            url: `/products?brand=${product.brand.toLowerCase()}`
          });
          seenSuggestions.add(product.brand.toLowerCase());
        }
      });
      
      res.json({
        success: true,
        suggestions: suggestions.slice(0, 8)
      });
      
    } catch (error) {
      console.error('Home Controller SearchSuggestions Error:', error);
      res.json({
        success: false,
        suggestions: []
      });
    }
  }

  /**
   * Xử lý form liên hệ
   * POST /contact
   */
  static async submitContact(req, res) {
    try {
      const { name, email, phone, subject, message } = req.body;
      
      // Validation cơ bản
      if (!name || !email || !message) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng điền đầy đủ thông tin bắt buộc'
        });
      }
      
      // TODO: Lưu vào database hoặc gửi email
      console.log('Contact form submission:', { name, email, phone, subject, message });
      
      res.json({
        success: true,
        message: 'Cảm ơn bạn đã liên hệ! Chúng tôi sẽ phản hồi sớm nhất có thể.'
      });
      
    } catch (error) {
      console.error('Home Controller SubmitContact Error:', error);
      res.status(500).json({
        success: false,
        message: 'Có lỗi xảy ra khi gửi thông tin liên hệ'
      });
    }
  }

  /**
   * API endpoint thống kê trang chủ
   * GET /api/stats
   */
  static async getStats(req, res) {
    try {
      const totalProducts = await Product.countDocuments({ inStock: true });
      const featuredProducts = await Product.countDocuments({ featured: true, inStock: true });
      const categories = await Product.distinct('category', { inStock: true });
      const brands = await Product.distinct('brand', { inStock: true });
      
      res.json({
        success: true,
        data: {
          totalProducts: totalProducts,
          featuredProducts: featuredProducts,
          totalCategories: categories.length,
          totalBrands: brands.length,
          categories: categories,
          brands: brands
        }
      });
      
    } catch (error) {
      console.error('Home Controller GetStats Error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy thống kê',
        error: error.message
      });
    }
  }
}

module.exports = HomeController;