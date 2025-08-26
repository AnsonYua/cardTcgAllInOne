#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Round Corner Image Processor for Trading Card Game
Processes images in the st01 folder to add rounded corners.

For trading card games, recommended corner radius:
- 8px: Subtle rounded corners (professional)
- 10px: Moderate rounded corners (balanced)
- 12px: Noticeable rounded corners (modern look)
- 15px: Strong rounded corners (distinctive)

Author: Generated for Trading Card Game Project
"""

import os
import sys
from pathlib import Path
from PIL import Image, ImageDraw
import argparse


def create_rounded_corner_mask(size, radius):
    """
    Create a mask for rounded corners.
    
    Args:
        size: Tuple of (width, height)
        radius: Corner radius in pixels
    
    Returns:
        PIL Image mask for rounded corners
    """
    width, height = size
    
    # Create a mask image with transparent background
    mask = Image.new('L', size, 0)
    draw = ImageDraw.Draw(mask)
    
    # Draw rounded rectangle in white (opaque areas)
    draw.rounded_rectangle(
        (0, 0, width, height),
        radius=radius,
        fill=255
    )
    
    return mask


def add_rounded_corners(image_path, output_path, radius=10):
    """
    Add rounded corners to an image.
    
    Args:
        image_path: Path to input image
        output_path: Path to save processed image
        radius: Corner radius in pixels (default: 10px for trading cards)
    
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Open the image
        with Image.open(image_path) as img:
            # Convert to RGBA if not already (for transparency support)
            if img.mode != 'RGBA':
                img = img.convert('RGBA')
            
            # Create rounded corner mask
            mask = create_rounded_corner_mask(img.size, radius)
            
            # Create output image with transparent background
            output = Image.new('RGBA', img.size, (0, 0, 0, 0))
            
            # Paste the original image using the mask
            output.paste(img, (0, 0), mask)
            
            # Save the result
            output.save(output_path, 'PNG')
            print(f"✅ Processed: {os.path.basename(image_path)} -> {os.path.basename(output_path)}")
            return True
            
    except Exception as e:
        print(f"❌ Error processing {image_path}: {str(e)}")
        return False


def process_st01_folder(base_path, radius=10, output_suffix="_rounded"):
    """
    Process all images in the st01 folder.
    
    Args:
        base_path: Base path containing st01 folder
        radius: Corner radius in pixels
        output_suffix: Suffix to add to processed filenames
    """
    st01_path = Path(base_path) / "st01"
    
    if not st01_path.exists():
        print(f"❌ Error: st01 folder not found at {st01_path}")
        return
    
    # Create output directory
    output_dir = st01_path / "rounded"
    output_dir.mkdir(exist_ok=True)
    
    # Find all image files
    image_extensions = {'.png', '.jpg', '.jpeg', '.bmp', '.gif'}
    image_files = [f for f in st01_path.iterdir() 
                   if f.is_file() and f.suffix.lower() in image_extensions]
    
    if not image_files:
        print(f"❌ No image files found in {st01_path}")
        return
    
    print(f"🖼️  Found {len(image_files)} images in st01 folder")
    print(f"🔄 Processing with {radius}px rounded corners...")
    print(f"💾 Output directory: {output_dir}")
    print("-" * 50)
    
    successful = 0
    failed = 0
    
    for image_file in sorted(image_files):
        # Create output filename
        stem = image_file.stem
        ext = image_file.suffix
        output_filename = f"{stem}{output_suffix}{ext}"
        output_path = output_dir / output_filename
        
        if add_rounded_corners(str(image_file), str(output_path), radius):
            successful += 1
        else:
            failed += 1
    
    print("-" * 50)
    print(f"📊 Processing complete:")
    print(f"   ✅ Successful: {successful}")
    print(f"   ❌ Failed: {failed}")
    print(f"   📁 Output folder: {output_dir}")


def main():
    """Main function with command line interface."""
    parser = argparse.ArgumentParser(
        description="Add rounded corners to trading card images",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Trading Card Rounded Corner Recommendations:
  8px  - Subtle, professional look
  10px - Balanced, standard for most cards (DEFAULT)
  12px - Noticeable, modern appearance
  15px - Strong, distinctive corners

Examples:
  python roundcorner.py                    # Use default 10px radius
  python roundcorner.py --radius 8        # Subtle 8px corners
  python roundcorner.py --radius 12       # More pronounced 12px corners
  python roundcorner.py --path /custom/path --radius 15
        """
    )
    
    parser.add_argument(
        '--radius', '-r',
        type=int,
        default=10,
        help='Corner radius in pixels (default: 10px - recommended for trading cards)'
    )
    
    parser.add_argument(
        '--path', '-p',
        type=str,
        default='../../cardBackend/src/data/image',
        help='Base path containing st01 folder (default: ../../cardBackend/src/data/image)'
    )
    
    parser.add_argument(
        '--suffix', '-s',
        type=str,
        default='',
        help='Suffix for output filenames (default: _rounded)'
    )
    
    args = parser.parse_args()
    
    # Convert relative path to absolute
    base_path = Path(__file__).parent / args.path
    base_path = base_path.resolve()
    
    print("🃏 Trading Card Rounded Corner Processor")
    print("=" * 50)
    print(f"📂 Base path: {base_path}")
    print(f"🔘 Corner radius: {args.radius}px")
    print(f"📝 Output suffix: {args.suffix}")
    print()
    
    # Check if Pillow is available
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        print("❌ Error: Pillow (PIL) is required but not installed.")
        print("📦 Install with: pip install Pillow")
        sys.exit(1)
    
    # Process the st01 folder
    process_st01_folder(base_path, args.radius, args.suffix)


if __name__ == "__main__":
    main()