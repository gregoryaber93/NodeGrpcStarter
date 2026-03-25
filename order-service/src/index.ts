import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath, resolve } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ORDER_PROTO_PATH = path.join(__dirname, '../proto/order.proto');
const USER_PROTO_PATH = path.join(__dirname, '../../user-service/proto/user.proto');

// Load proto files
const orderPackageDef = protoLoader.loadSync(ORDER_PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const orderProto = grpc.loadPackageDefinition(orderPackageDef).order as any;

const userPackageDef = protoLoader.loadSync(USER_PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const userProto = grpc.loadPackageDefinition(userPackageDef).user as any;

const userClient = new userProto.UserService(
  'localhost:50051',
  grpc.credentials.createInsecure()
);

userClient.GetUser({ user_id: '22b576f4-553d-4329-9964-17e4f36a8356' }, 
  (error: any, response: any) => {
      if (error) {
        console.error('Error fetching user:', error);
      } else {
        console.log('User fetched successfully:', response);
      }
});


const getUserFromService = (userId: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    userClient.GetUser({ user_id: userId }, (error: any, response: any) => {
      if (error) {
        reject(error);
      } else {
        resolve(response);
      }
    });
  });
};

getUserFromService('22b576f4-553d-4329-9964-17e4f36a8356')
    .then(user => {
      console.log('User fetched successfully:', user);
    })
    .catch(error => {
      console.error('Error fetching user:', error);
    });


// In-memory order storage
interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
}

interface Order {
  order_id: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  items: OrderItem[];
  total_amount: number;
  status: string;
  created_at: string;
}

const orders: Map<string, Order> = new Map();

// Event emitter for order status updates
const statusEmitter = new EventEmitter();

interface StatusUpdate {
  update_id: string;
  order_id: string;
  status: string;
  location: string;
  description: string;
  timestamp: string;
}

// Emit status update
const emitStatusUpdate = (orderId: string, status: string, location: string, description: string) => {
  const update: StatusUpdate = {
    update_id: uuidv4(),
    order_id: orderId,
    status,
    location,
    description,
    timestamp: new Date().toISOString(),
  };
  
  console.log(`📦 Order Update: [${status}] ${description}`);
  statusEmitter.emit('statusUpdate', update);
};

// Simulate order status progression
const simulateOrderProgress = (orderId: string) => {
  const statuses = [
    { status: 'PROCESSING', location: 'Warehouse', description: 'Order is being prepared', delay: 3000 },
    { status: 'SHIPPED', location: 'Distribution Center', description: 'Order has been shipped', delay: 5000 },
    { status: 'IN_TRANSIT', location: 'City Hub', description: 'Package is in transit', delay: 4000 },
    { status: 'OUT_FOR_DELIVERY', location: 'Local Delivery', description: 'Out for delivery', delay: 3000 },
    { status: 'DELIVERED', location: 'Customer Address', description: 'Order delivered successfully', delay: 2000 },
  ];
  
  let currentIndex = 0;
  
  const updateStatus = () => {
    if (currentIndex < statuses.length) {
      const { status, location, description, delay } = statuses[currentIndex];
      const order = orders.get(orderId);
      
      if (order) {
        order.status = status;
        emitStatusUpdate(orderId, status, location, description);
        currentIndex++;
        
        if (currentIndex < statuses.length) {
          setTimeout(updateStatus, delay);
        }
      }
    }
  };
  
  // Start the simulation after initial delay
  setTimeout(updateStatus, 2000);
};

// gRPC service implementation
const createOrder = async (call: any, callback: any) => {
  const { user_id, items } = call.request;
  console.log(`CreateOrder called for user_id: ${user_id}`);

  try {
    // Fetch user information from User Service
    const user = await getUserFromService(user_id);

    // Calculate total amount
    const total_amount = items.reduce(
      (sum: number, item: OrderItem) => sum + item.price * item.quantity,
      0
    );

    const order: Order = {
      order_id: uuidv4(),
      user_id,
      user_name: user.name,
      user_email: user.email,
      items,
      total_amount,
      status: 'PENDING',
      created_at: new Date().toISOString(),
    };

    orders.set(order.order_id, order);
    console.log(`Order created: ${order.order_id}`);
    
    // Emit initial status
    emitStatusUpdate(order.order_id, 'PENDING', 'Order System', 'Order placed successfully');
    
    // Start simulating order progress
    simulateOrderProgress(order.order_id);
    
    callback(null, order);
  } catch (error: any) {
    console.error('Error creating order:', error);
    callback({
      code: grpc.status.INTERNAL,
      message: `Failed to create order: ${error.message}`,
    });
  }
};

const getOrder = async (call: any, callback: any) => {
  const orderId = call.request.order_id;
  console.log(`GetOrder called for order_id: ${orderId}`);

  const order = orders.get(orderId);
  if (order) {
    callback(null, order);
  } else {
    callback({
      code: grpc.status.NOT_FOUND,
      message: `Order with ID ${orderId} not found`,
    });
  }
};

const listOrders = async (call: any, callback: any) => {
  const { user_id, limit = 10 } = call.request;
  console.log(`ListOrders called for user_id: ${user_id || 'all'}`);

  let orderList = Array.from(orders.values());

  if (user_id) {
    orderList = orderList.filter((order) => order.user_id === user_id);
  }

  orderList = orderList.slice(0, limit);
  callback(null, { orders: orderList });
};

// Server Streaming: Track order status updates in real-time
const trackOrderStatus = (call: any) => {
  const orderId = call.request.order_id;
  console.log(`🔍 TrackOrderStatus started for order: ${orderId}`);

  const order = orders.get(orderId);
  if (!order) {
    call.destroy({
      code: grpc.status.NOT_FOUND,
      message: `Order ${orderId} not found`,
    });
    return;
  }

  // Send initial status
  const initialUpdate: StatusUpdate = {
    update_id: uuidv4(),
    order_id: orderId,
    status: order.status,
    location: 'Order System',
    description: `Tracking started for order ${orderId}`,
    timestamp: new Date().toISOString(),
  };
  call.write(initialUpdate);

  // Listen for status updates
  const statusListener = (update: StatusUpdate) => {
    if (update.order_id === orderId) {
      call.write(update);
      
      // End stream when delivered
      if (update.status === 'DELIVERED') {
        setTimeout(() => {
          call.end();
        }, 1000);
      }
    }
  };

  statusEmitter.on('statusUpdate', statusListener);

  // Cleanup on client disconnect
  call.on('cancelled', () => {
    console.log(`❌ Client cancelled TrackOrderStatus for order: ${orderId}`);
    statusEmitter.removeListener('statusUpdate', statusListener);
  });

  call.on('error', (error: any) => {
    console.error('Stream error:', error);
    statusEmitter.removeListener('statusUpdate', statusListener);
  });
};

// Start gRPC server
const startServer = () => {
  const server = new grpc.Server();

  server.addService(orderProto.OrderService.service, {
    createOrder,
    getOrder,
    listOrders,
    trackOrderStatus,
  });

  const PORT = '50052';
  server.bindAsync(
    `0.0.0.0:${PORT}`,
    grpc.ServerCredentials.createInsecure(),
    (error, port) => {
      if (error) {
        console.error('Failed to start server:', error);
        return;
      }
      console.log(`🚀 Order Service running on port ${port}`);
      console.log(`📦 Order tracking streaming available on TrackOrderStatus`);
      console.log('Connected to User Service on port 50051');
    }
  );

  getUserFromService('22b576f4-553d-4329-9964-17e4f36a8356')
    .then(user => {
      console.log('User fetched successfully:', user);
    })
    .catch(error => {
      console.error('Error fetching user:', error);
    });
};

startServer();
