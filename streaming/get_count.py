import boto3
from boto3.dynamodb.conditions import Key

dynamodb       = boto3.resource("dynamodb", region_name="us-east-1")
DEVICES_TABLE  = "goblin-counter-dev-devices"
READINGS_TABLE = "goblin-counter-dev-sensor-readings"


def get_current_count(device_id: str) -> dict:
    """
    Returns the current person count for the location a camera is assigned to.

    Args:
        device_id: The device ID (e.g. 'raspberry-pi-001')

    Returns:
        {
            "deviceId":    "raspberry-pi-001",
            "locationId":  "cooper-library",
            "personCount": 87,
            "timestamp":   "2026-02-28T20:00:00+00:00",
        }
        or raises ValueError if device or location not found.
    """
    # 1. Look up the device → locationId
    device = dynamodb.Table(DEVICES_TABLE).get_item(
        Key={"deviceId": device_id}
    ).get("Item")

    if not device:
        raise ValueError(f"Device '{device_id}' not found")

    location_id = device.get("locationId", "")
    if not location_id:
        raise ValueError(f"Device '{device_id}' has no location assigned")

    # 2. Fetch the latest reading for that location
    resp = dynamodb.Table(READINGS_TABLE).query(
        KeyConditionExpression=Key("locationId").eq(location_id),
        ScanIndexForward=False,
        Limit=1,
    )
    items = resp.get("Items", [])

    if not items:
        return {
            "deviceId":    device_id,
            "locationId":  location_id,
            "personCount": 0,
            "timestamp":   None,
        }

    item = items[0]
    return {
        "deviceId":    device_id,
        "locationId":  location_id,
        "personCount": int(item.get("personCount", 0)),
        "timestamp":   item.get("timestamp"),
    }


if __name__ == "__main__":
    for device_id in ["raspberry-pi-001", "laptop-cam-001"]:
        try:
            result = get_current_count(device_id)
            print(f"{result['locationId']:<28} count={result['personCount']}  ts={result['timestamp']}")
        except ValueError as e:
            print(f"  {device_id}: {e}")
