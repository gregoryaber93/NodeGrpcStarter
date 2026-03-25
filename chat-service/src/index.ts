import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';
import { fileURLToPath } from 'url';

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

const chatClients = new Set<grpc.ServerDuplexStream<any, any>>();

function chat(call: grpc.ServerDuplexStream<any, any>) {
  chatClients.add(call);

  call.on('data', (message: any) => {
    const timestamp = new Date(parseInt(message.timestamp));
    switch (message.type) {
      case 1: // JOIN
        console.log(`[${timestamp.toLocaleTimeString()}] ${message.username} joined the chat`);
        break;
      case 2: // LEAVE
        console.log(`[${timestamp.toLocaleTimeString()}] ${message.username} left the chat`);
        break;
      case 3: // TYPING
        console.log(`[${timestamp.toLocaleTimeString()}] ${message.username} is typing...`);
        break;
      default: // TEXT
        console.log(`[${timestamp.toLocaleTimeString()}] ${message.username}: ${message.message}`);
    }

    chatClients.forEach((client) => {
      try {
        client.write(message);
      } catch (error) {
        console.error('Error broadcasting message:', error);
      }
    });
  });

  call.on('end', () => {
    console.log('Client disconnected from chat');
    chatClients.delete(call);
    call.end();
  });

  call.on('error', (error: Error) => {
    console.error('Chat stream error:', error);
    chatClients.delete(call);
  });
}

function main() {
  const server = new grpc.Server();
  
  server.addService(chatProto.ChatService.service, {
    Chat: chat,
  });

  const PORT = '50055';
  server.bindAsync(
    `0.0.0.0:${PORT}`,
    grpc.ServerCredentials.createInsecure(),
    (error, port) => {
      if (error) {
        console.error('Failed to bind server:', error);
        return;
      }
      console.log(`Chat Service running on port ${port}`);
      console.log(`Active clients: ${chatClients.size}\n`);
    }
  );
}

main();
