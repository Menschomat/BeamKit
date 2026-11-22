"""Rasterize the original geometric B mark, with a maskable safe area."""
from pathlib import Path
import struct
import zlib


def chunk(kind, data):
    return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)


def glyph(x, y):
    outer = 172 <= x <= 246 and 142 <= y <= 370 or (x - 246) ** 2 + (y - 200) ** 2 <= 58 ** 2 or (x - 246) ** 2 + (y - 312) ** 2 <= 58 ** 2
    inner = 218 <= x <= 246 and (174 <= y <= 226 or 286 <= y <= 338) or (x - 246) ** 2 + (y - 200) ** 2 <= 26 ** 2 or (x - 246) ** 2 + (y - 312) ** 2 <= 26 ** 2
    return outer and not inner


background = (44, 76, 92)
ink = (243, 227, 8)

for size in (192, 512):
    rows = bytearray()
    for y in range(size):
        rows.append(0)
        for x in range(size):
            coverage = sum(glyph((x + dx) * 512 / size, (y + dy) * 512 / size) for dx in (.25, .75) for dy in (.25, .75)) / 4
            rows.extend(round(base + (target - base) * coverage) for base, target in zip(background, ink))
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(rows)) + chunk(b'IEND', b'')
    Path(f'public/icon-{size}.png').write_bytes(png)
