import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROTO_PATH = path.join(__dirname, '../proto/fileupload.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const fileUploadProto = grpc.loadPackageDefinition(packageDefinition).fileupload as any;

function testUploadFile() {
  const client = new fileUploadProto.FileUploadService(
    'localhost:50054',
    grpc.credentials.createInsecure()
  );

  const call = client.UploadFile((error: Error | null, response: any) => {
    if (error) {
      console.error('Error:', error);
      return;
    }
    
    console.log('\n=== Upload Result ===');
    console.log('Success:', response.success);
    console.log('Message:', response.message);
    console.log('File ID:', response.file_id);
    console.log('Total Bytes:', response.total_bytes);
    console.log('Chunks Received:', response.chunks_received);
    console.log('====================\n');
  });

  // Simulate uploading a file in chunks
  const filename = 'test-document.txt';
  const fileContent = 'This is a test file content that will be split into chunks and uploaded via gRPC client streaming. '.repeat(50);
  const buffer = Buffer.from(fileContent);
  
  const CHUNK_SIZE = 1024; // 1KB chunks
  const totalChunks = Math.ceil(buffer.length / CHUNK_SIZE);

  console.log(`Uploading file: ${filename}`);
  console.log(`Total size: ${buffer.length} bytes`);
  console.log(`Chunk size: ${CHUNK_SIZE} bytes`);
  console.log(`Total chunks: ${totalChunks}\n`);

  let offset = 0;
  let chunkNumber = 1;

  const uploadInterval = setInterval(() => {
    if (offset >= buffer.length) {
      clearInterval(uploadInterval);
      console.log('\nAll chunks sent. Closing stream...');
      call.end();
      return;
    }

    const end = Math.min(offset + CHUNK_SIZE, buffer.length);
    const chunkContent = buffer.slice(offset, end);

    const chunk = {
      filename: filename,
      content: chunkContent,
      chunk_number: chunkNumber,
      total_chunks: totalChunks,
    };

    console.log(`Sending chunk ${chunkNumber}/${totalChunks} (${chunkContent.length} bytes)`);
    call.write(chunk);

    offset = end;
    chunkNumber++;
  }, 100);
}

testUploadFile();
