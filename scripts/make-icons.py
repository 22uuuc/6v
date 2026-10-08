#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成墨影书城 PWA 图标：夜间书城风格（深蓝紫渐变 + 月亮 + 翻开书 + 星点）"""
from PIL import Image, ImageDraw


def make_icon(size: int, path: str) -> None:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    s = size / 512.0  # 缩放系数（以 512 为基准设计）

    radius = int(96 * s)
    bg2 = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bd2 = ImageDraw.Draw(bg2)
    for y in range(size):
        t = y / size
        r = int(60 + (22 - 60) * t)
        g = int(34 + (18 - 34) * t)
        b = int(120 + (58 - 120) * t)
        bd2.line([(0, y), (size, y)], fill=(r, g, b, 255))
    mask = Image.new("L", (size, size), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    bg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bg.paste(bg2, (0, 0), mask)
    img.paste(bg, (0, 0))

    d = ImageDraw.Draw(img)
    stars = [(90, 110, 5), (420, 90, 4), (470, 240, 3), (60, 320, 4), (240, 70, 3), (455, 400, 5)]
    for (sx, sy, sr) in stars:
        x, y, r = sx * s, sy * s, sr * s
        d.ellipse([x - r, y - r, x + r, y + r], fill=(240, 220, 255, 200))

    mx, my, mr = 400, 150, 58
    x, y, r = mx * s, my * s, mr * s
    for k in range(3, 0, -1):
        rr = r + k * 8 * s
        d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=(255, 214, 120, 40 - k * 8))
    d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 224, 150, 255))
    d.ellipse([x + r * 0.45, y - r * 0.6, x + r * 1.55, y + r * 0.9], fill=(26, 20, 64, 255))

    cx, cy = 256, 286
    w, h = 150, 96
    x0, y0 = cx - w, cy - h // 2
    left = [(x0 * s, (cy - 8) * s), (cx * s, (cy - h // 2) * s), (cx * s, (cy + h // 2) * s), ((x0 + 6) * s, (cy + 34) * s)]
    right = [(cx * s, (cy - h // 2) * s), ((cx + w) * s, (cy - 8) * s), ((cx + w - 6) * s, (cy + 34) * s), (cx * s, (cy + h // 2) * s)]
    d.polygon(left, fill=(255, 245, 235, 255))
    d.polygon(right, fill=(255, 245, 235, 255))
    for i in range(3):
        ly = (cy - 8) * s + (i + 1) * 14 * s
        d.line([(x0 + 16) * s, ly, (cx - 14) * s, ly], fill=(120, 96, 160, 255), width=max(2, int(4 * s)))
    for i in range(2):
        ly = (cy - 8) * s + (i + 1) * 14 * s
        d.line([(cx + 14) * s, ly, (cx + w - 16) * s, ly], fill=(120, 96, 160, 255), width=max(2, int(4 * s)))
    d.line([(cx * s, (cy - h // 2) * s), (cx * s, (cy + h // 2) * s)], fill=(70, 48, 120, 255), width=max(3, int(6 * s)))

    by = int(430 * s)
    d.rounded_rectangle([(cx - 110) * s, by, (cx + 110) * s, by + 22 * s], radius=11 * s, fill=(255, 255, 255, 30))
    for (sx, sy) in [(170, 210), (340, 230), (250, 175)]:
        x, y = sx * s, sy * s
        d.polygon([(x, y - 7 * s), (x + 2 * s, y - 2 * s), (x + 7 * s, y), (x + 2 * s, y + 2 * s), (x, y + 7 * s), (x - 2 * s, y + 2 * s), (x - 7 * s, y), (x - 2 * s, y - 2 * s)], fill=(255, 224, 150, 220))

    img.save(path, "PNG")


make_icon(192, "public/icons/icon-192.png")
make_icon(512, "public/icons/icon-512.png")
make_icon(512, "public/icons/icon-maskable-512.png")
print("icons generated")
