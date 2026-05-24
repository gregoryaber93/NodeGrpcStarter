# NodeGrpcStarter

A TypeScript Node.js gRPC microservices starter repository with examples of:

- Unary RPC
- Server streaming
- Client streaming
- Bidirectional streaming
- Service-to-service communication

## Repository Overview

This repository contains 6 independent gRPC services:

1. **user-service** (port `50051`)
   - Unary: `GetUser`, `CreateUser`, `ListUsers`
   - Server streaming: `WatchUserActivity`

2. **order-service** (port `50052`)
   - Unary: `CreateOrder`, `GetOrder`, `ListOrders`
   - Server streaming: `TrackOrderStatus`
   - Calls `user-service` via gRPC

3. **metrics-service** (port `50053`)
   - Client streaming: `CollectMetrics`

4. **file-upload-service** (port `50054`)
   - Client streaming: `UploadFile`

5. **chat-service** (port `50055`)
   - Bidirectional streaming: `Chat`

6. **stock-ticker-service** (port `50056`)
   - Bidirectional streaming: `StreamStockPrices`

## Project Structure

```text
NodeGrpcStarter/
├── user-service/
├── order-service/
├── metrics-service/
├── file-upload-service/
├── chat-service/
└── stock-ticker-service/
```

Each service contains:

- `proto/*.proto` for contract definitions
- `src/index.ts` for server implementation
- Optional `src/client-test.ts` (or `client-stream-test.ts`) demo client

## Prerequisites

- Node.js 18+
- npm

## Install Dependencies

Install dependencies per service from the repository root (`NodeGrpcStarter`):

**Bash**
```bash
for d in user-service order-service metrics-service file-upload-service chat-service stock-ticker-service; do
  (cd "$d" && npm install)
done
```

**PowerShell**
```powershell
$services = @("user-service", "order-service", "metrics-service", "file-upload-service", "chat-service", "stock-ticker-service")
foreach ($service in $services) {
  Push-Location $service
  npm install
  Pop-Location
}
```

## Run Services

Open separate terminals for each service you want to run.

### User Service

```bash
cd user-service
npm run dev
```

### Order Service

```bash
cd order-service
npm run dev
```

### Metrics Service

```bash
cd metrics-service
npm start
```

### File Upload Service

```bash
cd file-upload-service
npm start
```

### Chat Service

```bash
cd chat-service
npm start
```

### Stock Ticker Service

```bash
cd stock-ticker-service
npm start
```

## Demo Clients

### User activity streaming demo

```bash
cd user-service
npx ts-node src/client-stream-test.ts
```

### Order tracking demo

(Requires user-service + order-service running)

```bash
cd order-service
npx ts-node src/client-test.ts
```

### Metrics client-streaming demo

```bash
cd metrics-service
npm run client
```

### File upload client-streaming demo

```bash
cd file-upload-service
npm run client
```

### Chat bidirectional-streaming demo

```bash
cd chat-service
npm run client
```

### Stock ticker bidirectional-streaming demo

```bash
cd stock-ticker-service
npm run client
```

## Build Notes

Build scripts are defined in:

- `user-service`: `npm run build`
- `order-service`: `npm run build`

The other services run directly with `tsx` via `npm start`.

## Notes

- `order-service` depends on `user-service` being available on `localhost:50051`.
- Data is in-memory for demo purposes.
- `file-upload-service` stores uploaded files under `file-upload-service/uploads`.
