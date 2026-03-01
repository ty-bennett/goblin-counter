# Tiger Tracker

**Ty Bennett, Isaac Rostron, George Atkinson, Rayan Ahmed** · CUHackit 2026

A real-time campus occupancy dashboard for Clemson University. Students and staff can see how busy any monitored location is right now, view historical trends, and ask an AI chatbot questions about campus busyness and it is all restricted to `@clemson.edu` accounts. 

### Even if it's for Clemson, it's still Go Cocks!! 🐔🤙
---

## Features

- **Live occupancy map** — Leaflet map with color-coded markers (green / yellow / red) per location
- **Sidebar with busyness cards** — sorted list of locations with live person counts and capacity bars
- **Historical trend graph** — Recharts line graph of the last 25 readings for any selected location
- **AI chat assistant** — Claude 3.5 Haiku (via Amazon Bedrock) answers natural-language questions about campus busyness using live data and percentage-based responses
- **@clemson.edu auth** — Cognito sign-up restricted to Clemson email addresses, auto-confirmed (no verification code)
- **IoT device support** — Raspberry Pi / camera devices post sensor readings via HTTP or Kinesis; new devices auto-register on first contact

---

## Architecture

```
Campus Devices → API Gateway (POST /ingest) → Lambda → DynamoDB
             └→ Kinesis Stream → Lambda kinesis_processor → DynamoDB

Browser → AWS Amplify (CDN) → React App
       ↔ Cognito (auth)
       → API Gateway → Lambda api    → DynamoDB (locations, readings, devices)
       → API Gateway → Lambda chat   → Bedrock Claude 3.5 Haiku
                                     ↕ tool calls → DynamoDB
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full diagram and API reference, or open [architecture-diagram.html](architecture-diagram.html) in a browser for an interactive flowchart.

---

## Tech Stack

### Frontend
| Library | Purpose |
|---|---|
| React 18 + TypeScript | UI framework |
| Vite | Build tool / dev server |
| AWS Amplify UI | Cognito auth components |
| react-leaflet | Interactive campus map |
| Recharts | Occupancy trend graph |
| date-fns | Timestamp formatting |

### Backend (AWS)
| Service | Role |
|---|---|
| AWS Amplify | CI/CD hosting + CDN |
| Cognito User Pool | `@clemson.edu`-only auth |
| API Gateway (HTTP) | Single REST entry point |
| Lambda (Python 3.12) | Ingest, API, chat, presignup, Kinesis processor |
| DynamoDB | Locations, sensor readings, devices |
| Kinesis Data Stream | Real-time IoT event pipeline |
| Amazon Bedrock | Claude 3.5 Haiku — AI chat |

---

## Project Structure

```
├── src/
│   ├── components/        # MapView, ChatbotPopup, BusynessGraph, ...
│   ├── services/          # ApiService.ts (fetch wrappers)
│   ├── models/            # TypeScript interfaces and RoomStatus enum
│   └── styles/            # Global CSS
├── lambda/
│   ├── api/               # GET/POST locations, devices, metrics
│   ├── ingest/            # POST /ingest — device sensor readings
│   ├── chat/              # POST /chat — Bedrock tool-use orchestration
│   ├── presignup/         # Cognito pre sign-up domain check
│   └── kinesis_processor/ # Kinesis stream consumer
├── public/
│   ├── favicon.svg        # Tiger paw icon
│   ├── cooper-library.svg # Footer building illustration
│   └── tillman-hall.svg   # Footer building illustration
├── ARCHITECTURE.md        # Full architecture + API reference
├── architecture-diagram.html  # Interactive Mermaid flowchart
└── amplify.yml            # Amplify build spec
```

---

## Getting Started

### Prerequisites
- AWS CLI configured (for Lambda deploys)
- Node 24+
### Install dependencies

```bash
npm install
```

### Environment variables

Create a `.env.local` for local development:

```env
VITE_USER_POOL_ID
VITE_USER_POOL_CLIENT_ID
VITE_API_ENDPOINT
```

### Run locally

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

---

## Deploying a Lambda

```bash
cd lambda/<function-folder>
zip -r /tmp/fn.zip index.py
aws lambda update-function-code \
  --function-name <function-name> \
  --zip-file fileb:///tmp/fn.zip
```

| Folder | Function name |
|---|---|
| `lambda/api` | `goblin-counter-dev-api` |
| `lambda/ingest` | `goblin-counter-dev-ingest` |
| `lambda/chat` | `goblin-counter-dev-chat` |
| `lambda/presignup` | `goblin-counter-presignup` |
| `lambda/kinesis_processor` | `goblin-counter-kinesis-processor` |

---

## Sending a Test Reading

```bash
curl -X POST API-GW-ID.execute-api.us-east-1.amazonaws.com/dev/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "locationId": "cooper-library",
    "personCount": 120,
    "direction": "IN",
    "deviceId": "my-device-001"
  }'
```
