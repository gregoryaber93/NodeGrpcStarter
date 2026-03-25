import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as crypto from 'crypto';
import * as fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROTO_PATH = path.join(__dirname, '../proto/fileupload.proto');
const UPLOAD_DIR = path.join(__dirname, '../uploads');

// Create uploads directory if it doesn't exist
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const fileUploadProto = grpc.loadPackageDefinition(packageDefinition).fileupload as any;

// Client streaming: Receive file chunks from client
function uploadFile(call: grpc.ServerReadableStream<any, any>, callback: grpc.sendUnaryData<any>) {
  const chunks: Buffer[] = [];
  let filename = '';
  let totalChunks = 0;
  let chunksReceived = 0;
  let totalBytes = 0;

  call.on('data', (chunk: any) => {
    if (!filename) {
      filename = chunk.filename;
      totalChunks = chunk.total_chunks;
    }

    const buffer = Buffer.from(chunk.content);
    chunks.push(buffer);
    chunksReceived++;
    totalBytes += buffer.length;

    console.log(`Received chunk ${chunk.chunk_number}/${totalChunks} (${buffer.length} bytes) of ${filename}`);
  });

  call.on('end', () => {
    try {
      // Combine all chunks
      const fileBuffer = Buffer.concat(chunks);
      const fileId = crypto.randomUUID();
      const filePath = path.join(UPLOAD_DIR, `${fileId}_${filename}`);

      // Write file to disk
      fs.writeFileSync(filePath, fileBuffer);

      console.log(`\n✓ File saved successfully: ${filePath}`);
      console.log(`  Total size: ${totalBytes} bytes`);
      console.log(`  Chunks received: ${chunksReceived}/${totalChunks}\n`);

      callback(null, {
        success: true,
        message: 'File uploaded successfully',
        file_id: fileId,
        total_bytes: totalBytes,
        chunks_received: chunksReceived,
      });
    } catch (error) {
      console.error('Error saving file:', error);
      callback(null, {
        success: false,
        message: `Error: ${error}`,
        file_id: '',
        total_bytes: totalBytes,
        chunks_received: chunksReceived,
      });
    }
  });

  call.on('error', (error: Error) => {
    console.error('Error receiving file chunks:', error);
    callback(error, null);
  });
}

function main() {
  const server = new grpc.Server();
  
  server.addService(fileUploadProto.FileUploadService.service, {
    UploadFile: uploadFile,
  });

  const PORT = '50054';
  server.bindAsync(
    `0.0.0.0:${PORT}`,
    grpc.ServerCredentials.createInsecure(),
    (error, port) => {
      if (error) {
        console.error('Failed to bind server:', error);
        return;
      }
      console.log(`File Upload Service running on port ${port}`);
      console.log(`Upload directory: ${UPLOAD_DIR}\n`);
    }
  );
}

main();
