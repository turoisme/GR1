// debug-orders.js - Script to debug order issues
require('dotenv').config();
const mongoose = require('mongoose');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
};

const debugOrders = async () => {
  await connectDB();
  
  try {
    // Import models
    const Order = require('./models/Order');
    const User = require('./models/User');
    const Cart = require('./models/Cart');
    
    console.log('\n🔍 ==> DEBUGGING ORDERS SYSTEM <==\n');
    
    // 1. Check total orders in database
    const totalOrders = await Order.countDocuments();
    console.log('📊 Total orders in database:', totalOrders);
    
    if (totalOrders > 0) {
      // Show recent orders
      const recentOrders = await Order.find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .select('orderId userId sessionId customer status finalTotal createdAt');
      
      console.log('\n📋 Recent orders:');
      recentOrders.forEach((order, index) => {
        console.log(`${index + 1}. Order ID: ${order.orderId}`);
        console.log(`   User ID: ${order.userId || 'NULL'}`);
        console.log(`   Session ID: ${order.sessionId ? order.sessionId.substring(0, 15) + '...' : 'NULL'}`);
        console.log(`   Customer: ${order.customer.name} (${order.customer.email})`);
        console.log(`   Status: ${order.status}`);
        console.log(`   Total: ${order.finalTotal?.toLocaleString('vi-VN')}đ`);
        console.log(`   Created: ${order.createdAt}`);
        console.log('   ---');
      });
    }
    
    // 2. Check users in database
    const totalUsers = await User.countDocuments();
    console.log('\n👥 Total users in database:', totalUsers);
    
    if (totalUsers > 0) {
      const recentUsers = await User.find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .select('firstName lastName email role createdAt');
      
      console.log('\n👤 Recent users:');
      recentUsers.forEach((user, index) => {
        console.log(`${index + 1}. ${user.firstName} ${user.lastName} (${user.email}) - Role: ${user.role}`);
        console.log(`   User ID: ${user._id}`);
        console.log(`   Created: ${user.createdAt}`);
        console.log('   ---');
      });
    }
    
    // 3. Check carts in database
    const totalCarts = await Cart.countDocuments();
    console.log('\n🛒 Total carts in database:', totalCarts);
    
    if (totalCarts > 0) {
      const activeCarts = await Cart.find({ status: 'active' })
        .sort({ updatedAt: -1 })
        .limit(5)
        .select('sessionId userId totalItems totalPrice status updatedAt');
      
      console.log('\n🛍️ Active carts:');
      activeCarts.forEach((cart, index) => {
        console.log(`${index + 1}. Session: ${cart.sessionId ? cart.sessionId.substring(0, 15) + '...' : 'NULL'}`);
        console.log(`   User ID: ${cart.userId || 'Guest'}`);
        console.log(`   Items: ${cart.totalItems}`);
        console.log(`   Total: ${cart.totalPrice?.toLocaleString('vi-VN')}đ`);
        console.log(`   Updated: ${cart.updatedAt}`);
        console.log('   ---');
      });
    }
    
    // 4. Test Order creation
    console.log('\n🧪 Testing Order.createOrder() method...');
    
    const testOrderData = {
      orderId: `TEST-${Date.now()}`,
      sessionId: 'test-session-' + Date.now(),
      userId: null,
      status: 'pending',
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      customer: {
        name: 'Test Customer',
        email: 'test@example.com',
        phone: '0123456789'
      },
      shipping: {
  address: 'Test Address',
  ward: 'Test Ward', // 
  district: 'Test District',
  city: 'Hà Nội'
},
      items: [{
        productId: new mongoose.Types.ObjectId(),
        productName: 'Test Product',
        productImage: '/test.jpg',
        price: 100000,
        quantity: 1,
        color: 'Đỏ',
        size: 'M',
        subtotal: 100000
      }],
      totalItems: 1,
      totalPrice: 100000,
      shippingFee: 0,
      finalTotal: 100000,
      notes: 'Test order',
      estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    };
    
    try {
      const testOrder = await Order.createOrder(testOrderData);
      console.log('✅ Order.createOrder() works!');
      console.log('   Test Order ID:', testOrder.orderId);
      console.log('   Mongo ID:', testOrder._id);
      
      // Clean up test order
      await Order.deleteOne({ _id: testOrder._id });
      console.log('🧹 Test order cleaned up');
      
    } catch (createError) {
      console.error('❌ Order.createOrder() failed:', createError.message);
      
      // Try direct save
      try {
        const directOrder = new Order(testOrderData);
        await directOrder.save();
        console.log('✅ Direct Order save works!');
        
        // Clean up
        await Order.deleteOne({ _id: directOrder._id });
        console.log('🧹 Direct test order cleaned up');
        
      } catch (directError) {
        console.error('❌ Direct Order save also failed:', directError.message);
      }
    }
    
    // 5. Check Order model methods
    console.log('\n🔧 Checking Order model static methods...');
    
    const orderMethods = Object.getOwnPropertyNames(Order);
    console.log('Available static methods:', orderMethods.filter(method => 
      typeof Order[method] === 'function' && !method.startsWith('_')
    ));
    
    // 6. Check for any database issues
    console.log('\n🔗 Checking database connection...');
    const dbState = mongoose.connection.readyState;
    const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    console.log('Database state:', states[dbState] || 'unknown');
    
    console.log('\n✅ Debug completed!');
    
    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('1. If no orders found: Check if checkout process is calling Order.createOrder()');
    console.log('2. If orders exist but not showing: Check user/session linking in /user/orders route');
    console.log('3. If createOrder fails: Check Order model schema and validation');
    console.log('4. Check your browser network tab during checkout for API errors');
    console.log('5. Enable debug mode: Set NODE_ENV=development in .env');
    
  } catch (error) {
    console.error('❌ Debug script error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
};

// Run debug
debugOrders();