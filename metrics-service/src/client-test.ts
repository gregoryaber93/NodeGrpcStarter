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

function testCollectMetrics() {
  const client = new metricsProto.MetricsService(
    'localhost:50053',
    grpc.credentials.createInsecure()
  );

  const call = client.CollectMetrics((error: Error | null, response: any) => {
    if (error) {
      console.error('Error:', error);
      return;
    }
    console.log('Server Response. Metric Summary:', response);
  });

  const cpuMetrics = [
    { value: 45.2, timestamp: Date.now() },
    { value: 52.8, timestamp: Date.now() + 1000 },
    { value: 38.5, timestamp: Date.now() + 2000 },
    { value: 61.3, timestamp: Date.now() + 3000 },
    { value: 47.9, timestamp: Date.now() + 4000 },
    { value: 55.1, timestamp: Date.now() + 5000 },
  ];
  
  cpuMetrics.forEach((metric, index) => {
    setTimeout(() => {
      const metricData = {
        metric_name: 'cpu_usage_percent',
        value: metric.value,
        timestamp: metric.timestamp.toString(),
        labels: {
          host: 'server-01',
          core: 'cpu-0',
        },
      };
      
      call.write(metricData);

      if (index === cpuMetrics.length - 1) {
        setTimeout(() => {
          call.end();
        }, 500);
      }
    }, index * 300);
  });
}

testCollectMetrics();
