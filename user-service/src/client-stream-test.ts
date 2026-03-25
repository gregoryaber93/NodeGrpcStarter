import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROTO_PATH = path.join(__dirname, '../proto/user.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const userProto = grpc.loadPackageDefinition(packageDefinition).user as any;

const client = new userProto.UserService(
  'localhost:50051',
  grpc.credentials.createInsecure()
);

console.log('🎬 Starting to watch user activity...\n');
console.log('This demo shows Server Streaming in action!');
console.log('The server will stream user activity events in real-time.\n');

// Test Server Streaming: Watch all user activity
const call: grpc.ClientReadableStream<any> = client.watchUserActivity({ user_id: '' }); // empty = watch all users

call.on('data', (event: any) => {
  const time = new Date(event.timestamp).toLocaleTimeString();
  console.log(`\n⚡ [${event.event_type}] at ${time}`);
  console.log(`   👤 User: ${event.user_name} (${event.user_id})`);
  console.log(`   📝 ${event.description}`);
});

call.on('end', () => {
  console.log('\n✅ Stream ended');
  process.exit(0);
});

call.on('error', (error: any) => {
  console.error('\n❌ Stream error:', error.message);
  process.exit(1);
});

console.log('📡 Listening for activity events...');
console.log('Press Ctrl+C to stop watching...\n');

// Test creating a user to see the activity in real-time
setTimeout(() => {
  console.log('\n🧪 Creating a test user to demonstrate activity tracking...\n');
  client.createUser(
    { name: 'Alice Johnson', email: 'alice@example.com', phone: '+1555123456' },
    (error: any, response: any) => {
      if (error) {
        console.error('Error creating user:', error);
      } else {
        console.log(`✨ User created: ${response.name} (ID: ${response.user_id})`);
        console.log('   You should see this create event in the activity stream above!\n');
      }
    }
  );
}, 5000);

// Test getting a user
setTimeout(() => {
  client.listUsers({ limit: 1 }, (error: any, response: any) => {
    if (!error && response.users.length > 0) {
      const userId = response.users[0].user_id;
      console.log('\n🧪 Fetching user profile to trigger view event...\n');
      
      client.getUser({ user_id: userId }, (err: any, user: any) => {
        if (!err) {
          console.log(`👁️  Viewed user: ${user.name}`);
          console.log('   Watch for the "user_viewed" event in the stream!\n');
        }
      });
    }
  });
}, 10000);
