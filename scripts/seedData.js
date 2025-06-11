require('dotenv').config();
const mongoose = require('mongoose');
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

const sampleProducts = [
  {
    name: 'Giày chạy bộ Nike Air',
    price: 2500000,
    image: '👟',
    description: 'Giày chạy bộ cao cấp với công nghệ Air cushioning, thiết kế nhẹ và thoáng khí.',
    category: 'shoes',
    brand: 'Nike',
    colors: ['Đen', 'Trắng', 'Xanh dương'],
    sizes: ['39', '40', '41', '42', '43'],
    featured: true,
    stockQuantity: 50,
    tags: ['giày', 'chạy bộ', 'thể thao', 'nike']
  },
  {
    name: 'Áo thể thao Adidas',
    price: 850000,
    image: '👕',
    description: 'Áo thể thao thoáng mát với công nghệ Climalite, phù hợp cho mọi hoạt động thể thao.',
    category: 'tops',
    brand: 'Adidas',
    colors: ['Đỏ', 'Xanh lá', 'Trắng', 'Đen'],
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    featured: true,
    stockQuantity: 75,
    tags: ['áo', 'thể thao', 'adidas', 'thoáng mát']
  },
  {
    name: 'Quần short thể thao',
    price: 650000,
    image: '🩳',
    description: 'Quần short thể thao thoải mái, co giãn tốt, phù hợp cho tập gym và chạy bộ.',
    category: 'bottoms',
    brand: 'Nike',
    colors: ['Đen', 'Xanh nhạt', 'Vàng'],
    sizes: ['S', 'M', 'L', 'XL'],
    featured: true,
    stockQuantity: 60,
    tags: ['quần', 'short', 'thể thao', 'gym']
  },
  {
    name: 'Áo khoác thể thao Nike',
    price: 1250000,
    image: '🧥',
    description: 'Áo khoác chống gió, chống nước nhẹ, thiết kế hiện đại và năng động.',
    category: 'tops',
    brand: 'Nike',
    colors: ['Đen', 'Trắng', 'Xanh dương'],
    sizes: ['S', 'M', 'L', 'XL'],
    featured: true,
    stockQuantity: 40,
    tags: ['áo khoác', 'chống gió', 'nike', 'outdoor']
  },
  {
    name: 'Quần dài thể thao Adidas',
    price: 950000,
    image: '👖',
    description: 'Quần dài thể thao co giãn 4 chiều, phù hợp cho mọi hoạt động từ yoga đến chạy bộ.',
    category: 'bottoms',
    brand: 'Adidas',
    colors: ['Đen', 'Xanh lá', 'Hồng'],
    sizes: ['S', 'M', 'L', 'XL'],
    featured: true,
    stockQuantity: 45,
    tags: ['quần dài', 'co giãn', 'yoga', 'adidas']
  },
  {
    name: 'Mũ thể thao Under Armour',
    price: 380000,
    image: '🧢',
    description: 'Mũ thể thao chống nắng với công nghệ HeatGear, thoáng khí và khô ráo.',
    category: 'accessories',
    brand: 'Under Armour',
    colors: ['Đen', 'Trắng', 'Xanh dương', 'Đỏ'],
    sizes: ['S', 'M', 'L'],
    featured: true,
    stockQuantity: 80,
    tags: ['mũ', 'chống nắng', 'under armour', 'heatgear']
  },
  {
    name: 'Giày Tennis Nike Court',
    price: 2200000,
    image: '👟',
    description: 'Giày tennis chuyên nghiệp với đế cao su chống trượt và hỗ trợ chuyển động linh hoạt.',
    category: 'shoes',
    brand: 'Nike',
    colors: ['Trắng', 'Đen'],
    sizes: ['39', '40', '41', '42'],
    featured: false,
    stockQuantity: 30,
    tags: ['giày', 'tennis', 'nike', 'chuyên nghiệp']
  },
  {
    name: 'Áo tank top Adidas',
    price: 550000,
    image: '👕',
    description: 'Áo tank top năng động, thoáng mát, phù hợp cho tập gym và chạy bộ.',
    category: 'tops',
    brand: 'Adidas',
    colors: ['Trắng', 'Đen', 'Hồng', 'Xanh lá'],
    sizes: ['S', 'M', 'L', 'XL'],
    featured: false,
    stockQuantity: 65,
    tags: ['áo', 'tank top', 'gym', 'adidas']
  }
];

const seedData = async () => {
  try {
    // Clear existing products
    await Product.deleteMany({});
    console.log('🗑️  Cleared existing products');
    
    // Insert sample products
    const products = await Product.insertMany(sampleProducts);
    console.log(`✅ Created ${products.length} products`);
    
    // Display created products
    console.log('\n📦 Created Products:');
    products.forEach(product => {
      console.log(`- ${product.name} (${product.getFormattedPrice()})`);
    });
    
    console.log('\n🎉 Database seeded successfully!');
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
};

const runSeed = async () => {
  console.log('🌱 Starting database seeding...');
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