from PIL import Image, ImageDraw

INK = (20, 22, 27, 255)
IRON = (225, 75, 52, 255)

def draw_barbell(draw, cx, cy, w, bar_h, plate_w, plate_h, color):
    draw.rounded_rectangle([cx-w/2, cy-bar_h/2, cx+w/2, cy+bar_h/2], radius=bar_h/2, fill=color)
    for side in (-1, 1):
        x = cx + side * w/2
        draw.rounded_rectangle([x-plate_w/2, cy-plate_h/2, x+plate_w/2, cy+plate_h/2], radius=plate_w*0.35, fill=color)

def make_icon(size, maskable, path):
    img = Image.new("RGBA", (size, size), INK)
    d = ImageDraw.Draw(img)
    scale = 0.62 if maskable else 0.9

    cx, cy = size/2, size/2
    w = size * 0.44 * scale
    bar_h = size * 0.11 * scale
    plate_w = size * 0.12 * scale
    plate_h = size * 0.46 * scale

    draw_barbell(d, cx, cy, w, bar_h, plate_w, plate_h, IRON)
    img.save(path, "PNG")

make_icon(192, False, "icons/icon-192.png")
make_icon(512, False, "icons/icon-512.png")
make_icon(192, True, "icons/icon-maskable-192.png")
make_icon(512, True, "icons/icon-maskable-512.png")
print("done")
