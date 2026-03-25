import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as readline from 'readline';

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

function startStockTickerClient() {
  const client = new stockProto.StockTickerService(
    'localhost:50056',
    grpc.credentials.createInsecure()
  );

  console.log(`\n=== Stock Ticker Client ===`);
  console.log(`Commands:`);
  console.log(`  sub <SYMBOL>   - Subscribe to a stock (e.g., sub AAPL)`);
  console.log(`  unsub <SYMBOL> - Unsubscribe from a stock`);
  console.log(`  list           - List your subscriptions`);
  console.log(`  exit           - Quit\n`);

  const call = client.StreamStockPrices();
  const subscriptions = new Set<string>();

  // Listen for updates from server
  call.on('data', (update: any) => {
    const timestamp = new Date(parseInt(update.timestamp));
    const timeStr = timestamp.toLocaleTimeString();

    switch (update.type) {
      case 0: // PRICE
        const changeSymbol = update.change >= 0 ? '+' : '';
        const changeColor = update.change >= 0 ? '📈' : '📉';
        console.log(
          `${changeColor} [${timeStr}] ${update.symbol}: $${update.price.toFixed(2)} ` +
          `(${changeSymbol}${update.change.toFixed(2)}, ${changeSymbol}${update.change_percent.toFixed(2)}%) ` +
          `Vol: ${parseInt(update.volume).toLocaleString()}`
        );
        break;
      case 1: // SUBSCRIBED
        console.log(`✓ Subscribed to ${update.symbol}`);
        break;
      case 2: // UNSUBSCRIBED
        console.log(`✓ Unsubscribed from ${update.symbol}`);
        break;
      case 3: // PONG
        console.log(`🏓 Pong received at ${timeStr}`);
        break;
    }
  });

  call.on('end', () => {
    console.log('\n*** Disconnected from stock ticker ***');
    process.exit(0);
  });

  call.on('error', (error: Error) => {
    console.error('Stock ticker error:', error);
    process.exit(1);
  });

  // Setup readline for user input
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> ',
  });

  rl.prompt();

  rl.on('line', (input: string) => {
    const parts = input.trim().split(/\s+/);
    const command = parts[0].toLowerCase();

    switch (command) {
      case 'sub':
      case 'subscribe':
        if (parts.length < 2) {
          console.log('Usage: sub <SYMBOL>');
          break;
        }
        const subSymbol = parts[1].toUpperCase();
        subscriptions.add(subSymbol);
        call.write({
          type: 0, // SUBSCRIBE
          symbol: subSymbol,
        });
        break;

      case 'unsub':
      case 'unsubscribe':
        if (parts.length < 2) {
          console.log('Usage: unsub <SYMBOL>');
          break;
        }
        const unsubSymbol = parts[1].toUpperCase();
        subscriptions.delete(unsubSymbol);
        call.write({
          type: 1, // UNSUBSCRIBE
          symbol: unsubSymbol,
        });
        break;

      case 'list':
        if (subscriptions.size === 0) {
          console.log('No active subscriptions');
        } else {
          console.log(`Active subscriptions: ${Array.from(subscriptions).join(', ')}`);
        }
        break;

      case 'ping':
        call.write({
          type: 2, // PING
          symbol: '',
        });
        break;

      case 'exit':
      case 'quit':
        console.log('Closing connection...');
        call.end();
        rl.close();
        return;

      default:
        if (input.trim()) {
          console.log('Unknown command. Type "sub <SYMBOL>" to subscribe to a stock.');
        }
    }

    rl.prompt();
  });

  // Auto-subscribe to a few stocks for demo
  setTimeout(() => {
    console.log('\nAuto-subscribing to AAPL and TSLA for demo...\n');
    ['AAPL', 'TSLA'].forEach((symbol) => {
      subscriptions.add(symbol);
      call.write({
        type: 0, // SUBSCRIBE
        symbol: symbol,
      });
    });
  }, 500);
}

startStockTickerClient();
