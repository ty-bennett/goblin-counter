import json
import os
import boto3
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource("dynamodb")
READINGS_TABLE  = os.environ["READINGS_TABLE"]
LOCATIONS_TABLE = os.environ["LOCATIONS_TABLE"]
DEVICES_TABLE   = os.environ.get("DEVICES_TABLE", "")

def handler(event, context):
    rc         = event.get("requestContext", {})
    method     = rc.get("http", {}).get("method") or event.get("httpMethod", "GET")
    raw_path   = event.get("rawPath") or event.get("path", "/")
    stage      = rc.get("stage", "")
    if stage and stage != "$default" and raw_path.startswith(f"/{stage}/"):
        raw_path = raw_path[len(f"/{stage}"):]
    path_parts = [p for p in raw_path.split("/") if p]
    body       = _parse_body(event)

    # ── Locations ─────────────────────────────────────────────────────────────

    # GET /locations
    if method == "GET" and path_parts == ["locations"]:
        return _resp(200, _scan_locations())

    # POST /locations  — register a new location
    if method == "POST" and path_parts == ["locations"]:
        return _create_location(body)

    # GET /locations/{id}
    if method == "GET" and len(path_parts) == 2 and path_parts[0] == "locations":
        item = _get_location(path_parts[1])
        if not item:
            return _resp(404, {"message": "location not found"})
        return _resp(200, item)

    # GET /locations/{id}/busyness
    if method == "GET" and len(path_parts) == 3 \
            and path_parts[0] == "locations" and path_parts[2] == "busyness":
        result = _latest_reading(path_parts[1])
        if not result:
            return _resp(200, {"locationId": path_parts[1], "personCount": 0, "timestamp": None})
        return _resp(200, result)

    # GET /locations/{id}/metrics  — last 25 readings
    if method == "GET" and len(path_parts) == 3 \
            and path_parts[0] == "locations" and path_parts[2] == "metrics":
        return _resp(200, _recent_readings(path_parts[1], limit=25))

    # ── Devices ───────────────────────────────────────────────────────────────

    # GET /devices
    if method == "GET" and path_parts == ["devices"]:
        return _resp(200, _scan_devices())

    # POST /devices  — register a new camera
    if method == "POST" and path_parts == ["devices"]:
        return _create_device(body)

    # GET /devices/{id}
    if method == "GET" and len(path_parts) == 2 and path_parts[0] == "devices":
        item = _get_device(path_parts[1])
        if not item:
            return _resp(404, {"message": "device not found"})
        return _resp(200, item)

    # PUT /devices/{id}/location  — associate camera with a location
    if method == "PUT" and len(path_parts) == 3 \
            and path_parts[0] == "devices" and path_parts[2] == "location":
        return _associate_device(path_parts[1], body)

    return _resp(404, {"message": "not found"})


# ── Location helpers ───────────────────────────────────────────────────────────

def _scan_locations():
    resp = dynamodb.Table(LOCATIONS_TABLE).scan()
    return [_fmt_location(i) for i in resp.get("Items", [])]


def _get_location(location_id: str):
    resp = dynamodb.Table(LOCATIONS_TABLE).get_item(Key={"locationId": location_id})
    item = resp.get("Item")
    return _fmt_location(item) if item else None


def _create_location(body: dict):
    loc_id = body.get("locationId", "").strip()
    name   = body.get("name", "").strip()
    if not loc_id or not name:
        return _resp(400, {"message": "locationId and name are required"})

    existing = dynamodb.Table(LOCATIONS_TABLE).get_item(Key={"locationId": loc_id}).get("Item")
    if existing:
        return _resp(409, {"message": f"location '{loc_id}' already exists"})

    item = {
        "locationId":  loc_id,
        "name":        name,
        "maxCapacity": int(body.get("maxCapacity", 100)),
        "description": body.get("description", ""),
        "floor":       body.get("floor", ""),
        "building":    body.get("building", ""),
        "latitude":    body.get("latitude", ""),
        "longitude":   body.get("longitude", ""),
    }
    dynamodb.Table(LOCATIONS_TABLE).put_item(Item=item)
    return _resp(201, item)


def _fmt_location(item: dict) -> dict:
    return {
        "locationId":  item["locationId"],
        "name":        item.get("name", item["locationId"]),
        "maxCapacity": int(item.get("maxCapacity", 0)),
        "description": item.get("description", ""),
        "floor":       item.get("floor", ""),
        "building":    item.get("building", ""),
        "latitude":    item.get("latitude", ""),
        "longitude":   item.get("longitude", ""),
    }


# ── Device helpers ─────────────────────────────────────────────────────────────

def _scan_devices():
    if not DEVICES_TABLE:
        return []
    resp = dynamodb.Table(DEVICES_TABLE).scan()
    return [_fmt_device(i) for i in resp.get("Items", [])]


def _get_device(device_id: str):
    if not DEVICES_TABLE:
        return None
    resp = dynamodb.Table(DEVICES_TABLE).get_item(Key={"deviceId": device_id})
    item = resp.get("Item")
    return _fmt_device(item) if item else None


def _create_device(body: dict):
    if not DEVICES_TABLE:
        return _resp(503, {"message": "DEVICES_TABLE not configured"})

    device_id = body.get("deviceId", "").strip()
    name      = body.get("name", "").strip()
    if not device_id or not name:
        return _resp(400, {"message": "deviceId and name are required"})

    existing = dynamodb.Table(DEVICES_TABLE).get_item(Key={"deviceId": device_id}).get("Item")
    if existing:
        return _resp(409, {"message": f"device '{device_id}' already exists"})

    item = {
        "deviceId":    device_id,
        "name":        name,
        "description": body.get("description", ""),
        "status":      body.get("status", "active"),
    }
    # Only set locationId if provided — empty string is invalid on the GSI
    if body.get("locationId", "").strip():
        item["locationId"] = body["locationId"].strip()
    dynamodb.Table(DEVICES_TABLE).put_item(Item=item)
    return _resp(201, {**item, "locationId": item.get("locationId", "")})


def _associate_device(device_id: str, body: dict):
    if not DEVICES_TABLE:
        return _resp(503, {"message": "DEVICES_TABLE not configured"})

    loc_id = body.get("locationId", "").strip()
    if not loc_id:
        return _resp(400, {"message": "locationId is required"})

    # Verify device and location both exist
    device = dynamodb.Table(DEVICES_TABLE).get_item(Key={"deviceId": device_id}).get("Item")
    if not device:
        return _resp(404, {"message": "device not found"})

    location = dynamodb.Table(LOCATIONS_TABLE).get_item(Key={"locationId": loc_id}).get("Item")
    if not location:
        return _resp(404, {"message": "location not found"})

    dynamodb.Table(DEVICES_TABLE).update_item(
        Key={"deviceId": device_id},
        UpdateExpression="SET locationId = :loc",
        ExpressionAttributeValues={":loc": loc_id},
    )
    return _resp(200, {"deviceId": device_id, "locationId": loc_id, "message": "associated"})


def _fmt_device(item: dict) -> dict:
    return {
        "deviceId":    item["deviceId"],
        "name":        item.get("name", item["deviceId"]),
        "locationId":  item.get("locationId", ""),
        "description": item.get("description", ""),
        "status":      item.get("status", "active"),
    }


# ── Reading helpers ────────────────────────────────────────────────────────────

def _latest_reading(location_id: str):
    resp = dynamodb.Table(READINGS_TABLE).query(
        KeyConditionExpression=Key("locationId").eq(location_id),
        ScanIndexForward=False,
        Limit=1,
    )
    items = resp.get("Items", [])
    if not items:
        return None
    item = items[0]
    return {
        "locationId":  item["locationId"],
        "personCount": int(item.get("personCount", 0)),
        "direction":   item.get("direction"),
        "timestamp":   item.get("timestamp"),
    }


def _recent_readings(location_id: str, limit: int = 25):
    resp = dynamodb.Table(READINGS_TABLE).query(
        KeyConditionExpression=Key("locationId").eq(location_id),
        ScanIndexForward=False,
        Limit=limit,
    )
    return [
        {
            "locationId":  i["locationId"],
            "personCount": int(i.get("personCount", 0)),
            "timestamp":   i.get("timestamp"),
        }
        for i in resp.get("Items", [])
    ]


# ── Shared ─────────────────────────────────────────────────────────────────────

def _parse_body(event: dict) -> dict:
    try:
        return json.loads(event.get("body") or "{}")
    except Exception:
        return {}


def _resp(status: int, body):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type":                 "application/json",
            "Access-Control-Allow-Origin":  "*",
            "Access-Control-Allow-Headers": "*",
        },
        "body": json.dumps(body, default=str),
    }
