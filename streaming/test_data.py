#!/usr/bin/env python3
"""
Sends realistic test events to Kinesis to simulate Pi devices.
Usage: python3 streaming/test_data.py
"""

import boto3
import json
import time
import random
from datetime import datetime, timezone

STREAM_NAME = "room-entry-exit-stream"
REGION      = "us-east-1"

DEVICES = [
    {"device_id": "raspberry-pi-001", "location": "cooper-library"},
    {"device_id": "laptop-cam-001",   "location": "hendrix-student-center"},
]

kinesis = boto3.client("kinesis", region_name=REGION)
counts  = {d["device_id"]: 0 for d in DEVICES}

def send_event(device: dict, direction: str):
    if direction == "IN":
        counts[device["device_id"]] += 1
    else:
        counts[device["device_id"]] = max(0, counts[device["device_id"]] - 1)

    payload = {
        "device_id":     device["device_id"],
        "locationId":    device["location"],
        "direction":     direction,
        "current_count": counts[device["device_id"]],
        "event_type":    "room_crossing",
        "timestamp":     datetime.now(timezone.utc).isoformat(),
    }

    resp = kinesis.put_record(
        StreamName=STREAM_NAME,
        Data=json.dumps(payload),
        PartitionKey=device["device_id"],
    )
    print(f"  [{resp['ShardId']}] {device['location']:<22} {direction}  count={counts[device['device_id']]}")
    return resp

def run_simulation(rounds: int = 10, delay: float = 1.5):
    print(f"Sending {rounds} rounds of test events to '{STREAM_NAME}'...\n")

    for i in range(rounds):
        print(f"Round {i+1}/{rounds}")
        device    = random.choice(DEVICES)
        # Bias toward IN early, OUT later so counts build up realistically
        direction = "IN" if (random.random() < 0.65 or counts[device["device_id"]] == 0) else "OUT"
        send_event(device, direction)
        time.sleep(delay)

    print(f"\nFinal counts:")
    for d in DEVICES:
        print(f"  {d['location']:<22} {counts[d['device_id']]} people")

if __name__ == "__main__":
    run_simulation(rounds=15, delay=1.0)
