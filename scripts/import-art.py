"""Build runtime textures from supplied PNGs without modifying source files.

Usage: python scripts/import-art.py "C:/Users/admin/Desktop/美术资产"
Requires Pillow. Animation frame order and JSON event metadata are preserved.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import json
import sys

source = Path(sys.argv[1])
root = Path(__file__).resolve().parents[1]
dest = root / "public/assets/art"
dest.mkdir(parents=True, exist_ok=True)
manifest = {"images": {}, "animations": {}}
thumbs = []

def bounds(image):
    alpha = image.getchannel("A")
    return alpha.point(lambda a: 255 if a > 24 else 0).getbbox() or (0, 0, image.width, image.height)

for file in sorted(source.glob("*.png")):
    key = file.name.replace(".png.png", ".png")[:-4]
    if key.startswith("scene_"):
        continue  # Background is handled separately; concept sheet is not a game texture.
    image = Image.open(file).convert("RGBA")
    if image.getchannel("A").getextrema()[0] == 255:
        raise ValueError(f"Expected transparent PNG: {file.name}")
    image.thumbnail((640, 640), Image.Resampling.LANCZOS)
    image.save(dest / f"{key}.webp", quality=92, method=6)
    manifest["images"][key] = {"url": f"/assets/art/{key}.webp", "width": image.width, "height": image.height, "bounds": bounds(image)}
    thumbs.append((key, image.copy()))

for folder in sorted(p for p in source.iterdir() if p.is_dir()):
    files = list(folder.glob("*.json"))
    if not files:
        continue
    meta = json.loads(files[0].read_text(encoding="utf-8-sig"))
    key = folder.name
    count = meta["frameCount"]
    width, height = meta["frameWidth"], meta["frameHeight"]
    cols = meta["columns"]
    rows = meta["rows"]
    sheet = Image.open(folder / f"{key}_sheet.png").convert("RGBA")
    assert sheet.size == (width * cols, height * rows), (key, sheet.size)
    assert count <= cols * rows
    # All frames use the same scale; no per-frame trim/registration.
    factor = min(1, 384 / max(width, height))
    fw, fh = round(width * factor), round(height * factor)
    atlas = Image.new("RGBA", (fw * cols, fh * rows))
    union = [fw, fh, 0, 0]
    for i in range(count):
        frame = sheet.crop(((i % cols) * width, (i // cols) * height, (i % cols + 1) * width, (i // cols + 1) * height))
        frame = frame.resize((fw, fh), Image.Resampling.LANCZOS)
        bbox = bounds(frame)
        union = [min(union[0], bbox[0]), min(union[1], bbox[1]), max(union[2], bbox[2]), max(union[3], bbox[3])]
        atlas.paste(frame, ((i % cols) * fw, (i // cols) * fh))
        if i == 0:
            thumbs.append((key, frame.copy()))
    atlas.save(dest / f"{key}_sheet.webp", quality=90, method=6)
    fps = meta.get("frameRate", meta.get("fps", 10))
    repeat = meta.get("repeat", -1 if meta.get("loop") else 0)
    manifest["animations"][key] = {"url": f"/assets/art/{key}_sheet.webp", "frameWidth": fw, "frameHeight": fh, "frameCount": count, "frameRate": fps, "repeat": repeat, "bounds": union, "events": meta.get("events", [])}
    (dest / f"{key}.source.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

(root / "src/art-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
(root / "test-results").mkdir(exist_ok=True)
for page in range((len(thumbs) + 23) // 24):
    contact = Image.new("RGB", (960, 840), "#d8d2c6")
    draw = ImageDraw.Draw(contact)
    for n, (key, im) in enumerate(thumbs[page * 24 : (page + 1) * 24]):
        x, y = (n % 6) * 160, (n // 6) * 210
        im.thumbnail((150, 175))
        contact.paste(im, (x + (160 - im.width) // 2, y), im)
        draw.text((x + 4, y + 182), key, fill="#283228")
    contact.save(root / f"test-results/art-contact-{page}.jpg")
print(json.dumps({"images": len(manifest["images"]), "animations": len(manifest["animations"]), "runtimeMB": round(sum(p.stat().st_size for p in dest.glob("*")) / 1024**2, 2)}))
