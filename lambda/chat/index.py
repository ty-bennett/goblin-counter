import json
import os
import boto3
from boto3.dynamodb.conditions import Key
from datetime import datetime, timezone
from collections import defaultdict

dynamodb = boto3.resource("dynamodb")
bedrock  = boto3.client("bedrock-runtime", region_name="us-east-1")

READINGS_TABLE  = os.environ["READINGS_TABLE"]
LOCATIONS_TABLE = os.environ["LOCATIONS_TABLE"]
MODEL_ID        = "us.anthropic.claude-3-5-haiku-20241022-v1:0"

TOOLS = [
    {
        "toolSpec": {
            "name": "list_locations",
            "description": (
                "Returns all monitored locations on Clemson campus with their "
                "name, max capacity, building, and floor."
            ),
            "inputSchema": {
                "json": {"type": "object", "properties": {}, "required": []}
            },
        }
    },
    {
        "toolSpec": {
            "name": "get_busyness",
            "description": (
                "Returns the current person count and busyness status for a "
                "specific location. Use this to answer questions like "
                "'is X busy right now?' or 'how many people are at X?'."
            ),
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {
                        "location_id": {
                            "type": "string",
                            "description": (
                                "The locationId of the location "
                                "(e.g. 'cooper-library', 'hendrix-student-center')"
                            ),
                        }
                    },
                    "required": ["location_id"],
                }
            },
        }
    },
    {
        "toolSpec": {
            "name": "get_metrics",
            "description": (
                "Returns the last 25 person-count readings for a location, "
                "summarised by hour. Use this to answer questions about "
                "historical trends, best times to visit, or peak hours."
            ),
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {
                        "location_id": {
                            "type": "string",
                            "description": "The locationId of the location",
                        }
                    },
                    "required": ["location_id"],
                }
            },
        }
    },
]

SYSTEM_PROMPT = (
    "You are a helpful campus busyness assistant for Clemson University. "
    "You help students and staff understand how busy campus locations are.\n\n"
    "Rules:\n"
    "- Only answer questions about Clemson campus location occupancy and busyness.\n"
    "- list_locations already includes current percentFull for every location — use it for comparisons.\n"
    "- ALWAYS rank or compare locations by percentFull, never by raw personCount.\n"
    "- Always describe busyness using percentFull (e.g. '85% full'), never mention raw headcounts.\n"
    "- Keep responses concise (1-3 sentences) and always name the location you are describing.\n"
    "- For questions outside your scope, respond exactly: "
    "\"Sorry, I can't answer that. For more information, please visit https://www.clemson.edu\""
)


def handler(event, context):
    body    = json.loads(event.get("body") or "{}")
    message = body.get("message", "").strip()
    if not message:
        return _resp(400, {"error": "message is required"})

    messages = [{"role": "user", "content": [{"text": message}]}]

    for _ in range(6):  # max tool-use rounds
        response = bedrock.converse(
            modelId=MODEL_ID,
            system=[{"text": SYSTEM_PROMPT}],
            messages=messages,
            toolConfig={"tools": TOOLS},
        )

        output      = response["output"]["message"]
        stop_reason = response["stopReason"]
        messages.append(output)

        if stop_reason == "end_turn":
            text = next(
                (b["text"] for b in output["content"] if "text" in b), ""
            )
            return _resp(200, {"response": text})

        if stop_reason == "tool_use":
            tool_results = []
            for block in output["content"]:
                if "toolUse" not in block:
                    continue
                name        = block["toolUse"]["name"]
                inputs      = block["toolUse"]["input"]
                tool_use_id = block["toolUse"]["toolUseId"]
                result      = _call_tool(name, inputs)
                tool_results.append({
                    "toolResult": {
                        "toolUseId": tool_use_id,
                        "content":   [{"json": result}],
                    }
                })
            messages.append({"role": "user", "content": tool_results})

    return _resp(200, {"response": "Sorry, I couldn't process your request. Please try again."})


# ── Tool implementations ───────────────────────────────────────────────────────

def _call_tool(name: str, inputs: dict) -> dict:
    if name == "list_locations":
        return _tool_list_locations()
    if name == "get_busyness":
        return _tool_get_busyness(inputs["location_id"])
    if name == "get_metrics":
        return _tool_get_metrics(inputs["location_id"])
    return {"error": f"unknown tool: {name}"}


def _tool_list_locations() -> dict:
    resp = dynamodb.Table(LOCATIONS_TABLE).scan()
    locations = []
    for i in resp.get("Items", []):
        loc_id   = i["locationId"]
        max_cap  = int(i.get("maxCapacity", 0)) or 100
        # Fetch latest reading so comparisons use percentFull, not raw counts
        reading  = dynamodb.Table(READINGS_TABLE).query(
            KeyConditionExpression=Key("locationId").eq(loc_id),
            ScanIndexForward=False,
            Limit=1,
        ).get("Items", [])
        count    = int(reading[0].get("personCount", 0)) if reading else 0
        pct      = round(count / max_cap * 100)
        locations.append({
            "locationId":  loc_id,
            "name":        i.get("name", loc_id),
            "maxCapacity": max_cap,
            "personCount": count,
            "percentFull": pct,
            "building":    i.get("building", ""),
            "floor":       i.get("floor", ""),
        })
    # Sort busiest first so ranking questions are easy to answer
    locations.sort(key=lambda x: x["percentFull"], reverse=True)
    return {"locations": locations}


def _tool_get_busyness(location_id: str) -> dict:
    resp = dynamodb.Table(READINGS_TABLE).query(
        KeyConditionExpression=Key("locationId").eq(location_id),
        ScanIndexForward=False,
        Limit=1,
    )
    items = resp.get("Items", [])
    if not items:
        return {"locationId": location_id, "personCount": 0, "status": "no data available"}

    item    = items[0]
    count   = int(item.get("personCount", 0))
    loc     = dynamodb.Table(LOCATIONS_TABLE).get_item(
        Key={"locationId": location_id}
    ).get("Item", {})
    max_cap = int(loc.get("maxCapacity", 100)) or 100
    pct     = count / max_cap

    if pct == 0:
        status = "empty"
    elif pct < 0.25:
        status = "quiet"
    elif pct < 0.60:
        status = "moderately busy"
    elif pct < 0.85:
        status = "busy"
    else:
        status = "very busy"

    return {
        "locationId":   location_id,
        "name":         loc.get("name", location_id),
        "personCount":  count,
        "maxCapacity":  max_cap,
        "percentFull":  round(pct * 100),
        "status":       status,
        "timestamp":    item.get("timestamp"),
    }


def _tool_get_metrics(location_id: str) -> dict:
    resp = dynamodb.Table(READINGS_TABLE).query(
        KeyConditionExpression=Key("locationId").eq(location_id),
        ScanIndexForward=False,
        Limit=25,
    )
    items = resp.get("Items", [])
    if not items:
        return {"locationId": location_id, "readingCount": 0, "hourlyAverages": {}}

    by_hour: dict[int, list[int]] = defaultdict(list)
    for item in items:
        ts = item.get("timestamp", "")
        try:
            hour = datetime.fromisoformat(ts).astimezone(timezone.utc).hour
            by_hour[hour].append(int(item.get("personCount", 0)))
        except Exception:
            pass

    hourly_averages = {
        f"{h:02d}:00": round(sum(v) / len(v))
        for h, v in sorted(by_hour.items())
    }

    return {
        "locationId":     location_id,
        "readingCount":   len(items),
        "latestCount":    int(items[0].get("personCount", 0)),
        "hourlyAverages": hourly_averages,
    }


# ── Response helper ────────────────────────────────────────────────────────────

def _resp(status: int, body) -> dict:
    return {
        "statusCode": status,
        "headers": {
            "Content-Type":                 "application/json",
            "Access-Control-Allow-Origin":  "*",
            "Access-Control-Allow-Headers": "*",
        },
        "body": json.dumps(body, default=str),
    }
