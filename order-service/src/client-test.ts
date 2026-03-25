import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ORDER_PROTO_PATH = path.join(__dirname, '../proto/order.proto');
const USER_PROTO_PATH = path.join(__dirname, '../../user-service/proto/user.proto');

const orderPackageDef = protoLoader.loadSync(ORDER_PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const userPackageDef = protoLoader.loadSync(USER_PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const orderProto = grpc.loadPackageDefinition(orderPackageDef).order as any;
const userProto = grpc.loadPackageDefinition(userPackageDef).user as any;

const orderClient = new orderProto.OrderService(
  'localhost:50052',
  grpc.credentials.createInsecure()
);

const userClient = new userProto.UserService(
  'localhost:50051',
  grpc.credentials.createInsecure()
);

console.log('🎬 Order Service Streaming Demo\n');
console.log('This demonstrates:');
console.log('1. Creating an order (Unary RPC)');
console.log('2. Tracking order status in real-time (Server Streaming)\n');

// Step 1: Get a user first
userClient.listUsers({ limit: 1 }, (error: any, response: any) => {
  if (error) {
    console.error('❌ Error fetching users:', error.message);
    process.exit(1);
  }

  if (response.users.length === 0) {
    console.error('❌ No users found. Please start user-service first.');
    process.exit(1);
  }

  const user = response.users[0];
  console.log(`👤 Using user: ${user.name} (${user.user_id})\n`);

  // Step 2: Create an order
  const orderRequest = {
    user_id: user.user_id,
    items: [
      {
        product_id: 'prod-001',
        product_name: 'Laptop',
        quantity: 1,
        price: 1299.99,
      },
      {
        product_id: 'prod-002',
        product_name: 'Wireless Mouse',
        quantity: 2,
        price: 29.99,
      },
    ],
  };

  console.log('📦 Creating order...\n');

  orderClient.createOrder(orderRequest, (error: any, order: any) => {
    if (error) {
      console.error('❌ Error creating order:', error.message);
      process.exit(1);
    }

    console.log(`✅ Order created successfully!`);
    console.log(`   Order ID: ${order.order_id}`);
    console.log(`   Status: ${order.status}`);
    console.log(`   Total: $${order.total_amount.toFixed(2)}`);
    console.log(`   Items: ${order.items.length}\n`);

    // Step 3: Start tracking order status in real-time
    console.log('📍 Starting real-time order tracking...\n');
    console.log('═══════════════════════════════════════════════════════════\n');

    const trackingCall = orderClient.trackOrderStatus({ order_id: order.order_id });

    trackingCall.on('data', (update: any) => {
      const time = new Date(update.timestamp).toLocaleTimeString();
      console.log(`🚚 [${update.status}] at ${time}`);
      console.log(`   📍 Location: ${update.location}`);
      console.log(`   📝 ${update.description}\n`);
    });

    trackingCall.on('end', () => {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('\n✅ Order tracking completed - Order delivered!');
      console.log('🎉 Stream ended successfully\n');
      process.exit(0);
    });

    trackingCall.on('error', (error: any) => {
      console.error('\n❌ Tracking error:', error.message);
      process.exit(1);
    });
  });
});

console.log('Press Ctrl+C to stop...\n');
