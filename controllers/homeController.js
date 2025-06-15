/**
 * Home Controller - MongoDB Version FIXED
 * Xử lý các trang chính của website với dữ liệu thực từ DB
 */

const Product = require('../models/Product');

class HomeController {
  /**
   * Trang chủ - FIXED để load dữ liệu thực từ DB
   * GET /
   */
  static async index(req, res) {
    try {
      console.log('🏠 HomeController.index called - Loading real data from MongoDB');
      
      // ✅ FIX 1: Sử dụng query trực tiếp với field name đúng
      let featuredProducts = await Product.find({ 
        isFeatured: true,    // ✅ Sử dụng isFeatured thay vì featured
        inStock: true 
      })
      .limit(6)
      .sort({ createdAt: -1 });
      
      console.log('📊 Featured products loaded:', {
        count: featuredProducts.length,
        products: featuredProducts.map(p => ({
          id: p._id,
          name: p.name,
          price: p.price
        }))
      });
      
      // ✅ FIX 2: Nếu không có featured products, lấy sản phẩm mới nhất
      if (featuredProducts.length === 0) {
        console.log('⚠️ No featured products found, getting latest products instead...');
        featuredProducts = await Product.find({ inStock: true })
          .limit(6)
          .sort({ createdAt: -1 });
        
        console.log('📦 Latest products loaded:', featuredProducts.length);
      }
      
      // ✅ FIX 3: Lấy danh mục sản phẩm
      const categories = Product.getCategories();
      
      // ✅ FIX 4: Lấy sản phẩm cho mỗi danh mục với error handling
      const productsByCategory = {};
      for (const category of categories) {
        try {
          const categoryProducts = await Product.find({ 
            category: category.id, 
            inStock: true 
          })
          .limit(4)
          .sort({ createdAt: -1 });
          
          productsByCategory[category.id] = categoryProducts;
          console.log(`📂 Category ${category.id}:`, categoryProducts.length, 'products');
        } catch (error) {
          console.error(`❌ Error loading category ${category.id}:`, error);
          productsByCategory[category.id] = [];
        }
      }
      
      // ✅ FIX 5: Lấy thương hiệu
      const brands = Product.getBrands();
      
      // ✅ FIX 6: Debug total products in database
      const totalProducts = await Product.countDocuments();
      const activeProducts = await Product.countDocuments({ inStock: true });
      console.log('📊 Database stats:', {
        totalProducts,
        activeProducts,
        featuredCount: featuredProducts.length
      });
      
      // ✅ FIX 7: Render với dữ liệu thực
      const renderData = {
        title: 'SportShop - Thời trang thể thao chất lượng cao',
        metaDescription: 'Khám phá bộ sưu tập quần áo thể thao hiện đại, chất lượng cao từ các thương hiệu nổi tiếng như Nike, Adidas, Under Armour.',
        featuredProducts: featuredProducts, // ✅ Dữ liệu thực từ MongoDB
        categories: categories,
        productsByCategory: productsByCategory,
        brands: brands,
        currentPage: 'home',
        showHero: true
      };
      
      console.log('✅ Rendering home page with real data:', {
        featuredProductsCount: renderData.featuredProducts.length,
        categoriesCount: renderData.categories.length,
        hasRealData: renderData.featuredProducts.length > 0
      });
      
      res.render('home/index', renderData);
      
    } catch (error) {
      console.error('❌ Home Controller Index Error:', error);
      console.error('Error stack:', error.stack);
      
      // ✅ FIX 8: Fallback với logging rõ ràng
      console.log('🔄 Falling back to empty data due to error');
      res.render('home/index', {
        title: 'SportShop - Thời trang thể thao chất lượng cao',
        featuredProducts: [], // ✅ Mảng rỗng để view hiển thị fallback
        categories: Product.getCategories(),
        productsByCategory: {},
        brands: Product.getBrands(),
        currentPage: 'home',
        showHero: true,
        errorMessage: 'Không thể tải sản phẩm từ cơ sở dữ liệu'
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
        
        // ✅ Tìm kiếm sản phẩm với error handling
        try {
          let searchResults = await Product.find({
            inStock: true,
            $or: [
              { name: { $regex: query, $options: 'i' } },
              { brand: { $regex: query, $options: 'i' } },
              { description: { $regex: query, $options: 'i' } },
              { tags: { $in: [new RegExp(query, 'i')] } }
            ]
          });
          
          // Lọc theo category và brand nếu có
          products = searchResults.filter(product => {
            if (category && category !== 'all' && product.category !== category) return false;
            if (brand && brand !== 'all' && product.brand !== brand) return false;
            return true;
          });
        } catch (searchError) {
          console.error('Search error:', searchError);
          products = [];
        }
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
      
      // ✅ Tìm kiếm sản phẩm để lấy gợi ý
      const products = await Product.find({
        inStock: true,
        $or: [
          { name: { $regex: q.trim(), $options: 'i' } },
          { brand: { $regex: q.trim(), $options: 'i' } }
        ]
      }).limit(5);
      
      // Tạo danh sách gợi ý từ tên sản phẩm và thương hiệu
      const suggestions = [];
      const seenSuggestions = new Set();
      
      products.forEach(product => {
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
      const featuredProducts = await Product.countDocuments({ isFeatured: true, inStock: true }); // ✅ Fixed field name
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