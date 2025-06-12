/**
 * Home Controller - Complete Version with User Authentication and Product Color/Size Support
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
      console.log('User session:', req.session?.user);
      
      // Lấy sản phẩm nổi bật từ MongoDB
      let featuredProducts = [];
      
      try {
        featuredProducts = await Product.getFeaturedProducts(6);
        console.log(`📦 Found ${featuredProducts.length} featured products from DB`);
        
        // Đảm bảo sản phẩm từ DB có colors và sizes
        if (featuredProducts.length > 0) {
          featuredProducts = featuredProducts.map(product => {
            const productObj = product.toObject ? product.toObject() : product;
            return {
              ...productObj,
              colors: productObj.colors && productObj.colors.length > 0 ? 
                productObj.colors : ['Đen', 'Trắng', 'Xanh dương', 'Đỏ', 'Xanh lá', 'Vàng'],
              sizes: productObj.sizes && productObj.sizes.length > 0 ? 
                productObj.sizes : ['S', 'M', 'L', 'XL', 'XXL']
            };
          });
        }
      } catch (dbError) {
        console.log('⚠️ Using sample products due to DB error:', dbError.message);
        featuredProducts = [];
      }
      
      // Nếu không có sản phẩm từ DB, sử dụng sample data
      if (!featuredProducts || featuredProducts.length === 0) {
        featuredProducts = [
          {
            _id: 'sample1',
            name: 'Giày chạy bộ Nike Air Max',
            price: 2500000,
            image: '👟',
            brand: 'Nike',
            category: 'shoes',
            colors: ['Đen', 'Trắng', 'Xanh dương'],
            sizes: ['39', '40', '41', '42', '43'],
            inStock: true,
            featured: true,
            description: 'Giày chạy bộ cao cấp với công nghệ Air cushioning, thiết kế nhẹ và thoáng khí.',
            getFormattedPrice: function() { return this.price.toLocaleString('vi-VN') + 'đ'; }
          },
          {
            _id: 'sample2',
            name: 'Áo thể thao Adidas ClimaTech',
            price: 850000,
            image: '👕',
            brand: 'Adidas',
            category: 'tops',
            colors: ['Đỏ', 'Xanh lá', 'Trắng', 'Đen'],
            sizes: ['S', 'M', 'L', 'XL', 'XXL'],
            inStock: true,
            featured: true,
            description: 'Áo thể thao thoáng mát với công nghệ ClimaTech, thấm hút mồ hôi tốt.',
            getFormattedPrice: function() { return this.price.toLocaleString('vi-VN') + 'đ'; }
          },
          {
            _id: 'sample3',
            name: 'Quần short Nike Dri-FIT',
            price: 650000,
            image: '🩳',
            brand: 'Nike',
            category: 'bottoms',
            colors: ['Đen', 'Xanh dương', 'Xám'],
            sizes: ['S', 'M', 'L', 'XL'],
            inStock: true,
            featured: true,
            description: 'Quần short thể thao thoải mái với công nghệ Dri-FIT, co giãn tốt.',
            getFormattedPrice: function() { return this.price.toLocaleString('vi-VN') + 'đ'; }
          },
          {
            _id: 'sample4',
            name: 'Áo hoodie Under Armour',
            price: 1200000,
            image: '🧥',
            brand: 'Under Armour',
            category: 'tops',
            colors: ['Đen', 'Xám', 'Trắng', 'Đỏ'],
            sizes: ['S', 'M', 'L', 'XL', 'XXL'],
            inStock: true,
            featured: true,
            description: 'Áo hoodie thể thao cao cấp, giữ ấm tốt và thoáng khí.',
            getFormattedPrice: function() { return this.price.toLocaleString('vi-VN') + 'đ'; }
          },
          {
            _id: 'sample5',
            name: 'Giày tennis Puma Court',
            price: 1800000,
            image: '🎾',
            brand: 'Puma',
            category: 'shoes',
            colors: ['Trắng', 'Đen', 'Xanh lá'],
            sizes: ['38', '39', '40', '41', '42', '43', '44'],
            inStock: true,
            featured: true,
            description: 'Giày tennis chuyên nghiệp với đế chống trượt và thiết kế thoáng khí.',
            getFormattedPrice: function() { return this.price.toLocaleString('vi-VN') + 'đ'; }
          },
          {
            _id: 'sample6',
            name: 'Quần legging Adidas',
            price: 750000,
            image: '👖',
            brand: 'Adidas',
            category: 'bottoms',
            colors: ['Đen', 'Xám', 'Xanh dương'],
            sizes: ['XS', 'S', 'M', 'L', 'XL'],
            inStock: true,
            featured: true,
            description: 'Quần legging thể thao co giãn 4 chiều, phù hợp cho mọi hoạt động.',
            getFormattedPrice: function() { return this.price.toLocaleString('vi-VN') + 'đ'; }
          }
        ];
        
        console.log(`📦 Using ${featuredProducts.length} sample products`);
      }
      
      // Lấy danh mục sản phẩm
      const categories = Product.getCategories();
      
      // Lấy thương hiệu
      const brands = Product.getBrands();
      
      res.render('home/index', {
        title: 'SportShop - Thời trang thể thao chất lượng cao',
        metaDescription: 'Khám phá bộ sưu tập quần áo thể thao hiện đại, chất lượng cao từ các thương hiệu nổi tiếng như Nike, Adidas, Under Armour.',
        featuredProducts: featuredProducts,
        categories: categories,
        brands: brands,
        currentPage: 'home',
        showHero: true,
        // User data từ middleware
        user: req.session?.user || null,
        // Flash messages
        success: req.flash('success'),
        error: req.flash('error')
      });
      
    } catch (error) {
      console.error('Home Controller Index Error:', error);
      
      // Fallback cuối cùng với basic sample data
      const basicSampleProducts = [
        {
          _id: 'fallback1',
          name: 'Sản phẩm thể thao',
          price: 500000,
          image: '🏃‍♂️',
          brand: 'SportShop',
          category: 'general',
          colors: ['Đen', 'Trắng'],
          sizes: ['M', 'L'],
          inStock: true,
          featured: true,
          description: 'Sản phẩm thể thao chất lượng cao.',
          getFormattedPrice: function() { return this.price.toLocaleString('vi-VN') + 'đ'; }
        }
      ];
      
      res.render('home/index', {
        title: 'SportShop - Thời trang thể thao chất lượng cao',
        featuredProducts: basicSampleProducts,
        categories: [{ id: 'general', name: 'Thể thao', icon: '🏃‍♂️' }],
        brands: [{ id: 'sportshop', name: 'SportShop' }],
        currentPage: 'home',
        showHero: true,
        user: req.session?.user || null,
        success: req.flash('success'),
        error: req.flash('error')
      });
    }
  }

  /**
   * Trang giới thiệu
   * GET /about
   */
  static async about(req, res) {
    try {
      res.render('pages/about', {
        title: 'Giới thiệu - SportShop',
        currentPage: 'about',
        user: req.session?.user || null,
        success: req.flash('success'),
        error: req.flash('error')
      });
    } catch (error) {
      console.error('Home Controller About Error:', error);
      res.status(500).render('error', {
        title: 'Lỗi - SportShop',
        error: 'Không thể tải trang giới thiệu',
        currentPage: 'error',
        user: req.session?.user || null
      });
    }
  }

  /**
   * Trang liên hệ
   * GET /contact
   */
  static async contact(req, res) {
    try {
      res.render('pages/contact', {
        title: 'Liên hệ - SportShop',
        currentPage: 'contact',
        user: req.session?.user || null,
        success: req.flash('success'),
        error: req.flash('error')
      });
    } catch (error) {
      console.error('Home Controller Contact Error:', error);
      res.status(500).render('error', {
        title: 'Lỗi - SportShop',
        error: 'Không thể tải trang liên hệ',
        currentPage: 'error',
        user: req.session?.user || null
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
      
      console.log('📧 Contact form submission attempt:', {
        name, email, phone, subject, messageLength: message?.length
      });
      
      // Validation
      if (!name || !email || !message) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng điền đầy đủ thông tin bắt buộc (Họ tên, Email, Nội dung)'
        });
      }
      
      // Validate name length
      if (name.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Họ tên phải có ít nhất 2 ký tự'
        });
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Định dạng email không hợp lệ'
        });
      }
      
      // Validate phone if provided
      if (phone && phone.trim()) {
        const phoneRegex = /^[0-9]{10,11}$/;
        const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
        if (!phoneRegex.test(cleanPhone)) {
          return res.status(400).json({
            success: false,
            message: 'Số điện thoại phải có 10-11 chữ số'
          });
        }
      }
      
      // Validate message length
      if (message.trim().length < 10) {
        return res.status(400).json({
          success: false,
          message: 'Nội dung tin nhắn phải có ít nhất 10 ký tự'
        });
      }
      
      // TODO: Lưu vào database hoặc gửi email
      // For now, just log the contact submission
      console.log('📧 Contact form submission:', {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: phone?.trim() || 'Không cung cấp',
        subject: subject?.trim() || 'Không có chủ đề',
        message: message.trim(),
        timestamp: new Date(),
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        userId: req.session?.user?.id || 'Guest'
      });
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Success response
      res.json({
        success: true,
        message: 'Cảm ơn bạn đã liên hệ! Chúng tôi sẽ phản hồi trong vòng 24 giờ.'
      });
      
    } catch (error) {
      console.error('Home Controller SubmitContact Error:', error);
      res.status(500).json({
        success: false,
        message: 'Có lỗi xảy ra khi gửi thông tin liên hệ. Vui lòng thử lại sau.'
      });
    }
  }

  /**
   * Trang tìm kiếm
   * GET /search
   */
  static async search(req, res) {
    try {
      const { q = '', category = 'all', brand = 'all', page = 1 } = req.query;
      const query = q.trim();
      const currentPage = parseInt(page) || 1;
      const limit = 12;
      const skip = (currentPage - 1) * limit;
      
      let products = [];
      let totalProducts = 0;
      let searchPerformed = false;
      
      if (query.length >= 2) {
        searchPerformed = true;
        
        try {
          // Tìm kiếm sản phẩm từ database
          let searchResults = await Product.searchProducts(query);
          
          // Lọc theo category và brand nếu có
          let filteredResults = searchResults.filter(product => {
            if (category && category !== 'all' && product.category !== category) return false;
            if (brand && brand !== 'all' && product.brand !== brand) return false;
            return true;
          });
          
          totalProducts = filteredResults.length;
          products = filteredResults.slice(skip, skip + limit);
          
        } catch (searchError) {
          console.log('Search error, using sample results:', searchError.message);
          
          // Fallback với sample products nếu DB lỗi
          const sampleResults = [
            {
              _id: 'search1',
              name: `Kết quả tìm kiếm: ${query}`,
              price: 999000,
              image: '🔍',
              brand: 'SportShop',
              category: 'search',
              colors: ['Đen', 'Trắng'],
              sizes: ['M', 'L'],
              getFormattedPrice: function() { return this.price.toLocaleString('vi-VN') + 'đ'; }
            }
          ];
          
          products = sampleResults;
          totalProducts = sampleResults.length;
        }
      }
      
      // Pagination
      const totalPages = Math.ceil(totalProducts / limit);
      const pagination = {
        currentPage: currentPage,
        totalPages: totalPages,
        totalProducts: totalProducts,
        hasNext: currentPage < totalPages,
        hasPrev: currentPage > 1,
        nextPage: currentPage + 1,
        prevPage: currentPage - 1
      };
      
      const categories = Product.getCategories();
      const brands = Product.getBrands();
      
      res.render('pages/search', {
        title: query ? `Tìm kiếm: "${query}" - SportShop` : 'Tìm kiếm - SportShop',
        query: query,
        products: products,
        searchPerformed: searchPerformed,
        resultCount: totalProducts,
        categories: categories,
        brands: brands,
        selectedCategory: category,
        selectedBrand: brand,
        pagination: pagination,
        currentPage: 'search',
        user: req.session?.user || null,
        success: req.flash('success'),
        error: req.flash('error')
      });
      
    } catch (error) {
      console.error('Home Controller Search Error:', error);
      res.status(500).render('error', {
        title: 'Lỗi tìm kiếm - SportShop',
        error: 'Không thể thực hiện tìm kiếm',
        currentPage: 'error',
        user: req.session?.user || null
      });
    }
  }

  /**
   * API: Gợi ý tìm kiếm
   * GET /search/suggestions
   */
  static async searchSuggestions(req, res) {
    try {
      const { q } = req.query;
      
      if (!q || q.length < 2) {
        return res.json({
          success: true,
          suggestions: []
        });
      }
      
      let suggestions = [];
      
      try {
        // Tìm sản phẩm có tên chứa từ khóa
        const products = await Product.find({
          $or: [
            { name: { $regex: q, $options: 'i' } },
            { brand: { $regex: q, $options: 'i' } },
            { category: { $regex: q, $options: 'i' } }
          ],
          inStock: true
        })
        .limit(8)
        .select('name category brand')
        .lean();
        
        suggestions = products.map(product => ({
          name: product.name,
          category: product.category,
          brand: product.brand,
          type: 'product'
        }));
        
        // Thêm gợi ý theo thương hiệu và danh mục
        const brands = Product.getBrands().filter(brand => 
          brand.name.toLowerCase().includes(q.toLowerCase())
        ).slice(0, 3);
        
        const categories = Product.getCategories().filter(cat => 
          cat.name.toLowerCase().includes(q.toLowerCase())
        ).slice(0, 3);
        
        brands.forEach(brand => {
          suggestions.push({
            name: brand.name,
            type: 'brand'
          });
        });
        
        categories.forEach(cat => {
          suggestions.push({
            name: cat.name,
            type: 'category'
          });
        });
        
      } catch (dbError) {
        console.log('Search suggestions DB error:', dbError.message);
        // Return sample suggestions on DB error
        suggestions = [
          { name: `Tìm kiếm "${q}"`, type: 'search' }
        ];
      }
      
      res.json({
        success: true,
        suggestions: suggestions.slice(0, 10) // Giới hạn 10 suggestions
      });
      
    } catch (error) {
      console.error('Home Controller SearchSuggestions Error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy gợi ý tìm kiếm'
      });
    }
  }

  /**
   * API endpoint thống kê trang chủ
   * GET /api/stats
   */
  static async getStats(req, res) {
    try {
      let stats = {
        totalProducts: 0,
        featuredProducts: 0,
        totalCategories: 0,
        totalBrands: 0,
        categories: [],
        brands: []
      };
      
      try {
        const totalProducts = await Product.countDocuments({ inStock: true });
        const featuredProducts = await Product.countDocuments({ featured: true, inStock: true });
        const categories = await Product.distinct('category', { inStock: true });
        const brands = await Product.distinct('brand', { inStock: true });
        
        stats = {
          totalProducts: totalProducts,
          featuredProducts: featuredProducts,
          totalCategories: categories.length,
          totalBrands: brands.length,
          categories: categories,
          brands: brands,
          lastUpdated: new Date()
        };
        
        console.log('📊 Stats retrieved from DB:', stats);
        
      } catch (dbError) {
        console.log('Stats DB error, using defaults:', dbError.message);
        // Use default stats on DB error
        stats = {
          totalProducts: 6,
          featuredProducts: 6,
          totalCategories: 4,
          totalBrands: 4,
          categories: ['shoes', 'tops', 'bottoms', 'accessories'],
          brands: ['Nike', 'Adidas', 'Under Armour', 'Puma'],
          lastUpdated: new Date(),
          note: 'Using sample data due to database connection issue'
        };
      }
      
      res.json({
        success: true,
        data: stats
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