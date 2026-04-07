#!/bin/bash
# Kinofan Build Script
echo "--- Installing dependencies ---"
npm install
echo "--- Building production bundle ---"
npm run build
echo "--- Build complete ---"
