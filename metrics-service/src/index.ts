import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROTO_PATH = path.join(__dirname, '../proto/metrics.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const metricsProto = grpc.loadPackageDefinition(packageDefinition).metrics as any;

function collectMetrics(call: grpc.ServerReadableStream<any, any>, callback: grpc.sendUnaryData<any>) {
  const metrics: any[] = [];
  call.on('data', (metricData: any) => {
    metrics.push(metricData);
  });

  call.on('end', () => {
    if (metrics.length === 0) {
      callback(null, {metric_name: 'unknown', total_points: 0, min_value: 0, 
        max_value: 0, avg_value: 0, sum_value: 0 });
      return;
    }
    const metricName = metrics[0].metric_name;
    const values = metrics.map(m => m.value);
    const sum = values.reduce((a, b) => a + b, 0);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = sum / values.length;

    const summary = { metric_name: metricName, total_points: metrics.length, 
      min_value: min, max_value: max, avg_value: avg, sum_value: sum, };
    callback(null, summary);
  });

  call.on('error', (error: Error) => {
    callback(error, null);
  });
}

function main() {
  const server = new grpc.Server();
  
  server.addService(metricsProto.MetricsService.service, {
    CollectMetrics: collectMetrics,
  });

  const PORT = '50053';
  server.bindAsync(
    `0.0.0.0:${PORT}`,
    grpc.ServerCredentials.createInsecure(),
    (error, port) => {
      if (error) {
        console.error('Failed to bind server:', error);
        return;
      }
      console.log(`Metrics Service running on port ${port}`);
    }
  );
}

main();
