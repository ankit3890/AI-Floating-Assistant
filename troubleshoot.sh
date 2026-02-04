#!/bin/bash

APP_PATH="/opt/AI Floating Assistant/ai_pin"

echo "Attempting to launch AI Floating Assistant with various compatibility flags..."

echo "----------------------------------------------------------------"
echo "Attempt 1: Standard launch (Permissions Check)"
"$APP_PATH"
if [ $? -eq 0 ]; then exit 0; fi

echo "----------------------------------------------------------------"
echo "Attempt 2: Disable Dev SHM Usage (Fixes /dev/shm errors)"
"$APP_PATH" --disable-dev-shm-usage
if [ $? -eq 0 ]; then exit 0; fi

echo "----------------------------------------------------------------"
echo "Attempt 3: No Sandbox (Fixes Renderer Crashes)"
"$APP_PATH" --no-sandbox
if [ $? -eq 0 ]; then exit 0; fi

echo "----------------------------------------------------------------"
echo "Attempt 4: Disable GPU (Fixes Graphics Drivers)"
"$APP_PATH" --disable-gpu
if [ $? -eq 0 ]; then exit 0; fi

echo "----------------------------------------------------------------"
echo "Attempt 5: Last Resort (All Flags)"
"$APP_PATH" --no-sandbox --disable-gpu --disable-dev-shm-usage
