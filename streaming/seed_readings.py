#!/usr/bin/env python3
"""
Injects realistic demo readings into DynamoDB with varied timestamps.
Covers recent minutes AND historical hours for time-of-day analysis.
Usage: python3 streaming/seed_readings.py
"""
import boto3
from datetime import datetime, timezone, timedelta

dynamodb = boto3.resource("dynamodb", region_name="us-east-1")
table    = dynamodb.Table("goblin-counter-dev-sensor-readings")
now      = datetime.now(timezone.utc)

def ts(minutes_ago=0, h=0):
    return (now - timedelta(minutes=minutes_ago, hours=h)).isoformat()

def ttl(hours=48):
    return int((now + timedelta(hours=hours)).timestamp())

# Each entry: (person_count, timestamp)
SEED = {
    # ~87% capacity right now, was quieter this morning
    "cooper-library": [
        (87, ts(1)),   (82, ts(6)),   (79, ts(11)),  (74, ts(16)),
        (68, ts(21)),  (60, ts(30)),  (45, ts(45)),  (30, ts(60)),
        (22, ts(h=2)), (18, ts(h=3)), (10, ts(h=4)), (5,  ts(h=5)),
        (2,  ts(h=7)), (8,  ts(h=8)), (25, ts(h=9)), (50, ts(h=10)),
        (65, ts(h=11)),
    ],
    # Very busy — lunch rush at student center
    "hendrix-student-center": [
        (142, ts(2)),   (138, ts(7)),   (130, ts(12)),  (120, ts(17)),
        (105, ts(25)),  (90,  ts(40)),  (70,  ts(60)),
        (40,  ts(h=2)), (20,  ts(h=3)), (5,   ts(h=5)),
        (10,  ts(h=7)), (30,  ts(h=9)), (80,  ts(h=10)), (130, ts(h=11)),
    ],
    # Moderate gym traffic
    "fike-recreation": [
        (63, ts(1)),   (58, ts(8)),   (50, ts(15)),  (42, ts(25)),
        (35, ts(40)),  (20, ts(60)),
        (10, ts(h=2)), (5,  ts(h=4)), (2,  ts(h=6)),
        (15, ts(h=8)), (30, ts(h=9)), (55, ts(h=10)), (60, ts(h=11)),
    ],
    # Quiet innovation center
    "watt-innovation-center": [
        (28, ts(3)),   (25, ts(10)),  (22, ts(20)),  (18, ts(35)),
        (12, ts(55)),
        (5,  ts(h=2)), (3,  ts(h=4)), (8,  ts(h=7)),
        (15, ts(h=9)), (20, ts(h=10)), (25, ts(h=11)),
    ],
    # Tillman mostly empty
    "tillman-hall": [
        (15, ts(2)),   (12, ts(12)),  (10, ts(25)),  (8, ts(45)),
        (3,  ts(h=2)), (1,  ts(h=5)),
        (5,  ts(h=8)), (10, ts(h=9)), (14, ts(h=10)), (12, ts(h=11)),
    ],
    # Jordan Hall — packed for morning classes
    "jordan-hall": [
        (201, ts(1)),  (195, ts(5)),  (188, ts(12)), (175, ts(20)),
        (160, ts(35)), (140, ts(50)), (115, ts(h=1)),
        (80,  ts(h=2)), (30,  ts(h=3)), (10, ts(h=5)),
        (20,  ts(h=7)), (80,  ts(h=8)), (150, ts(h=9)), (190, ts(h=10)),
        (200, ts(h=11)),
    ],
    # Daniel Hall — business classes
    "daniel-hall": [
        (112, ts(2)),  (108, ts(8)),  (100, ts(15)), (88, ts(25)),
        (72,  ts(40)), (55,  ts(60)),
        (20,  ts(h=2)), (8,  ts(h=4)), (3,  ts(h=6)),
        (15,  ts(h=8)), (60, ts(h=9)), (95, ts(h=10)), (110, ts(h=11)),
    ],
    # Lee Hall — steady architecture students
    "lee-hall": [
        (44, ts(4)),   (40, ts(12)),  (35, ts(22)),  (28, ts(38)),
        (20, ts(55)),
        (8,  ts(h=2)), (5,  ts(h=4)),
        (10, ts(h=8)), (25, ts(h=9)), (38, ts(h=10)), (42, ts(h=11)),
    ],
}

written = 0
with table.batch_writer() as batch:
    for location_id, readings in SEED.items():
        prev_count = None
        for count, timestamp in readings:
            direction = "IN" if (prev_count is None or count >= prev_count) else "OUT"
            batch.put_item(Item={
                "locationId":  location_id,
                "timestamp":   timestamp,
                "personCount": count,
                "direction":   direction,
                "deviceId":    "seed-script",
                "eventType":   "room_crossing",
                "expiresAt":   ttl(48),
            })
            prev_count = count
            written += 1

print(f"Seeded {written} readings across {len(SEED)} locations")
for loc, readings in SEED.items():
    print(f"  {loc:<28} latest={readings[0][0]} people")
