import json
import os
import boto3
from datetime import datetime, timezone

dynamodb = boto3.resource("dynamodb")
TABLE    = os.environ["READINGS_TABLE"]
TTL_SECS = 86400  # 24 hours

def handler(event, context):
    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _resp(400, "invalid JSON")

    location_id  = body.get("locationId")
    person_count = body.get("personCount")
    direction    = body.get("direction")
    timestamp    = body.get("timestamp") or datetime.now(timezone.utc).isoformat()

    if not location_id or person_count is None:
        return _resp(400, "locationId and personCount are required")

    expires_at = int(datetime.now(timezone.utc).timestamp()) + TTL_SECS

    dynamodb.Table(TABLE).put_item(Item={
        "locationId":   location_id,
        "timestamp":    timestamp,
        "personCount":  int(person_count),
        "direction":    direction or "UNKNOWN",
        "expiresAt":    expires_at,
    })

    return _resp(200, "ok")


def _resp(status: int, message: str):
    return {
        "statusCode": status,
        "headers": {
            "Access-Control-Allow-Origin":  "*",
            "Access-Control-Allow-Headers": "*",
        },
        "body": json.dumps({"message": message}),
    }
