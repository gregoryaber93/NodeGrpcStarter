# Node.js gRPC Microservices Starter

A practical example of two TypeScript Node.js microservices communicating via gRPC.

## Services

### 1. User Service (Port 50051)
A gRPC server that manages user data with the following features:
- **GetUser**: Retrieve user information by ID
- **CreateUser**: Create a new user
- **ListUsers**: List all users with optional limit

### 2. Order Service (Port 50052)
A gRPC server that manages orders and communicates with User Service:
- **CreateOrder**: Create an order and fetch user details from User Service
- **GetOrder**: Retrieve order by ID
- **ListOrders**: List orders with optional user filtering

## Key Features Demonstrated

✅ **gRPC Communication**: Service-to-service RPC calls  
✅ **Protocol Buffers**: Strongly typed API contracts  
✅ **TypeScript**: Type-safe implementation  
✅ **Microservices Pattern**: Independent services with inter-service communication  
✅ **In-Memory Storage**: Simple data persistence for demo purposes  
✅ **Error Handling**: Proper gRPC status codes  

## Project Structure

```
NodeGrpcStarter/
├── user-service/
│   ├── proto/
│   │   └── user.proto          # User service definitions
│   ├── src/
│   │   └── index.ts            # User service implementation
│   ├── package.json
│   └── tsconfig.json
└── order-service/
    ├── proto/
    │   └── order.proto         # Order service definitions
    ├── src/
    │   └── index.ts            # Order service + User client
    ├── package.json
    └── tsconfig.json
```

## Setup & Installation

### Prerequisites
- Node.js 18+ and npm installed
- Basic understanding of gRPC and microservices

### Install Dependencies

**User Service:**
```powershell
cd user-service
npm install
```

**Order Service:**
```powershell
cd order-service
npm install
```

## Running the Services

### Terminal 1 - Start User Service
```powershell
cd user-service
npm run dev
```
Expected output: `User Service running on port 50051`

### Terminal 2 - Start Order Service
```powershell
cd order-service
npm run dev
```
Expected output: `Order Service running on port 50052`

## Testing the Services

### Option 1: Using grpcurl (Recommended)

Install grpcurl: https://github.com/fullstorydev/grpcurl

**List users:**
```powershell
grpcurl -plaintext -import-path ./user-service/proto -proto user.proto localhost:50051 user.UserService/ListUsers
```

**Get a specific user (copy a user_id from ListUsers output):**
```powershell
grpcurl -plaintext -d '{\"user_id\": \"<USER_ID>\"}' -import-path ./user-service/proto -proto user.proto localhost:50051 user.UserService/GetUser
```

**Create a new user:**
```powershell
grpcurl -plaintext -d '{\"name\": \"Alice Johnson\", \"email\": \"alice@example.com\", \"phone\": \"+1122334455\"}' -import-path ./user-service/proto -proto user.proto localhost:50051 user.UserService/CreateUser
```

**Create an order:**
```powershell
grpcurl -plaintext -d '{\"user_id\": \"<USER_ID>\", \"items\": [{\"product_id\": \"P001\", \"product_name\": \"Laptop\", \"quantity\": 1, \"price\": 999.99}, {\"product_id\": \"P002\", \"product_name\": \"Mouse\", \"quantity\": 2, \"price\": 29.99}]}' -import-path ./order-service/proto -proto order.proto localhost:50052 order.OrderService/CreateOrder
```

**List orders:**
```powershell
grpcurl -plaintext -d '{\"limit\": 10}' -import-path ./order-service/proto -proto order.proto localhost:50052 order.OrderService/ListOrders
```

### Option 2: Create a Simple Client

Create a test file `test-client.ts` in either service directory:

```typescript
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';

const PROTO_PATH = path.join(__dirname, '../proto/user.proto');
const packageDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const userProto = grpc.loadPackageDefinition(packageDef).user as any;
const client = new userProto.UserService('localhost:50051', grpc.credentials.createInsecure());

// List users
client.ListUsers({ limit: 5 }, (error: any, response: any) => {
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Users:', response.users);
  }
});
```

Run with: `npx ts-node test-client.ts`

## How It Works

1. **User Service** starts on port 50051 and seeds 2 demo users
2. **Order Service** starts on port 50052 and connects to User Service
3. When you create an order:
   - Order Service receives the request
   - It makes a gRPC call to User Service to fetch user details
   - Combines order data with user information
   - Stores and returns the complete order

This demonstrates real microservice communication where services are independently deployable but work together.

## Building for Production

```powershell
# Build User Service
cd user-service
npm run build
npm start

# Build Order Service
cd order-service
npm run build
npm start
```

## Important Concepts Covered

- **Proto Files**: Define service contracts and message types
- **gRPC Server**: Implements service methods defined in proto
- **gRPC Client**: Makes RPC calls to other services
- **Inter-Service Communication**: Order Service → User Service
- **Error Handling**: Proper gRPC status codes (NOT_FOUND, INTERNAL)
- **Async/Await**: Modern async patterns for service calls

## Next Steps

- Add database persistence (PostgreSQL, MongoDB)
- Implement authentication & authorization
- Add health checks and monitoring
- Use service mesh (Istio, Linkerd) for production
- Add unit and integration tests
- Implement circuit breaker pattern
- Add API Gateway for REST → gRPC translation

## Troubleshooting

**Error: User Service not found**
- Ensure User Service is running on port 50051 before starting Order Service

**TypeScript errors**
- Run `npm install` in both service directories
- Check that Node.js version is 18+

**Port already in use**
- Change ports in the respective `index.ts` files

## License

MIT
