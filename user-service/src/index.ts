import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROTO_PATH = path.join(__dirname, '../proto/user.proto');

// Load proto file
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const userProto = grpc.loadPackageDefinition(packageDefinition).user as any;

// In-memory user storage
interface User {
  user_id: string;
  name: string;
  email: string;
  phone: string;
  created_at: string;
}

interface ActivityEvent {
  event_id: string;
  user_id: string;
  user_name: string;
  event_type: string;
  description: string;
  timestamp: string;
}

const users: Map<string, User> = new Map();

// Event emitter for user activity
const activityEmitter = new EventEmitter();

// Emit activity event
const emitActivity = (userId: string, eventType: string, description: string) => {
  const user = users.get(userId);
  const event: ActivityEvent = {
    event_id: uuidv4(),
    user_id: userId,
    user_name: user?.name || 'Unknown',
    event_type: eventType,
    description,
    timestamp: new Date().toISOString(),
  };
  
  console.log(`📢 Activity: [${eventType}] ${description}`);
  activityEmitter.emit('activity', event);
};

// Seed some initial users
const seedUsers = () => {
  const user1: User = {
    user_id: uuidv4(),
    name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+1234567890',
    created_at: new Date().toISOString(),
  };
  const user2: User = {
    user_id: uuidv4(),
    name: 'Jane Smith',
    email: 'jane.smith@example.com',
    phone: '+1987654321',
    created_at: new Date().toISOString(),
  };
  users.set(user1.user_id, user1);
  users.set(user2.user_id, user2);
  console.log('Seeded users:', Array.from(users.values()));
  
  // Simulate random user activity
  // simulateUserActivity();
};

// Simulate random user activity for demo
const simulateUserActivity = () => {
  const activities = [
    'logged in',
    'updated profile',
    'changed password',
    'uploaded avatar',
    'viewed dashboard',
    'downloaded report',
  ];
  
  setInterval(() => {
    const userArray = Array.from(users.values());
    if (userArray.length === 0) return;
    
    const randomUser = userArray[Math.floor(Math.random() * userArray.length)];
    const randomActivity = activities[Math.floor(Math.random() * activities.length)];
    
    emitActivity(randomUser.user_id, 'action_performed', `${randomUser.name} ${randomActivity}`);
  }, 3000); // Every 3 seconds
};

// gRPC service implementation
const getUser = (call: any, callback: any) => {
  const userId = call.request.user_id;
  console.log(`GetUser called for user_id: ${userId}`);

  const user = users.get(userId);
  if (user) {
    emitActivity(userId, 'user_viewed', `User profile viewed: ${user.name}`);
    callback(null, user);
  } else {
    callback({
      code: grpc.status.NOT_FOUND,
      message: `User with ID ${userId} not found`,
    });
  }
};

const createUser = (call: any, callback: any) => {
  const { name, email, phone } = call.request;
  console.log(`CreateUser called: ${name}, ${email}`);

  const user: User = {
    user_id: uuidv4(),
    name,
    email,
    phone,
    created_at: new Date().toISOString(),
  };

  users.set(user.user_id, user);
  emitActivity(user.user_id, 'user_created', `New user created: ${name} (${email})`);
  callback(null, user);
};

const listUsers = (call: any, callback: any) => {
  const limit = call.request.limit || 10;
  console.log(`ListUsers called with limit: ${limit}`);

  const userList = Array.from(users.values()).slice(0, limit);
  callback(null, { users: userList });
};

// Server Streaming: Watch user activity in real-time
const watchUserActivity = (call: any) => {
  const userId = call.request.user_id;

  const initialEvent: ActivityEvent = {
    event_id: uuidv4(),
    user_id: 'system',
    user_name: 'System',
    event_type: 'connection_established',
    description: userId 
      ? `Monitoring activity for user: ${userId}` 
      : 'Monitoring activity for all users',
    timestamp: new Date().toISOString(),
  };
  call.write(initialEvent);

  const activityListener = (event: ActivityEvent) => {
    if (!userId || event.user_id === userId) {
      call.write(event);
    }
  };

  activityEmitter.on('activity', activityListener);
  call.on('cancelled', () => {
    activityEmitter.removeListener('activity', activityListener);
  });

  call.on('error', (error: any) => {
    console.error('Stream error:', error);
    activityEmitter.removeListener('activity', activityListener);
  });
};

// Start gRPC server
const startServer = () => {
  const server = new grpc.Server();

  server.addService(userProto.UserService.service, {
    getUser,
    createUser,
    listUsers,
    watchUserActivity,
  });

  const PORT = '50051';
  server.bindAsync(
    `0.0.0.0:${PORT}`,
    grpc.ServerCredentials.createInsecure(),
    (error, port) => {
      if (error) {
        console.error('Failed to start server:', error);
        return;
      }
      console.log(`🚀 User Service running on port ${port}`);
      seedUsers();
    }
  );
};

startServer();
