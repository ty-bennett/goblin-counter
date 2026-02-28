import json
import os
import boto3
from botocore.exceptions import ClientError
from datetime import datetime, timezone

dynamodb      = boto3.resource("dynamodb")
READINGS_TABLE = os.environ["READINGS_TABLE"]
DEVICES_TABLE  = os.environ.get("DEVICES_TABLE", "goblin-counter-dev-devices")
TTL_SECS       = 86400  # 24 hours

def handler(event, context):
    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _resp(400, "invalid JSON")

    location_id  = body.get("locationId")
    person_count = body.get("personCount")
    direction    = body.get("direction")
    device_id    = body.get("deviceId")
    timestamp    = body.get("timestamp") or datetime.now(timezone.utc).isoformat()

    if not location_id or person_count is None:
        return _resp(400, "locationId and personCount are required")

    # Auto-register device if deviceId provided and not yet in DynamoDB
    if device_id:
        _ensure_device(device_id, location_id)

    expires_at = int(datetime.now(timezone.utc).timestamp()) + TTL_SECS

    dynamodb.Table(READINGS_TABLE).put_item(Item={
        "locationId":   location_id,
        "timestamp":    timestamp,
        "personCount":  int(person_count),
        "direction":    direction or "UNKNOWN",
        "deviceId":     device_id or "unknown",
        "expiresAt":    expires_at,
    })

    return _resp(200, "ok")


def _ensure_device(device_id: str, location_id: str):
    """Insert device into DynamoDB only if it doesn't already exist."""
    try:
        dynamodb.Table(DEVICES_TABLE).put_item(
            Item={
                "deviceId":   device_id,
                "name":       device_id,          # default name = device_id
                "locationId": location_id,
                "status":     "active",
                "registeredAt": datetime.now(timezone.utc).isoformat(),
            },
            ConditionExpression="attribute_not_exists(deviceId)",
        )
        print(f"Auto-registered new device: {device_id} → {location_id}")
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            pass  # Device already exists, nothing to do
        else:
            print(f"WARN: could not register device {device_id}: {e}")


def _resp(status: int, message: str):
    return {
        "statusCode": status,
        "headers": {
            "Access-Control-Allow-Origin":  "*",
            "Access-Control-Allow-Headers": "*",
        },
        "body": json.dumps({"message": message}),
    }
