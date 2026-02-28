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

    # GET /locations
    if method == "GET" and path_parts == ["locations"]:
        locations = _scan_locations()
        return _resp(200, locations)

    # GET /locations/{id}
    if method == "GET" and len(path_parts) == 2 and path_parts[0] == "locations":
        loc_id = path_parts[1]
        item   = _get_location(loc_id)
        if not item:
            return _resp(404, {"message": "location not found"})
        return _resp(200, item)

    # GET /locations/{id}/busyness
    if method == "GET" and len(path_parts) == 3 \
            and path_parts[0] == "locations" and path_parts[2] == "busyness":
        loc_id = path_parts[1]
        result = _latest_reading(loc_id)
        if not result:
            return _resp(200, {"locationId": loc_id, "personCount": 0, "timestamp": None})
        return _resp(200, result)

    # GET /locations/{id}/metrics  — last 25 readings
    if method == "GET" and len(path_parts) == 3 \
            and path_parts[0] == "locations" and path_parts[2] == "metrics":
        loc_id = path_parts[1]
        items  = _recent_readings(loc_id, limit=25)
        return _resp(200, items)

    return _resp(404, {"message": "not found"})


def _scan_locations():
    resp = dynamodb.Table(LOCATIONS_TABLE).scan()
    return [_fmt_location(i) for i in resp.get("Items", [])]


def _get_location(location_id: str):
    resp = dynamodb.Table(LOCATIONS_TABLE).get_item(
        Key={"locationId": location_id}
    )
    item = resp.get("Item")
    return _fmt_location(item) if item else None


def _fmt_location(item: dict) -> dict:
    return {
        "locationId":  item["locationId"],
        "name":        item.get("name", item["locationId"]),
        "maxCapacity": int(item.get("maxCapacity", 0)),
        "description": item.get("description", ""),
        "floor":       item.get("floor", ""),
        "building":    item.get("building", ""),
    }


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
