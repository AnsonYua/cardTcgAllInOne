#!/bin/bash

# Find the process using port 8080
PID=$(lsof -ti :8080)

# Check if a process was found
if [ -n "$PID" ]; then
  echo "Killing process $PID using port 8080."
  kill -9 $PID
else
  echo "No process is using port 8080."
fi