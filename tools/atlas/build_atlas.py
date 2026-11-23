#!/usr/bin/env python3
"""Key the white studio background off generated paper stickers and pack a texture atlas.

Only a deterministic flood fill is used: white + neutral drop shadow is background,
the warm cream sticker border is the stopping edge. No ML, no manual masking.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

CREAM = np.array([247, 239, 216], dtype=np.float32) / 255.0


def key_sticker(rgb01: np.ndarray) -> np.ndarray:
    """Return a float alpha mask 0..1 with the studio background removed (input is 0..1 RGB)."""
    a = rgb01
    mx = a.max(axis=2)
    mn = a.min(axis=2)
    sat = (mx - mn) / np.maximum(mx, 1e-6)
    luma = 0.2126 * a[:, :, 0] + 0.7152 * a[:, :, 1] + 0.0722 * a[:, :, 2]

    # White paper and neutral grey shadow are background candidates.
    # The warm cream die-cut border has higher saturation, so it blocks the flood.
    candidate = ((sat < 0.075) & (luma > 0.70)) | (luma > 0.985)

    seeds = np.zeros_like(candidate)
    seeds[0, :] = True
    seeds[-1, :] = True
    seeds[:, 0] = True
    seeds[:, -1] = True
    seeds &= candidate
    if not seeds.any():
        raise RuntimeError("no background seeds")

    bg = ndi.binary_propagation(seeds, mask=candidate)
    alpha = (~bg).astype(np.float32)

    # Remove tiny floating specks outside the sticker.
    labels, n = ndi.label(alpha > 0.5)
    if n:
        sizes = ndi.sum(alpha > 0.5, labels, range(1, n + 1))
        keep = np.zeros_like(alpha, dtype=bool)
        for i, size in enumerate(sizes, 1):
            if size > 120:
                keep |= labels == i
        alpha *= keep

    # A touch of smoothing keeps the cut edge soft at in-game sizes.
    alpha = ndi.gaussian_filter(alpha, 0.6)
    return np.clip(alpha, 0.0, 1.0)


def cutout(path: Path) -> Image.Image:
    img = Image.open(path).convert("RGB")
    rgb = np.asarray(img).astype(np.float32) / 255.0
    alpha = key_sticker(rgb)

    covered = alpha > 0.02
    area = float(covered.mean())
    if area < 0.02 or area > 0.97:
        raise RuntimeError(f"implausible sticker area {area:.3f}")

    ys, xs = np.where(covered)
    x0, x1 = max(0, xs.min() - 8), min(img.width, xs.max() + 9)
    y0, y1 = max(0, ys.min() - 8), min(img.height, ys.max() + 9)

    out_rgb = rgb.copy()
    # Transparent pixels get the cream colour to avoid dark halos under filtering.
    out_rgb[~covered] = CREAM
    out = np.dstack([out_rgb, alpha])
    out_img = Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8), "RGBA")
    return out_img.crop((x0, y0, x1, y1))


def checker(size: tuple[int, int], cell: int = 16) -> Image.Image:
    im = Image.new("RGB", size, (235, 235, 235))
    draw = ImageDraw.Draw(im)
    for y in range(0, size[1], cell):
        for x in range(0, size[0], cell):
            if (x // cell + y // cell) % 2:
                draw.rectangle([x, y, x + cell - 1, y + cell - 1], fill=(210, 210, 210))
    return im


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("src", type=Path)
    ap.add_argument("out", type=Path)
    ap.add_argument("--atlas-size", type=int, default=2048)
    ap.add_argument("--cell", type=int, default=400)
    ap.add_argument("--cols", type=int, default=5)
    args = ap.parse_args()

    files = sorted(p for p in args.src.glob("*.png") if not p.name.startswith("_"))
    if not files:
        print("no PNG files", file=sys.stderr)
        return 1

    cut_dir = args.out / "cut"
    cut_dir.mkdir(parents=True, exist_ok=True)

    entries: list[tuple[str, Image.Image]] = []
    for path in files:
        try:
            im = cutout(path)
        except Exception as exc:  # noqa: BLE001
            print(f"FAIL {path.name}: {exc}", file=sys.stderr)
            continue
        im.save(cut_dir / path.name)
        entries.append((path.stem, im))
        arr = np.asarray(im)[:, :, 3]
        print(
            f"{path.stem:16s} {im.width:4d}x{im.height:<4d} "
            f"opaque={float((arr > 245).mean()):.2%} soft={float(((arr > 10) & (arr < 245)).mean()):.2%}"
        )

    if not entries:
        print("nothing keyed", file=sys.stderr)
        return 1

    atlas_size = args.atlas_size
    cell = args.cell
    cols = args.cols
    rows = (len(entries) + cols - 1) // cols
    if rows * cell > atlas_size:
        raise SystemExit(f"{len(entries)} stickers need more than {atlas_size}px at {cell}px cells")

    atlas = Image.new("RGBA", (atlas_size, atlas_size), (0, 0, 0, 0))
    regions: dict[str, dict[str, int]] = {}

    for idx, (name, im) in enumerate(entries):
        scale = min((cell - 16) / im.width, (cell - 16) / im.height, 1.0)
        w = max(1, int(round(im.width * scale)))
        h = max(1, int(round(im.height * scale)))
        resized = im.resize((w, h), Image.LANCZOS)
        cx = (idx % cols) * cell
        cy = (idx // cols) * cell
        x = cx + (cell - w) // 2
        y = cy + cell - h - 8
        atlas.alpha_composite(resized, (x, y))
        regions[name] = {"x": x, "y": y, "w": w, "h": h}

    args.out.mkdir(parents=True, exist_ok=True)
    atlas.save(args.out / "props.webp", "WEBP", quality=92, method=6)
    meta = {"image": "props.webp", "size": atlas_size, "regions": regions}
    (args.out / "props.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")

    # Contact sheet for quick visual review.
    sheet_cols = 5
    sheet_cell = 260
    sheet_rows = (len(entries) + sheet_cols - 1) // sheet_cols
    sheet = checker((sheet_cols * sheet_cell, sheet_rows * sheet_cell))
    draw = ImageDraw.Draw(sheet)
    for idx, (name, im) in enumerate(entries):
        scale = min((sheet_cell - 20) / im.width, (sheet_cell - 26) / im.height, 1.0)
        thumb = im.resize(
            (max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.LANCZOS
        )
        cx = (idx % sheet_cols) * sheet_cell
        cy = (idx // sheet_cols) * sheet_cell
        sheet.paste(thumb, (cx + (sheet_cell - thumb.width) // 2, cy + sheet_cell - thumb.height - 18), thumb)
        draw.text((cx + 6, cy + 6), name, fill=(40, 30, 20))
    sheet.save(args.out / "contact_sheet.png")
    print(f"atlas {args.out / 'props.webp'}  stickers={len(entries)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
