require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Product = require('../models/Product');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
};

// 🖼️ Sample products với real image URLs
const sampleProducts = [
  {
    name: 'Giày chạy bộ Nike Air Max',
    price: 2500000,
    image: '👟', // Emoji fallback
    imageUrl: '/assets/products/nike-air-max.jpg', // Real image URL
    images: [
      { url: '/assets/products/nike-air-max.jpg', alt: 'Nike Air Max - Main', isMain: true },
      { url: '/assets/products/nike-air-max-side.jpg', alt: 'Nike Air Max - Side view', isMain: false },
      { url: '/assets/products/nike-air-max-back.jpg', alt: 'Nike Air Max - Back view', isMain: false }
    ],
    description: 'Giày chạy bộ cao cấp với công nghệ Air cushioning, thiết kế nhẹ và thoáng khí. Phù hợp cho mọi hoạt động thể thao.',
    category: 'shoes',
    brand: 'Nike',
    colors: ['Đen', 'Trắng', 'Xanh dương'],
    sizes: ['39', '40', '41', '42', '43'],
    featured: true,
    stockQuantity: 50,
    tags: ['giày', 'chạy bộ', 'thể thao', 'nike', 'air max'],
    slug: 'giay-chay-bo-nike-air-max',
    metaTitle: 'Giày chạy bộ Nike Air Max - SportShop',
    metaDescription: 'Mua giày chạy bộ Nike Air Max chính hãng với giá tốt nhất tại SportShop'
  },
  {
    name: 'Áo thể thao Adidas ClimaTech',
    price: 850000,
    image: '👕',
    imageUrl: '/assets/products/adidas-climatech-shirt.jpg',
    images: [
      { url: '/assets/products/adidas-climatech-shirt.jpg', alt: 'Adidas ClimaTech - Main', isMain: true },
      { url: '/assets/products/adidas-climatech-shirt-back.jpg', alt: 'Adidas ClimaTech - Back', isMain: false }
    ],
    description: 'Áo thể thao thoáng mát với công nghệ ClimaTech, thấm hút mồ hôi tốt, phù hợp cho mọi hoạt động thể thao.',
    category: 'tops',
    brand: 'Adidas',
    colors: ['Đỏ', 'Xanh lá', 'Trắng', 'Đen'],
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    featured: true,
    stockQuantity: 75,
    tags: ['áo', 'thể thao', 'adidas', 'thoáng mát', 'climatech'],
    slug: 'ao-the-thao-adidas-climatech'
  },
  {
    name: 'Quần short thể thao Nike Dri-FIT',
    price: 650000,
    image: '🩳',
    imageUrl: '/assets/products/nike-dri-fit-shorts.jpg',
    images: [
      { url: '/assets/products/nike-dri-fit-shorts.jpg', alt: 'Nike Dri-FIT Shorts - Main', isMain: true }
    ],
    description: 'Quần short thể thao thoải mái với công nghệ Dri-FIT, co giãn tốt, phù hợp cho tập gym và chạy bộ.',
    category: 'bottoms',
    brand: 'Nike',
    colors: ['Đen', 'Xanh nhạt', 'Vàng'],
    sizes: ['S', 'M', 'L', 'XL'],
    featured: true,
    stockQuantity: 60,
    tags: ['quần', 'short', 'thể thao', 'gym', 'dri-fit'],
    slug: 'quan-short-the-thao-nike-dri-fit'
  },
  {
    name: 'Áo khoác thể thao Nike Windrunner',
    price: 1250000,
    image: '🧥',
    imageUrl: '/assets/products/nike-windrunner-jacket.jpg',
    images: [
      { url: '/assets/products/nike-windrunner-jacket.jpg', alt: 'Nike Windrunner - Main', isMain: true },
      { url: '/assets/products/nike-windrunner-jacket-hood.jpg', alt: 'Nike Windrunner - Hood', isMain: false }
    ],
    description: 'Áo khoác chống gió Windrunner iconic của Nike, chống nước nhẹ, thiết kế hiện đại và năng động.',
    category: 'tops',
    brand: 'Nike',
    colors: ['Đen', 'Trắng', 'Xanh dương'],
    sizes: ['S', 'M', 'L', 'XL'],
    featured: true,
    stockQuantity: 40,
    tags: ['áo khoác', 'chống gió', 'nike', 'windrunner', 'outdoor'],
    slug: 'ao-khoac-the-thao-nike-windrunner'
  },
  {
    name: 'Quần dài thể thao Adidas Tiro',
    price: 950000,
    image: '👖',
    imageUrl: '/assets/products/adidas-tiro-pants.jpg',
    images: [
      { url: '/assets/products/adidas-tiro-pants.jpg', alt: 'Adidas Tiro - Main', isMain: true }
    ],
    description: 'Quần dài thể thao Tiro classic với chất liệu co giãn 4 chiều, phù hợp cho mọi hoạt động từ yoga đến bóng đá.',
    category: 'bottoms',
    brand: 'Adidas',
    colors: ['Đen', 'Xanh lá', 'Hồng'],
    sizes: ['S', 'M', 'L', 'XL'],
    featured: true,
    stockQuantity: 45,
    tags: ['quần dài', 'co giãn', 'tiro', 'adidas', 'bóng đá'],
    slug: 'quan-dai-the-thao-adidas-tiro'
  },
  {
    name: 'Mũ thể thao Under Armour HeatGear',
    price: 380000,
    image: '🧢',
    imageUrl: '/assets/products/under-armour-heatgear-cap.jpg',
    images: [
      { url: '/assets/products/under-armour-heatgear-cap.jpg', alt: 'Under Armour HeatGear Cap - Main', isMain: true }
    ],
    description: 'Mũ thể thao chống nắng với công nghệ HeatGear độc quyền, thoáng khí và nhanh khô.',
    category: 'accessories',
    brand: 'Under Armour',
    colors: ['Đen', 'Trắng', 'Xanh dương', 'Đỏ'],
    sizes: ['S', 'M', 'L'],
    featured: true,
    stockQuantity: 80,
    tags: ['mũ', 'chống nắng', 'under armour', 'heatgear'],
    slug: 'mu-the-thao-under-armour-heatgear'
  },
  // Thêm sản phẩm không có ảnh thật để test fallback
  {
    name: 'Giày Tennis Nike Court Legacy',
    price: 2200000,
    image: '👟',
    // Không có imageUrl - sẽ dùng emoji
    description: 'Giày tennis chuyên nghiệp với đế cao su chống trượt và hỗ trợ chuyển động linh hoạt trên sân.',
    category: 'shoes',
    brand: 'Nike',
    colors: ['Trắng', 'Đen'],
    sizes: ['39', '40', '41', '42'],
    featured: false,
    stockQuantity: 30,
    tags: ['giày', 'tennis', 'nike', 'chuyên nghiệp'],
    slug: 'giay-tennis-nike-court-legacy'
  },
  {
    name: 'Áo tank top Adidas Essential',
    price: 550000,
    image: '👕',
    imageUrl: '/assets/products/adidas-essential-tank.jpg',
    images: [
      { url: '/assets/products/adidas-essential-tank.jpg', alt: 'Adidas Essential Tank - Main', isMain: true }
    ],
    description: 'Áo tank top năng động với chất liệu cotton blend, thoáng mát, phù hợp cho tập gym và chạy bộ.',
    category: 'tops',
    brand: 'Adidas',
    colors: ['Trắng', 'Đen', 'Hồng', 'Xanh lá'],
    sizes: ['S', 'M', 'L', 'XL'],
    featured: false,
    stockQuantity: 65,
    tags: ['áo', 'tank top', 'gym', 'adidas', 'cotton'],
    slug: 'ao-tank-top-adidas-essential'
  }
];

// Function to check if image files exist
const checkImageFiles = () => {
  const missingImages = [];
  const imagesDir = path.join(__dirname, '../data/images');
  
  console.log('🔍 Checking image files...');
  
  sampleProducts.forEach(product => {
    if (product.imageUrl) {
      const imagePath = path.join(__dirname, '../data', product.imageUrl.replace('/assets', 'images'));
      if (!fs.existsSync(imagePath)) {
        missingImages.push({
          product: product.name,
          expectedPath: imagePath,
          url: product.imageUrl
        });
      }
    }
    
    // Check additional images
    if (product.images) {
      product.images.forEach(img => {
        const imagePath = path.join(__dirname, '../data', img.url.replace('/assets', 'images'));
        if (!fs.existsSync(imagePath)) {
          missingImages.push({
            product: product.name,
            expectedPath: imagePath,
            url: img.url
          });
        }
      });
    }
  });
  
  if (missingImages.length > 0) {
    console.log('⚠️  Missing image files:');
    missingImages.forEach(missing => {
      console.log(`   - ${missing.product}: ${missing.url}`);
    });
    console.log('\n💡 You can:');
    console.log('   1. Add real images to data/images/ folders');
    console.log('   2. Or run the script anyway (will use emoji fallbacks)');
    console.log('   3. Update images later using the admin panel\n');
  } else {
    console.log('✅ All image files found!');
  }
  
  return missingImages;
};

// Create sample image files if they don't exist
const createSampleImages = () => {
  const categories = ['products', 'qr-codes', 'banners', 'icons'];
  
  categories.forEach(category => {
    const categoryDir = path.join(__dirname, '../data/images', category);
    if (!fs.existsSync(categoryDir)) {
      fs.mkdirSync(categoryDir, { recursive: true });
      console.log(`📁 Created directory: data/images/${category}`);
    }
  });
  
  // Create sample QR code if not exists
  const qrPath = path.join(__dirname, '../data/images/qr-codes/payment-qr.png');
  if (!fs.existsSync(qrPath)) {
    // Create a simple placeholder file
    fs.writeFileSync(qrPath + '.txt', 'Replace this with your actual QR code image');
    console.log('📄 Created placeholder for QR code at: data/images/qr-codes/payment-qr.png.txt');
  }
  
  // Create .gitkeep files
  categories.forEach(category => {
    const gitkeepPath = path.join(__dirname, '../data/images', category, '.gitkeep');
    if (!fs.existsSync(gitkeepPath)) {
      fs.writeFileSync(gitkeepPath, '# Keep this directory in git\n');
    }
  });
};

const seedData = async () => {
  try {
    // Clear existing products
    await Product.deleteMany({});
    console.log('🗑️  Cleared existing products');
    
    // Check images before seeding
    const missingImages = checkImageFiles();
    
    // Create directories and sample files
    createSampleImages();
    
    // Insert sample products
    const products = await Product.insertMany(sampleProducts);
    console.log(`✅ Created ${products.length} products`);
    
    // Display created products with image status
    console.log('\n📦 Created Products:');
    products.forEach(product => {
      const hasImage = product.hasRealImages() ? '🖼️' : '😊';
      console.log(`${hasImage} ${product.name} (${product.getFormattedPrice()})`);
    });
    
    // Statistics
    const withImages = products.filter(p => p.hasRealImages()).length;
    const withoutImages = products.length - withImages;
    
    console.log('\n📊 Statistics:');
    console.log(`   🖼️  Products with real images: ${withImages}`);
    console.log(`   😊 Products with emoji only: ${withoutImages}`);
    console.log(`   ⚠️  Missing image files: ${missingImages.length}`);
    
    if (missingImages.length > 0) {
      console.log('\n💡 Next steps:');
      console.log('   1. Add your product images to data/images/products/');
      console.log('   2. Add your QR code to data/images/qr-codes/payment-qr.png');
      console.log('   3. Restart the server to serve static files');
      console.log('   4. Visit /api/images?category=products to see available images');
    }
    
    console.log('\n🎉 Database seeded successfully!');
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
};

const runSeed = async () => {
  console.log('🌱 Starting database seeding with images...');
  console.log('📍 Environment:', process.env.NODE_ENV || 'development');
  console.log('🗄️  MongoDB URI:', process.env.MONGODB_URI ? 'Set ✅' : 'Not set ❌');
  
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI not found in environment variables');
    console.log('💡 Please create .env file with MONGODB_URI');
    process.exit(1);
  }
  
  await connectDB();
  await seedData();
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err.message);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message);
  process.exit(1);
});

// Run the seeding process
runSeed();