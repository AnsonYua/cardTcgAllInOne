#!/bin/bash

# Find the process using port 3000
PID=$(lsof -ti :3000)

# Check if a process was found
if [ -n "$PID" ]; then
  echo "Killing process $PID using port 3000."
  kill -9 $PID
else
  echo "No process is using port 3000."
fi