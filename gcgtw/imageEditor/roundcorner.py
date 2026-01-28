#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Round Corner Image Processor for Trading Card Game
Processes card images in the st01 folder to add rounded corners.

Supported card types:
- st01-*: Standard set 01 cards
- T-*: Token cards  
- R-*: Rare cards
- EXR-*: Extra rare cards
- EXB-*: Extra booster cards

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


def _parse_hex_color(s: str) -> tuple[int, int, int]:
    s = s.strip()
    if s.startswith("#"):
        s = s[1:]
    if len(s) != 6:
        raise ValueError("Background must be a 6-digit hex color like #FFFFFF")
    r = int(s[0:2], 16)
    g = int(s[2:4], 16)
    b = int(s[4:6], 16)
    return r, g, b


def add_rounded_corners(
    image_path,
    output_path,
    radius=10,
    output_format="PNG",
    jpeg_quality=85,
    jpeg_progressive=True,
    background="#FFFFFF",
    scale=1.0,
    max_dim=0,
    png_compress_level=9,
    png_quantize=0,
):
    """
    Add rounded corners to an image.
    
    Args:
        image_path: Path to input image
        output_path: Path to save processed image
        radius: Corner radius in pixels (default: 10px for trading cards)
        output_format: PNG or JPEG
        jpeg_quality: JPEG quality (1-100)
        jpeg_progressive: progressive JPEG for web
        background: background color when output_format=JPEG (hex #RRGGBB)
    
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Open the image
        with Image.open(image_path) as img:
            # Convert to RGBA if not already (for transparency support)
            if img.mode != 'RGBA':
                img = img.convert('RGBA')

            # Optional resize to reduce output size
            if scale and float(scale) != 1.0:
                new_w = max(1, int(round(img.width * float(scale))))
                new_h = max(1, int(round(img.height * float(scale))))
                img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
            if max_dim and int(max_dim) > 0:
                md = int(max_dim)
                if max(img.width, img.height) > md:
                    if img.width >= img.height:
                        new_w = md
                        new_h = max(1, int(round(img.height * (md / img.width))))
                    else:
                        new_h = md
                        new_w = max(1, int(round(img.width * (md / img.height))))
                    img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
            
            # Create rounded corner mask
            mask = create_rounded_corner_mask(img.size, radius)
            
            # Create output image with transparent background
            output_rgba = Image.new('RGBA', img.size, (0, 0, 0, 0))
            output_rgba.paste(img, (0, 0), mask)

            fmt = str(output_format).upper()
            if fmt in {"JPG", "JPEG"}:
                # JPEG doesn't support alpha; flatten onto a background color.
                bg = _parse_hex_color(background)
                flattened = Image.new("RGB", img.size, bg)
                flattened.paste(output_rgba, mask=output_rgba.split()[-1])
                q = max(1, min(100, int(jpeg_quality)))
                flattened.save(
                    output_path,
                    "JPEG",
                    quality=q,
                    optimize=True,
                    progressive=bool(jpeg_progressive),
                )
            else:
                # PNG compression options
                cl = int(png_compress_level)
                cl = 0 if cl < 0 else 9 if cl > 9 else cl
                if png_quantize and int(png_quantize) > 0:
                    # Quantize (palette) can greatly reduce file size.
                    colors = max(2, min(256, int(png_quantize)))
                    # For RGBA images, Pillow only supports FASTOCTREE (2) or libimagequant (3).
                    # Use FASTOCTREE for broad compatibility.
                    try:
                        method = Image.Quantize.FASTOCTREE
                    except Exception:
                        method = 2
                    pal = output_rgba.quantize(colors=colors, method=method)
                    pal.save(output_path, "PNG", optimize=True, compress_level=cl)
                else:
                    output_rgba.save(output_path, "PNG", optimize=True, compress_level=cl)
            print(f"✅ Processed: {os.path.basename(image_path)} -> {os.path.basename(output_path)}")
            return True
            
    except Exception as e:
        print(f"❌ Error processing {image_path}: {str(e)}")
        return False


def process_card_images(base_path, radius=10, output_suffix="_rounded"):
    """
    Process all card images in the st01 folder that match supported prefixes.
    
    Supported filename prefixes:
    - st01-*: Standard set 01 cards
    - T-*: Token cards
    - R-*: Rare cards
    - EXR-*: Extra rare cards
    - EXB-*: Extra booster cards
    
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
    
    # Define supported prefixes
    supported_prefixes = ('ST01-', 'T-', 'R-', 'EXR-', 'EXB-')
    
    # Find all image files with supported prefixes
    image_extensions = {'.png', '.jpg', '.jpeg', '.bmp', '.gif'}
    all_files = [f for f in st01_path.iterdir() 
                 if f.is_file() and f.suffix.lower() in image_extensions]
    
    # Filter files by supported prefixes
    image_files = [f for f in all_files 
                   if f.name.startswith(supported_prefixes)]
    
    if not image_files:
        print(f"❌ No supported card images found in {st01_path}")
        print(f"🔍 Looking for files starting with: {', '.join(supported_prefixes)}")
        if all_files:
            print(f"📝 Found {len(all_files)} image files, but none match supported prefixes")
        return
    
    print(f"🖼️  Found {len(image_files)} card images in st01 folder")
    print(f"🔍 Supported prefixes: {', '.join(supported_prefixes)}")
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


def process_images_recursive(
    input_dir: Path,
    output_dir: Path,
    radius: int,
    output_suffix: str,
    extensions: set[str],
    output_format: str,
    jpeg_quality: int,
    jpeg_progressive: bool,
    background: str,
    scale: float,
    max_dim: int,
    png_compress_level: int,
    png_quantize: int,
) -> None:
    """
    Process all images under input_dir recursively, preserving folder structure under output_dir.

    Args:
        input_dir: root folder to scan
        output_dir: root folder to write outputs
        radius: corner radius in pixels
        output_suffix: suffix appended to output filename stem (before extension)
        extensions: allowed extensions (lowercased, including leading dot)
    """
    if not input_dir.exists():
        print(f"❌ Error: input folder not found at {input_dir}")
        return

    output_dir.mkdir(parents=True, exist_ok=True)

    files: list[Path] = []
    for p in input_dir.rglob("*"):
        if p.is_file() and p.suffix.lower() in extensions and not p.name.startswith("."):
            files.append(p)

    if not files:
        print(f"❌ No supported images found under {input_dir}")
        print(f"🔍 Extensions: {', '.join(sorted(extensions))}")
        return

    print(f"🖼️  Found {len(files)} images under {input_dir}")
    print(f"🔄 Processing with {radius}px rounded corners...")
    print(f"💾 Output directory: {output_dir}")
    print("-" * 50)

    successful = 0
    failed = 0

    try:
        for image_file in sorted(files):
            rel = image_file.relative_to(input_dir)
            fmt = str(output_format).lower()
            out_ext = ".jpeg" if fmt in {"jpg", "jpeg"} else rel.suffix
            out_rel = rel.with_name(f"{rel.stem}{output_suffix}{out_ext}")
            out_path = output_dir / out_rel
            out_path.parent.mkdir(parents=True, exist_ok=True)

            if add_rounded_corners(
                str(image_file),
                str(out_path),
                radius,
                output_format=output_format,
                jpeg_quality=jpeg_quality,
                jpeg_progressive=jpeg_progressive,
                background=background,
                scale=scale,
                max_dim=max_dim,
                png_compress_level=png_compress_level,
                png_quantize=png_quantize,
            ):
                successful += 1
            else:
                failed += 1
    except KeyboardInterrupt:
        print("\n⏹️  Interrupted by user, writing partial results...")

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
        '--input-dir',
        type=str,
        default='',
        help='Process all images under this directory (recursive). If set, overrides --path/st01 mode.'
    )

    parser.add_argument(
        '--out-dir',
        type=str,
        default='',
        help='Output directory for --input-dir mode (default: <input-dir>_rounded)'
    )

    parser.add_argument(
        '--extensions',
        type=str,
        default='.png,.jpg,.jpeg',
        help='Comma-separated extensions for --input-dir mode (default: .png,.jpg,.jpeg)'
    )

    parser.add_argument(
        '--format',
        type=str,
        default='png',
        choices=['png', 'jpeg', 'jpg'],
        help='Output format for --input-dir mode (default: png). Use jpeg/jpg for compressed output.'
    )

    parser.add_argument(
        '--jpeg-quality',
        type=int,
        default=85,
        help='JPEG quality (1-100, default: 85)'
    )

    parser.add_argument(
        '--jpeg-progressive',
        action=argparse.BooleanOptionalAction,
        default=True,
        help='Write progressive JPEGs (default: true)'
    )

    parser.add_argument(
        '--background',
        type=str,
        default='#FFFFFF',
        help='Background color when output is JPEG (default: #FFFFFF)'
    )

    parser.add_argument(
        '--scale',
        type=float,
        default=1.0,
        help='Resize scale factor before rounding (default: 1.0)'
    )

    parser.add_argument(
        '--max-dim',
        type=int,
        default=0,
        help='Downscale so max(width,height) <= this before rounding (0=off)'
    )

    parser.add_argument(
        '--png-compress-level',
        type=int,
        default=9,
        help='PNG compress_level 0-9 (default: 9, smaller/slower)'
    )

    parser.add_argument(
        '--png-quantize',
        type=int,
        default=0,
        help='If >0, quantize PNG to N colors (2-256) to reduce size (default: 0=off)'
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

    # Check if Pillow is available
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        print("❌ Error: Pillow (PIL) is required but not installed.")
        print("📦 Install with: pip install Pillow")
        sys.exit(1)

    print("🃏 Trading Card Rounded Corner Processor")
    print("=" * 50)
    print(f"🔘 Corner radius: {args.radius}px")
    print(f"📝 Output suffix: {args.suffix}")
    print()

    if args.input_dir:
        input_dir = Path(args.input_dir).expanduser().resolve()
        out_dir = Path(args.out_dir).expanduser().resolve() if args.out_dir else Path(f"{input_dir}_rounded")
        exts = {e.strip().lower() for e in args.extensions.split(",") if e.strip()}
        # normalize leading dot
        exts = {e if e.startswith(".") else f".{e}" for e in exts}
        process_images_recursive(
            input_dir,
            out_dir,
            args.radius,
            args.suffix,
            exts,
            args.format,
            args.jpeg_quality,
            args.jpeg_progressive,
            args.background,
            args.scale,
            args.max_dim,
            args.png_compress_level,
            args.png_quantize,
        )
        return

    # Legacy mode: Convert relative path to absolute and process `<base>/st01`.
    base_path = (Path(__file__).parent / args.path).resolve()
    print(f"📂 Base path: {base_path}")
    process_card_images(base_path, args.radius, args.suffix)


if __name__ == "__main__":
    main()
