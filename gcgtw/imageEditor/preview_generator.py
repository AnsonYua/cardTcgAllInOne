#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Trading Card Preview Generator
Creates preview/thumbnail images at 1/4 original size for faster loading.

Perfect for:
- Card browser thumbnails
- Quick preview grids
- Web interface optimization
- Mobile app performance

Author: Generated for Trading Card Game Project
"""

import os
import sys
from pathlib import Path
from PIL import Image, ImageFilter
import argparse


def create_preview(image_path, output_path, scale_factor=0.25, quality='high'):
    """
    Create a preview/thumbnail image.
    
    Args:
        image_path: Path to input image
        output_path: Path to save preview image
        scale_factor: Scale factor (0.25 = 1/4 size, 0.5 = 1/2 size)
        quality: Resizing quality ('high', 'medium', 'fast')
    
    Returns:
        tuple: (success: bool, original_size: tuple, preview_size: tuple)
    """
    try:
        with Image.open(image_path) as img:
            original_size = img.size
            
            # Calculate new size
            new_width = int(img.width * scale_factor)
            new_height = int(img.height * scale_factor)
            new_size = (new_width, new_height)
            
            # Choose resampling algorithm based on quality
            if quality == 'high':
                # Best quality, slower
                resample = Image.Resampling.LANCZOS
            elif quality == 'medium':
                # Good balance
                resample = Image.Resampling.BILINEAR
            else:  # 'fast'
                # Fastest, lower quality
                resample = Image.Resampling.NEAREST
            
            # Resize the image
            preview = img.resize(new_size, resample)
            
            # Optional: Apply slight sharpening for small previews
            if scale_factor <= 0.25:
                preview = preview.filter(ImageFilter.UnsharpMask(radius=0.5, percent=120, threshold=3))
            
            # Save preview
            if img.mode == 'RGBA' or 'transparency' in img.info:
                preview.save(output_path, 'PNG', optimize=True)
            else:
                preview.save(output_path, 'JPEG', quality=90, optimize=True)
            
            print(f"✅ {os.path.basename(image_path)}: {original_size[0]}x{original_size[1]} -> {new_size[0]}x{new_size[1]}")
            return True, original_size, new_size
            
    except Exception as e:
        print(f"❌ Error processing {image_path}: {str(e)}")
        return False, None, None


def process_folder(input_path, output_folder="previews", scale_factor=0.25, quality='high'):
    """
    Process all images in a folder to create previews.
    
    Args:
        input_path: Path to folder containing images
        output_folder: Name of output folder (created inside input_path)
        scale_factor: Scale factor for resizing
        quality: Resizing quality
    """
    input_path = Path(input_path)
    
    if not input_path.exists():
        print(f"❌ Error: Input folder not found at {input_path}")
        return
    
    # Create output directory
    output_dir = input_path / output_folder
    output_dir.mkdir(exist_ok=True)
    
    # Find all image files
    image_extensions = {'.png', '.jpg', '.jpeg', '.bmp', '.gif', '.webp'}
    image_files = [f for f in input_path.iterdir() 
                   if f.is_file() and f.suffix.lower() in image_extensions]
    
    if not image_files:
        print(f"❌ No image files found in {input_path}")
        return
    
    print(f"🖼️  Found {len(image_files)} images")
    print(f"📏 Scale factor: {scale_factor} (1/{int(1/scale_factor)} original size)")
    print(f"🎯 Quality: {quality}")
    print(f"💾 Output directory: {output_dir}")
    print("-" * 60)
    
    successful = 0
    failed = 0
    total_original_size = 0
    total_preview_size = 0
    
    for image_file in sorted(image_files):
        # Create output filename
        stem = image_file.stem
        # Use PNG for transparency, JPEG for others (smaller file size)
        if image_file.suffix.lower() == '.png':
            output_filename = f"{stem}.png"
        else:
            output_filename = f"{stem}.jpg"
        
        output_path = output_dir / output_filename
        
        success, orig_size, prev_size = create_preview(
            str(image_file), str(output_path), scale_factor, quality
        )
        
        if success:
            successful += 1
            # Calculate file sizes for statistics
            try:
                orig_file_size = image_file.stat().st_size
                prev_file_size = output_path.stat().st_size
                total_original_size += orig_file_size
                total_preview_size += prev_file_size
            except:
                pass
        else:
            failed += 1
    
    print("-" * 60)
    print(f"📊 Processing complete:")
    print(f"   ✅ Successful: {successful}")
    print(f"   ❌ Failed: {failed}")
    print(f"   📁 Output folder: {output_dir}")
    
    if total_original_size > 0 and total_preview_size > 0:
        size_reduction = (1 - total_preview_size / total_original_size) * 100
        print(f"   💾 File size reduction: {size_reduction:.1f}%")
        print(f"   📦 Original total: {total_original_size / 1024 / 1024:.1f} MB")
        print(f"   📦 Preview total: {total_preview_size / 1024 / 1024:.1f} MB")


def main():
    """Main function with command line interface."""
    parser = argparse.ArgumentParser(
        description="Generate preview/thumbnail images for trading cards",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Preview Size Recommendations:
  0.25 (1/4) - Standard thumbnails for card browsers (DEFAULT)
  0.33 (1/3) - Larger thumbnails for detailed previews
  0.5  (1/2) - Medium previews for mobile interfaces
  
Quality Options:
  high   - Best quality, LANCZOS resampling (slower)
  medium - Good balance, BILINEAR resampling
  fast   - Fastest processing, NEAREST resampling
  
Examples:
  python preview_generator.py                           # 1/4 size, high quality
  python preview_generator.py --scale 0.5              # 1/2 size previews
  python preview_generator.py --quality fast           # Fast processing
  python preview_generator.py --path st01 --scale 0.33 # Custom folder and size
        """
    )
    
    parser.add_argument(
        '--scale', '-s',
        type=float,
        default=0.25,
        help='Scale factor (0.25 = 1/4 size, 0.5 = 1/2 size, default: 0.25)'
    )
    
    parser.add_argument(
        '--quality', '-q',
        type=str,
        default='high',
        choices=['high', 'medium', 'fast'],
        help='Resizing quality (default: high)'
    )
    
    parser.add_argument(
        '--path', '-p',
        type=str,
        default='../../cardBackend/src/data/image/st01',
        help='Path to folder containing images (default: ../../cardBackend/src/data/image/st01)'
    )
    
    parser.add_argument(
        '--output', '-o',
        type=str,
        default='previews',
        help='Output folder name (default: previews)'
    )
    
    args = parser.parse_args()
    
    # Convert relative path to absolute
    input_path = Path(__file__).parent / args.path
    input_path = input_path.resolve()
    
    # Validate scale factor
    if args.scale <= 0 or args.scale > 1:
        print("❌ Error: Scale factor must be between 0 and 1")
        sys.exit(1)
    
    print("🖼️  Trading Card Preview Generator")
    print("=" * 50)
    print(f"📂 Input path: {input_path}")
    print(f"📏 Scale factor: {args.scale} (1/{int(1/args.scale)} original size)")
    print(f"🎯 Quality: {args.quality}")
    print(f"📁 Output folder: {args.output}")
    print()
    
    # Check if Pillow is available
    try:
        from PIL import Image, ImageFilter
    except ImportError:
        print("❌ Error: Pillow (PIL) is required but not installed.")
        print("📦 Install with: pip install Pillow")
        sys.exit(1)
    
    # Process the folder
    process_folder(input_path, args.output, args.scale, args.quality)


if __name__ == "__main__":
    main()