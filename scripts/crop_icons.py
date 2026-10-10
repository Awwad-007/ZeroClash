import os
from PIL import Image, ImageDraw

def find_text_and_crop():
    src_path = "public/assets/equipment-sheet.jpeg"
    if not os.path.exists(src_path):
        # Fallback to user uploaded path if not copied yet
        src_path = "C:/Users/lenovo/.gemini/antigravity/brain/ac4fe519-d1b6-4a38-97ae-69ddec61dc4e/.user_uploaded/media_1791629726066.png"
    
    img = Image.open(src_path).convert("RGBA")
    w, h = img.size
    print(f"Source size: {w}x{h}")
    
    # 4 columns, 2 rows
    # Row 0: camera, gpu, vr, microscope
    # Row 1: printer, projector, labkit, device
    col_w = w / 4.0  # 256
    row_h = h / 2.0  # 286
    
    grid = [
        ["camera", "gpu", "vr", "microscope"],
        ["printer", "projector", "labkit", "device"]
    ]
    
    os.makedirs("public/assets/icons", exist_ok=True)
    
    for r in range(2):
        for c in range(4):
            name = grid[r][c]
            x0 = int(c * col_w)
            y0 = int(r * row_h)
            x1 = int((c + 1) * col_w)
            y1 = int((r + 1) * row_h)
            
            cell = img.crop((x0, y0, x1, y1))
            
            # Find the text start in the bottom area (from y=180 downwards)
            text_top = y1 - y0
            for y in range(180, cell.height):
                for x in range(cell.width):
                    p = cell.getpixel((x, y))
                    # Bright text pixels
                    if p[0] > 160 and p[1] > 160 and p[2] > 160:
                        if y < text_top:
                            text_top = y
            print(f"Icon {name}: text detected at y={text_top} in cell")
            
            # Icon pedestal is centered roughly at cx = col_w / 2, cy in range [100, 120]
            # Pedestal bottom usually reaches around y=210-220
            # Text usually starts around y=230-245
            # We want to crop the icon with a circular mask
            # Center of the circular mask:
            cx = cell.width / 2.0
            # Center vertically on the icon:
            # Most icons span roughly from y=30 to y=205. Midpoint is ~118.
            cy = 118.0
            radius = 98.0  # Diameter ~196px, perfectly encompasses the circular pedestal and icon, cutting off before text
            
            # Create high-res circular mask with antialiasing
            scale = 4
            mask_size = (int(radius * 2 * scale), int(radius * 2 * scale))
            mask = Image.new("L", mask_size, 0)
            draw = ImageDraw.Draw(mask)
            draw.ellipse((0, 0, mask_size[0] - 1, mask_size[1] - 1), fill=255)
            mask = mask.resize((int(radius * 2), int(radius * 2)), Image.Resampling.LANCZOS)
            
            # Crop the bounding box of the circle from the cell
            box_x0 = int(cx - radius)
            box_y0 = int(cy - radius)
            box_x1 = box_x0 + int(radius * 2)
            box_y1 = box_y0 + int(radius * 2)
            
            icon_crop = cell.crop((box_x0, box_y0, box_x1, box_y1))
            
            # Apply alpha mask
            icon_crop.putalpha(mask)
            
            out_file = f"public/assets/icons/{name}.png"
            icon_crop.save(out_file, "PNG")
            print(f"Saved {out_file} (size: {icon_crop.size})")

if __name__ == "__main__":
    find_text_and_crop()
