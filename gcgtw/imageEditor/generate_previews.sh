#!/bin/bash
# Quick batch script for generating trading card previews

echo "🃏 Trading Card Preview Generator - Quick Start"
echo "=============================================="

# Navigate to script directory
cd "$(dirname "$0")"

# Check if Python script exists
if [ ! -f "preview_generator.py" ]; then
    echo "❌ Error: preview_generator.py not found"
    exit 1
fi

# Default: Generate 1/4 size previews with high quality
echo "🔄 Generating 1/4 size previews with high quality..."
python3 preview_generator.py

echo ""
echo "✅ Preview generation complete!"
echo "📁 Check the 'previews' folder in your st01 directory"
echo ""
echo "💡 Other options:"
echo "   python3 preview_generator.py --scale 0.5     # 1/2 size previews"
echo "   python3 preview_generator.py --quality fast  # Faster processing"
echo "   python3 preview_generator.py --help          # See all options"