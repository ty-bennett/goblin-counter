import json
import base64
import os
import boto3
from boto3.dynamodb.conditions import Key
from datetime import datetime, timezone

dynamodb       = boto3.resource("dynamodb")
READINGS_TABLE = os.environ["READINGS_TABLE"]
COUNTS_TABLE   = os.environ.get("COUNTS_TABLE", "room-counts")   # live count per location

# Map device_id → locationId — add your Pi device IDs here
DEVICE_MAP = {
    "raspberry-pi-001": "cooper-library",
    "laptop-cam-001":   "hendrix-student-center",
}

def handler(event, context):
    readings_table = dynamodb.Table(READINGS_TABLE)
    counts_table   = dynamodb.Table(COUNTS_TABLE)
    processed = 0
    errors    = 0

    for record in event.get("Records", []):
        try:
            data = _decode_record(record)
            if not data:
                continue

            location_id  = _resolve_location(data)
            person_count = int(data.get("current_count", 0))
            direction    = data.get("direction", "UNKNOWN").upper()
            device_id    = data.get("device_id", "unknown")
            timestamp    = _parse_timestamp(data)

            # ── 1. Append event to sensor_readings (time-series log) ──────────
            readings_table.put_item(Item={
                "locationId":  location_id,
                "timestamp":   timestamp,
                "personCount": person_count,
                "direction":   direction,
                "deviceId":    device_id,
                "eventType":   data.get("event_type", "room_crossing"),
                "expiresAt":   _ttl(hours=48),
            })

            # ── 2. Upsert live count in room-counts (fast busyness lookup) ────
            counts_table.update_item(
                Key={"room_id": location_id},
                UpdateExpression=(
                    "SET current_count = :count, "
                    "last_direction = :dir, "
                    "last_updated = :ts, "
                    "device_id = :dev"
                ),
                ExpressionAttributeValues={
                    ":count": person_count,
                    ":dir":   direction,
                    ":ts":    timestamp,
                    ":dev":   device_id,
                },
            )

            print(f"OK  location={location_id}  direction={direction}  count={person_count}  ts={timestamp}")
            processed += 1

        except Exception as e:
            print(f"ERR record={record.get('kinesis', {}).get('sequenceNumber', '?')}  error={e}")
            errors += 1

    print(f"Done: processed={processed}  errors={errors}  total={len(event.get('Records', []))}")
    return {"processed": processed, "errors": errors}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _decode_record(record: dict) -> dict | None:
    """Base64-decode and JSON-parse a Kinesis record."""
    try:
        raw = base64.b64decode(record["kinesis"]["data"]).decode("utf-8")
        return json.loads(raw)
    except Exception as e:
        print(f"  Decode error: {e}")
        return None


def _resolve_location(data: dict) -> str:
    """Prefer explicit locationId, fall back to device→location map."""
    if loc := data.get("locationId"):
        return loc
    return DEVICE_MAP.get(data.get("device_id", ""), data.get("device_id", "unknown"))


def _parse_timestamp(data: dict) -> str:
    """Return ISO timestamp from record, defaulting to now."""
    if ts := data.get("timestamp"):
        return ts
    if unix := data.get("unix_timestamp"):
        return datetime.fromtimestamp(int(unix), tz=timezone.utc).isoformat()
    return datetime.now(timezone.utc).isoformat()


def _ttl(hours: int = 48) -> int:
    return int(datetime.now(timezone.utc).timestamp()) + hours * 3600
