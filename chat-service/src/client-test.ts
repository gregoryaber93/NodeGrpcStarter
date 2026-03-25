import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as crypto from 'crypto';
import * as readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROTO_PATH = path.join(__dirname, '../proto/chat.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const chatProto = grpc.loadPackageDefinition(packageDefinition).chat as any;

function startChatClient() {
  const client = new chatProto.ChatService(
    'localhost:50055',
    grpc.credentials.createInsecure()
  );
  const userId = crypto.randomUUID();
  const username = `User_${userId.substring(0, 6)}`;
  
  const call = client.Chat();
  
  call.on('data', (message: any) => {
    const timestamp = new Date(parseInt(message.timestamp));
    const timeStr = timestamp.toLocaleTimeString();
    if (message.user_id === userId) {
      return;
    }
    switch (message.type) {
      case 1: // JOIN
        console.log(`[${timeStr}] *** ${message.username} joined the chat ***`);
        break;
      case 2: // LEAVE
        console.log(`[${timeStr}] *** ${message.username} left the chat ***`);
        break;
      case 3: // TYPING
        console.log(`[${timeStr}] ${message.username} is typing...`);
        break;
      default: // TEXT
        console.log(`[${timeStr}] ${message.username}: ${message.message}`);
    }
  });

  call.on('end', () => {
    process.exit(0);
  });

  call.on('error', (error: Error) => {
    process.exit(1);
  });


  call.write({
    user_id: userId,
    username: username,
    message: '',
    timestamp: Date.now().toString(),
    type: 1, // JOIN
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '',
  });

  rl.on('line', (input: string) => {
    if (input.trim() === 'exit') {
      call.write({
        user_id: userId,
        username: username,
        message: '',
        timestamp: Date.now().toString(),
        type: 2, // LEAVE
      });
      
      setTimeout(() => {
        call.end();
        rl.close();
      }, 100);
      return;
    }

    if (input.trim()) {
      call.write({
        user_id: userId,
        username: username,
        message: input.trim(),
        timestamp: Date.now().toString(),
        type: 0, // TEXT
      });
    }
  });

  let typingTimer: NodeJS.Timeout | undefined;
  let isTyping = false;
  
  process.stdin.on('keypress', (str, key) => {
    if (key && key.name !== 'return' && key.name !== 'enter') {
      clearTimeout(typingTimer);
      
      if (!isTyping) {
        isTyping = true;
        call.write({
          user_id: userId,
          username: username,
          message: '',
          timestamp: Date.now().toString(),
          type: 3, // TYPING
        });
      }
      
      typingTimer = setTimeout(() => {
        isTyping = false;
      }, 2000);
    }
  });
  
  rl.on('line', () => {
    clearTimeout(typingTimer);
    isTyping = false;
  });
}

startChatClient();
