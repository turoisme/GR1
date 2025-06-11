/**
 * Product Controller - MongoDB Version
 * Xử lý các trang sản phẩm với MongoDB
 */

const Product = require('../models/Product');

class ProductController {
  /**
   * Trang danh sách sản phẩm
   * GET /products
   */
  static async index(req, res) {
    try {
      const { category, brand, sort, search, page = 1 } = req.query;
      const limit = 12;
      const skip = (page - 1) * limit;
      
      // Build filter object
      let filter = { inStock: true };
      
      if (category && category !== 'all') {
        filter.category = category;
      }
      
      if (brand && brand !== 'all') {
        filter.brand = brand;
      }
      
      // Build sort object
      let sortOption = { createdAt: -1 }; // Default: newest first
      switch (sort) {
        case 'price_asc':
          sortOption = { price: 1 };
          break;
        case 'price_desc':
          sortOption = { price: -1 };
          break;
        case 'name_asc':
          sortOption = { name: 1 };
          break;
        case 'name_desc':
          sortOption = { name: -1 };
          break;
        case 'featured':
          sortOption = { featured: -1, createdAt: -1 };
          break;
      }
      
      // Handle search
      let products;
      let totalProducts;
      
      if (search && search.trim()) {
        // Use text search
        const searchResults = await Product.searchProducts(search.trim());
        
        // Apply additional filters to search results
        products = searchResults.filter(product => {
          if (category && category !== 'all' && product.category !== category) return false;
          if (brand && brand !== 'all' && product.brand !== brand) return false;
          return true;
        });
        
        totalProducts = products.length;
        
        // Apply pagination and sorting to filtered results
        products = products
          .sort((a, b) => {
            if (sort === 'price_asc') return a.price - b.price;
            if (sort === 'price_desc') return b.price - a.price;
            if (sort === 'name_asc') return a.name.localeCompare(b.name);
            if (sort === 'name_desc') return b.name.localeCompare(a.name);
            return new Date(b.createdAt) - new Date(a.createdAt);
          })
          .slice(skip, skip + limit);
          
      } else {
        // Regular query without search
        totalProducts = await Product.countDocuments(filter);
        products = await Product.find(filter)
          .sort(sortOption)
          .skip(skip)
          .limit(limit);
      }
      
      // Get filter options
      const categories = Product.getCategories();
      const brands = Product.getBrands();
      
      // Pagination info
      const totalPages = Math.ceil(totalProducts / limit);
      const currentPage = parseInt(page);
      
      res.render('products/index', {
        title: search ? `Tìm kiếm: "${search}" - SportShop` : 'Sản phẩm - SportShop',
        products: products,
        categories: categories,
        brands: brands,
        filters: {
          category: category || 'all',
          brand: brand || 'all',
          sort: sort || 'newest',
          search: search || ''
        },
        pagination: {
          currentPage: currentPage,
          totalPages: totalPages,
          totalProducts: totalProducts,
          hasNext: currentPage < totalPages,
          hasPrev: currentPage > 1,
          nextPage: currentPage + 1,
          prevPage: currentPage - 1
        },
        currentPage: 'products'
      });
      
    } catch (error) {
      console.error('Product Controller Index Error:', error);
      res.status(500).render('error', {
        title: 'Lỗi - SportShop',
        error: 'Không thể tải danh sách sản phẩm',
        currentPage: 'error'
      });
    }
  }

  /**
   * Trang chi tiết sản phẩm
   * GET /products/:id
   */
  static async show(req, res) {
    try {
      const { id } = req.params;
      
      // Validate ObjectId format
      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(404).render('404', {
          title: 'Sản phẩm không tìm thấy - SportShop',
          currentPage: '404'
        });
      }
      
      const product = await Product.findById(id);
      
      if (!product || !product.inStock) {
        return res.status(404).render('404', {
          title: 'Sản phẩm không tìm thấy - SportShop',
          currentPage: '404'
        });
      }
      
      // Get related products
      const relatedProducts = await Product.getProductsByCategory(product.category, 4);
      const filteredRelatedProducts = relatedProducts.filter(p => 
        p._id.toString() !== product._id.toString()
      );
      
      res.render('products/show', {
        title: `${product.name} - SportShop`,
        product: product,
        relatedProducts: filteredRelatedProducts,
        currentPage: 'products'
      });
      
    } catch (error) {
      console.error('Product Controller Show Error:', error);
      res.status(500).render('error', {
        title: 'Lỗi - SportShop',
        error: 'Không thể tải chi tiết sản phẩm',
        currentPage: 'error'
      });
    }
  }

  /**
   * API endpoint để lấy sản phẩm theo danh mục
   * GET /products/api/category/:category
   */
  static async getByCategory(req, res) {
    try {
      const { category } = req.params;
      const { limit = 10 } = req.query;
      
      const products = await Product.getProductsByCategory(category, parseInt(limit));
      
      res.json({
        success: true,
        data: products,
        count: products.length
      });
      
    } catch (error) {
      console.error('Product Controller GetByCategory Error:', error);
      res.status(500).json({
        success: false,
        message: 'Không thể tải sản phẩm theo danh mục',
        error: error.message
      });
    }
  }

  /**
   * API endpoint tìm kiếm sản phẩm
   * GET /products/api/search
   */
  static async search(req, res) {
    try {
      const { q, limit = 10 } = req.query;
      
      if (!q || q.trim().length < 2) {
        return res.json({
          success: false,
          message: 'Từ khóa tìm kiếm phải có ít nhất 2 ký tự',
          data: []
        });
      }
      
      const products = await Product.searchProducts(q.trim());
      const limitedProducts = products.slice(0, parseInt(limit));
      
      res.json({
        success: true,
        data: limitedProducts,
        count: limitedProducts.length,
        total: products.length
      });
      
    } catch (error) {
      console.error('Product Controller Search Error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi tìm kiếm sản phẩm',
        error: error.message
      });
    }
  }

  /**
   * API endpoint lấy thông tin sản phẩm
   * GET /products/api/:id
   */
  static async getProductInfo(req, res) {
    try {
      const { id } = req.params;
      
      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(404).json({
          success: false,
          message: 'ID sản phẩm không hợp lệ'
        });
      }
      
      const product = await Product.findById(id);
      
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Sản phẩm không tồn tại'
        });
      }
      
      res.json({
        success: true,
        data: {
          id: product._id,
          name: product.name,
          price: product.price,
          formattedPrice: product.getFormattedPrice(),
          image: product.image,
          description: product.description,
          colors: product.colors,
          sizes: product.sizes,
          category: product.category,
          brand: product.brand,
          inStock: product.inStock,
          stockQuantity: product.stockQuantity
        }
      });
      
    } catch (error) {
      console.error('Product Controller GetProductInfo Error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy thông tin sản phẩm',
        error: error.message
      });
    }
  }

  /**
   * API endpoint lấy sản phẩm featured
   * GET /products/api/featured
   */
  static async getFeatured(req, res) {
    try {
      const { limit = 6 } = req.query;
      
      const products = await Product.getFeaturedProducts(parseInt(limit));
      
      res.json({
        success: true,
        data: products,
        count: products.length
      });
      
    } catch (error) {
      console.error('Product Controller GetFeatured Error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy sản phẩm nổi bật',
        error: error.message
      });
    }
  }

  /**
   * API endpoint lấy danh mục và thương hiệu
   * GET /products/api/filters
   */
  static async getFilters(req, res) {
    try {
      const categories = Product.getCategories();
      const brands = Product.getBrands();
      
      // Get actual counts from database
      const categoryCounts = await Product.aggregate([
        { $match: { inStock: true } },
        { $group: { _id: '$category', count: { $sum: 1 } } }
      ]);
      
      const brandCounts = await Product.aggregate([
        { $match: { inStock: true } },
        { $group: { _id: '$brand', count: { $sum: 1 } } }
      ]);
      
      // Add counts to categories and brands
      const categoriesWithCounts = categories.map(cat => ({
        ...cat,
        count: categoryCounts.find(c => c._id === cat.id)?.count || 0
      }));
      
      const brandsWithCounts = brands.map(brand => ({
        id: brand.toLowerCase().replace(/\s+/g, '_'),
        name: brand,
        count: brandCounts.find(b => b._id === brand)?.count || 0
      }));
      
      res.json({
        success: true,
        data: {
          categories: categoriesWithCounts,
          brands: brandsWithCounts
        }
      });
      
    } catch (error) {
      console.error('Product Controller GetFilters Error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy bộ lọc',
        error: error.message
      });
    }
  }
}

module.exports = ProductController;