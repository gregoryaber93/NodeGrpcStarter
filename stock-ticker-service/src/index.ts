import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROTO_PATH = path.join(__dirname, '../proto/stock.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const stockProto = grpc.loadPackageDefinition(packageDefinition).stock as any;

// Mock stock data with initial prices
const stockData = new Map<string, any>([
  ['AAPL', { price: 175.43, change: 2.15, change_percent: 1.24, volume: 52430000 }],
  ['GOOGL', { price: 142.65, change: -1.28, change_percent: -0.89, volume: 28540000 }],
  ['MSFT', { price: 378.91, change: 3.52, change_percent: 0.94, volume: 31250000 }],
  ['AMZN', { price: 151.23, change: 1.67, change_percent: 1.12, volume: 45780000 }],
  ['TSLA', { price: 242.84, change: -5.42, change_percent: -2.18, volume: 98320000 }],
]);

// Track client subscriptions
const clientSubscriptions = new Map<grpc.ServerDuplexStream<any, any>, Set<string>>();

// Simulate stock price updates
function simulateStockUpdates() {
  setInterval(() => {
    stockData.forEach((data, symbol) => {
      // Random price change between -2% and +2%
      const changePercent = (Math.random() - 0.5) * 4;
      const priceChange = data.price * (changePercent / 100);
      
      data.price = parseFloat((data.price + priceChange).toFixed(2));
      data.change = parseFloat(priceChange.toFixed(2));
      data.change_percent = parseFloat(changePercent.toFixed(2));
      data.volume += Math.floor(Math.random() * 100000);

      // Send updates to subscribed clients
      clientSubscriptions.forEach((subscriptions, call) => {
        if (subscriptions.has(symbol)) {
          try {
            call.write({
              symbol: symbol,
              price: data.price,
              change: data.change,
              change_percent: data.change_percent,
              volume: data.volume.toString(),
              timestamp: Date.now().toString(),
              type: 0, // PRICE
            });
          } catch (error) {
            console.error(`Error sending update to client:`, error);
          }
        }
      });
    });
  }, 2000); // Update every 2 seconds
}

// Bidirectional streaming: Stock ticker
function streamStockPrices(call: grpc.ServerDuplexStream<any, any>) {
  console.log('New client connected to stock ticker');
  const subscriptions = new Set<string>();
  clientSubscriptions.set(call, subscriptions);

  call.on('data', (request: any) => {
    const symbol = request.symbol.toUpperCase();

    switch (request.type) {
      case 0: // SUBSCRIBE
        if (!stockData.has(symbol)) {
          console.log(`Client requested unknown symbol: ${symbol}`);
          return;
        }
        
        subscriptions.add(symbol);
        console.log(`Client subscribed to ${symbol}. Active subscriptions: ${subscriptions.size}`);
        
        // Send confirmation
        call.write({
          symbol: symbol,
          price: 0,
          change: 0,
          change_percent: 0,
          volume: '0',
          timestamp: Date.now().toString(),
          type: 1, // SUBSCRIBED
        });

        // Send immediate update with current price
        const data = stockData.get(symbol);
        call.write({
          symbol: symbol,
          price: data!.price,
          change: data!.change,
          change_percent: data!.change_percent,
          volume: data!.volume.toString(),
          timestamp: Date.now().toString(),
          type: 0, // PRICE
        });
        break;

      case 1: // UNSUBSCRIBE
        subscriptions.delete(symbol);
        console.log(`Client unsubscribed from ${symbol}. Active subscriptions: ${subscriptions.size}`);
        
        call.write({
          symbol: symbol,
          price: 0,
          change: 0,
          change_percent: 0,
          volume: '0',
          timestamp: Date.now().toString(),
          type: 2, // UNSUBSCRIBED
        });
        break;

      case 2: // PING
        call.write({
          symbol: '',
          price: 0,
          change: 0,
          change_percent: 0,
          volume: '0',
          timestamp: Date.now().toString(),
          type: 3, // PONG
        });
        break;
    }
  });

  call.on('end', () => {
    console.log(`Client disconnected. Had ${subscriptions.size} subscriptions`);
    clientSubscriptions.delete(call);
    call.end();
  });

  call.on('error', (error: Error) => {
    console.error('Stock stream error:', error);
    clientSubscriptions.delete(call);
  });
}

function main() {
  const server = new grpc.Server();
  
  server.addService(stockProto.StockTickerService.service, {
    StreamStockPrices: streamStockPrices,
  });

  const PORT = '50056';
  server.bindAsync(
    `0.0.0.0:${PORT}`,
    grpc.ServerCredentials.createInsecure(),
    (error, port) => {
      if (error) {
        console.error('Failed to bind server:', error);
        return;
      }
      console.log(`Stock Ticker Service running on port ${port}`);
      console.log(`Available stocks: ${Array.from(stockData.keys()).join(', ')}\n`);
      
      // Start simulating stock updates
      simulateStockUpdates();
    }
  );
}

main();
