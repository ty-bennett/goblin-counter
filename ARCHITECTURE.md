# Tiger Tracker — AWS Architecture

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CLEMSON CAMPUS DEVICES                             │
│                                                                                 │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                     │
│   │ Raspberry Pi │    │  Laptop Cam  │    │  Future IoT  │                     │
│   │  (Pi-001)    │    │  (cam-001)   │    │   Devices    │                     │
│   └──────┬───────┘    └──────┬───────┘    └──────┬───────┘                     │
│          │                   │                   │                             │
└──────────┼───────────────────┼───────────────────┼─────────────────────────────┘
           │                   │                   │
           │  POST /ingest  OR │  Kinesis PutRecord │
           ▼                   ▼                   ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                              AWS (us-east-1)                                     │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐     │
│  │                         DATA INGESTION LAYER                            │     │
│  │                                                                         │     │
│  │   ┌───────────────────────────────────┐   ┌─────────────────────────┐  │     │
│  │   │       API Gateway (HTTP API)      │   │    Kinesis Data Stream  │  │     │
│  │   │  POST /ingest                     │   │   (real-time events)    │  │     │
│  │   └─────────────────┬─────────────────┘   └────────────┬────────────┘  │     │
│  │                     │                                  │               │     │
│  │                     ▼                                  ▼               │     │
│  │   ┌─────────────────────────────┐   ┌─────────────────────────────┐   │     │
│  │   │  Lambda: goblin-counter-    │   │  Lambda: goblin-counter-    │   │     │
│  │   │     dev-ingest              │   │    kinesis-processor        │   │     │
│  │   │  • Validates payload        │   │  • Decodes base64 records   │   │     │
│  │   │  • Auto-registers devices   │   │  • Resolves device→location │   │     │
│  │   │  • Writes reading to Dynamo │   │  • Writes to sensor-readings│   │     │
│  │   └──────────────┬──────────────┘   │  • Upserts live counts      │   │     │
│  │                  │                  └──────────────┬───────────────┘   │     │
│  └──────────────────┼────────────────────────────────┼───────────────────┘     │
│                     │                                 │                         │
│                     ▼                                 ▼                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                          DYNAMODB TABLES                                │    │
│  │                                                                         │    │
│  │  ┌─────────────────────────┐  ┌─────────────────────────┐              │    │
│  │  │  goblin-counter-dev-    │  │  goblin-counter-dev-    │              │    │
│  │  │    sensor-readings      │  │      locations          │              │    │
│  │  │  PK: locationId (S)     │  │  PK: locationId (S)     │              │    │
│  │  │  SK: timestamp (S)      │  │  name, maxCapacity,     │              │    │
│  │  │  personCount, direction │  │  lat, lon, building,    │              │    │
│  │  │  deviceId, expiresAt    │  │  floor, description     │              │    │
│  │  │  TTL: 24–48 hrs         │  └─────────────────────────┘              │    │
│  │  └─────────────────────────┘                                           │    │
│  │                                                                         │    │
│  │  ┌─────────────────────────┐                                           │    │
│  │  │  goblin-counter-dev-    │                                           │    │
│  │  │       devices           │                                           │    │
│  │  │  PK: deviceId (S)       │                                           │    │
│  │  │  name, locationId,      │                                           │    │
│  │  │  status, registeredAt   │                                           │    │
│  │  └─────────────────────────┘                                           │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                          READ / QUERY LAYER                             │    │
│  │                                                                         │    │
│  │   ┌───────────────────────────────────────────────────────────────┐     │    │
│  │   │                  API Gateway (HTTP API)                       │     │    │
│  │   │  GET  /locations          GET  /locations/{id}                │     │    │
│  │   │  POST /locations          GET  /locations/{id}/busyness       │     │    │
│  │   │  GET  /locations/{id}/metrics                                 │     │    │
│  │   │  GET  /devices            POST /devices                       │     │    │
│  │   │  GET  /devices/{id}       PUT  /devices/{id}/location         │     │    │
│  │   │  POST /chat                                                   │     │    │
│  │   └──────────────────────────────────┬────────────────────────────┘     │    │
│  │                                      │                                  │    │
│  │              ┌───────────────────────┼────────────────────┐             │    │
│  │              ▼                       ▼                    ▼             │    │
│  │  ┌───────────────────┐  ┌───────────────────┐  ┌──────────────────┐    │    │
│  │  │  Lambda: -dev-api │  │  Lambda: -dev-api │  │  Lambda: -dev-   │    │    │
│  │  │  /locations/*     │  │  /devices/*       │  │     chat         │    │    │
│  │  │  /metrics         │  │                   │  │  POST /chat      │    │    │
│  │  └─────────┬─────────┘  └────────┬──────────┘  └────────┬─────────┘    │    │
│  │            │                     │                      │               │    │
│  │            │                     │                      ▼               │    │
│  │            │                     │         ┌────────────────────────┐   │    │
│  │            │                     │         │  Amazon Bedrock        │   │    │
│  │            │                     │         │  Claude 3.5 Haiku      │   │    │
│  │            │                     │         │  (Tool use: list_      │   │    │
│  │            │                     │         │  locations, get_       │   │    │
│  │            │                     │         │  busyness, get_metrics)│   │    │
│  │            │                     │         └────────────────────────┘   │    │
│  └────────────┼─────────────────────┼──────────────────────────────────────┘   │
│               │                     │                                           │
│  ┌────────────────────────────────────────────────────────────────────────┐     │
│  │                           AUTH LAYER                                   │     │
│  │                                                                        │     │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │     │
│  │  │              Cognito User Pool (us-east-1_7IaNSzeOH)             │  │     │
│  │  │  • Email-based sign-up / sign-in                                 │  │     │
│  │  │  • Domain restriction: @clemson.edu only                         │  │     │
│  │  │  • Auto-confirm (no email code required)                         │  │     │
│  │  │  • Pre Sign-Up Trigger → Lambda: goblin-counter-presignup        │  │     │
│  │  └──────────────────────────────────────────────────────────────────┘  │     │
│  └────────────────────────────────────────────────────────────────────────┘     │
│                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐     │
│  │                         FRONTEND HOSTING                               │     │
│  │                                                                        │     │
│  │  ┌────────────────────────────────────────────────────────────────┐   │     │
│  │  │  AWS Amplify (App ID: d27k0ldo79126u)                          │   │     │
│  │  │  • Git-connected CI/CD (auto-deploy on push to main)           │   │     │
│  │  │  • Builds: npm ci → npm run build → serves /dist               │   │     │
│  │  │  • Env vars: VITE_USER_POOL_ID, VITE_USER_POOL_CLIENT_ID,      │   │     │
│  │  │              VITE_API_ENDPOINT                                  │   │     │
│  │  │  • CDN: d27k0ldo79126u.amplifyapp.com                          │   │     │
│  │  └────────────────────────────────────────────────────────────────┘   │     │
│  └────────────────────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              USER'S BROWSER                                     │
│                                                                                  │
│   React + TypeScript + Vite (Tiger Tracker)                                     │
│   • AWS Amplify UI  — Cognito auth (login / sign-up)                            │
│   • react-leaflet   — Campus map with colored occupancy markers                 │
│   • Recharts        — Historical busyness line graph                            │
│   • ChatbotPopup    — Bedrock-powered AI assistant (POST /chat)                 │
│   • 10-second polling — Live occupancy data from GET /locations/{id}/busyness   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Service Summary

| Layer | Service | Purpose |
|---|---|---|
| **Hosting** | AWS Amplify | CI/CD, CDN, environment config |
| **Auth** | Cognito User Pool | @clemson.edu-only sign-up/sign-in |
| **Auth Trigger** | Lambda `presignup` | Domain enforcement, auto-confirm |
| **API** | API Gateway (HTTP) | Single endpoint for all routes |
| **Read API** | Lambda `api` | Locations, devices, metrics queries |
| **Write API** | Lambda `ingest` | Accept sensor readings via HTTP POST |
| **Stream** | Kinesis Data Stream | Real-time device event pipeline |
| **Stream Processor** | Lambda `kinesis_processor` | Decode & persist Kinesis records |
| **AI Chat** | Lambda `chat` + Bedrock | Claude 3.5 Haiku with tool use |
| **Storage** | DynamoDB (3 tables) | Locations, sensor readings, devices |
| **Map Tiles** | OpenStreetMap (CDN) | Leaflet base map tiles |

---

## Data Flow

**Live sensor update (HTTP):**
```
Device → POST /ingest → Lambda ingest → DynamoDB sensor-readings
                                      → DynamoDB devices (auto-register if new)
```

**Live sensor update (Kinesis streaming):**
```
Device → Kinesis Stream → Lambda kinesis_processor → DynamoDB sensor-readings
```

**Dashboard read (10s poll):**
```
Browser → API Gateway → Lambda api → DynamoDB → JSON response
```

**AI chat:**
```
Browser → POST /chat → Lambda chat → Bedrock Claude 3.5 Haiku
                                   ↕ tool calls (list_locations, get_busyness, get_metrics)
                                   → Lambda chat queries DynamoDB → Response
```

**Auth:**
```
Browser → Amplify UI → Cognito sign-up → Pre-signup Lambda (domain check) → JWT token
Browser → Amplify UI → Cognito sign-in → JWT token → API Gateway Authorization header
```

---

## API Reference

**Base URL:** `https://4exzqx8yxe.execute-api.us-east-1.amazonaws.com/dev`

All endpoints require a Cognito JWT in the `Authorization` header except `/ingest`.

---

### Locations

#### `GET /locations`
Returns all monitored campus locations.

**Response `200`**
```json
[
  {
    "locationId": "cooper-library",
    "name": "Cooper Library",
    "maxCapacity": 500,
    "description": "",
    "floor": "",
    "building": "",
    "latitude": "34.6776",
    "longitude": "-82.8374"
  }
]
```

---

#### `POST /locations`
Register a new location.

**Request body**
```json
{
  "locationId": "new-building",
  "name": "New Building",
  "maxCapacity": 200,
  "description": "Optional description",
  "floor": "1",
  "building": "Parent Building Name",
  "latitude": "34.6776",
  "longitude": "-82.8374"
}
```

**Responses**
- `201` — location created
- `400` — `locationId` or `name` missing
- `409` — location already exists

---

#### `GET /locations/{id}`
Get a single location by ID.

**Responses**
- `200` — location object
- `404` — not found

---

#### `GET /locations/{id}/busyness`
Get the most recent person count for a location.

**Response `200`**
```json
{
  "locationId": "raising-canes",
  "personCount": 85,
  "direction": "IN",
  "timestamp": "2026-02-28T22:51:17Z"
}
```

Returns `personCount: 0` and `timestamp: null` if no readings exist.

---

#### `GET /locations/{id}/metrics`
Get the last 25 sensor readings for a location (newest first).

**Response `200`**
```json
[
  {
    "locationId": "cooper-library",
    "personCount": 67,
    "timestamp": "2026-02-28T22:52:47.351257+00:00"
  }
]
```

---

### Devices

#### `GET /devices`
Returns all registered sensor devices.

**Response `200`**
```json
[
  {
    "deviceId": "raspberry-pi-001",
    "name": "raspberry-pi-001",
    "locationId": "cooper-library",
    "description": "",
    "status": "active"
  }
]
```

---

#### `POST /devices`
Register a new device manually.

**Request body**
```json
{
  "deviceId": "pi-002",
  "name": "Pi Camera #2",
  "locationId": "fike-recreation",
  "description": "Entrance counter",
  "status": "active"
}
```

**Responses**
- `201` — device created
- `400` — `deviceId` or `name` missing
- `409` — device already exists

---

#### `GET /devices/{id}`
Get a single device by ID.

**Responses**
- `200` — device object
- `404` — not found

---

#### `PUT /devices/{id}/location`
Associate a device with a location.

**Request body**
```json
{
  "locationId": "hendrix-student-center"
}
```

**Responses**
- `200` — `{ "deviceId": "...", "locationId": "...", "message": "associated" }`
- `400` — `locationId` missing
- `404` — device or location not found

---

### Ingest (Device → Cloud)

#### `POST /ingest`
Submit a sensor reading from a device. Does **not** require auth — intended for IoT devices.

**Request body**
```json
{
  "locationId": "cooper-library",
  "personCount": 67,
  "direction": "IN",
  "deviceId": "raspberry-pi-001",
  "timestamp": "2026-02-28T22:52:47Z"
}
```

- `locationId` and `personCount` are required; all other fields are optional.
- `deviceId` triggers auto-registration if the device is not yet in DynamoDB.
- `timestamp` defaults to current UTC time if omitted.
- Reading TTL is **24 hours**.

**Responses**
- `200` — `{ "message": "ok" }`
- `400` — missing required fields or invalid JSON

---

### Chat

#### `POST /chat`
Ask the AI assistant about campus occupancy. Uses Claude 3.5 Haiku via Amazon Bedrock with tool use to fetch live data.

**Request body**
```json
{
  "message": "How busy is Raising Cane's right now?"
}
```

**Response `200`**
```json
{
  "response": "Raising Cane's is currently 85% full, so it's very busy right now."
}
```

The model has access to three tools it can call automatically:
- `list_locations` — all locations with current `percentFull`, sorted busiest-first
- `get_busyness` — live count + percent full for a specific location
- `get_metrics` — last 25 readings summarised by hour (for trend/best-time questions)

---

## DynamoDB Tables

### `goblin-counter-dev-sensor-readings`
| Attribute | Type | Notes |
|---|---|---|
| `locationId` | String (PK) | e.g. `cooper-library` |
| `timestamp` | String (SK) | ISO 8601 UTC |
| `personCount` | Number | Current headcount |
| `direction` | String | `IN`, `OUT`, or `UNKNOWN` |
| `deviceId` | String | Source device |
| `expiresAt` | Number | Unix epoch, TTL 24–48 hrs |

### `goblin-counter-dev-locations`
| Attribute | Type | Notes |
|---|---|---|
| `locationId` | String (PK) | Slug, e.g. `raising-canes` |
| `name` | String | Display name |
| `maxCapacity` | Number | Used to compute % full |
| `latitude` | String | Decimal degrees |
| `longitude` | String | Decimal degrees |
| `building` | String | Parent building name (for grouping) |
| `floor` | String | Floor label |
| `description` | String | Optional |

### `goblin-counter-dev-devices`
| Attribute | Type | Notes |
|---|---|---|
| `deviceId` | String (PK) | e.g. `raspberry-pi-001` |
| `name` | String | Display name |
| `locationId` | String | Associated location |
| `status` | String | `active` or `inactive` |
| `registeredAt` | String | ISO 8601 UTC |

---

## Lambda Functions

| Function | Trigger | Runtime |
|---|---|---|
| `goblin-counter-presignup` | Cognito Pre Sign-Up | Python 3.12 |
| `goblin-counter-dev-ingest` | API Gateway `POST /ingest` | Python 3.12 |
| `goblin-counter-dev-api` | API Gateway (all other routes) | Python 3.12 |
| `goblin-counter-dev-chat` | API Gateway `POST /chat` | Python 3.12 |
| `goblin-counter-kinesis-processor` | Kinesis Data Stream | Python 3.12 |

---

## Environment Variables

### Frontend (Amplify branch env)
| Variable | Value |
|---|---|
| `VITE_USER_POOL_ID` | `us-east-1_7IaNSzeOH` |
| `VITE_USER_POOL_CLIENT_ID` | `28b9547jtk0889tmmo7ljfof4m` |
| `VITE_API_ENDPOINT` | `https://4exzqx8yxe.execute-api.us-east-1.amazonaws.com/dev` |

### Lambda (all functions)
| Variable | Description |
|---|---|
| `READINGS_TABLE` | `goblin-counter-dev-sensor-readings` |
| `LOCATIONS_TABLE` | `goblin-counter-dev-locations` |
| `DEVICES_TABLE` | `goblin-counter-dev-devices` |
