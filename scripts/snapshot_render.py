"""snapshot_render.py —— 把「几何快照」离线渲染成 PNG（供无浏览器 / 看不到图的场景审阅形态）

为什么需要它：
  当 AI 无法查看图片、或想在无浏览器的环境里审阅"粒子形态画出来长什么样"时，
  让 driver 把每颗粒子的最终坐标/尺寸/亮度/色号导出成 JSON（见 references/harness.md 的快照导出模式），
  再用本脚本做加色光点渲染，产出 PNG 给人眼看。

输入 JSON 格式（自定义约定，driver 导出时照此组装）：
  {
    "states": [
      { "name": "bt=1.00", "items": [[x, y, size, alpha, colorIndex], ...] },
      ...
    ]
  }

渲染要点（与浏览器端发光粒子的观感对齐）：
  · 加色叠加：各粒子按径向衰减权重累加进 RGB 浮点缓冲，最后钳位 255 —— 等价于 canvas 的 "lighter"。
  · 降采样：可先按 1/2 分辨率累加再 LANCZOS 放大（快且柔和，接近真实屏幕观感）。
  · 单粒权重 (1 - d/R)^3：中心亮、边缘快速衰减，模拟辉光贴图。

用法：
    python snapshot_render.py <_geom.json> [--out-prefix <前缀>] [--w 1440] [--h 900] [--ss 2]

依赖：Pillow（`python -m pip install pillow`）
"""
import json
import sys
import argparse

# 色板：与页面 GLOW / 调色板一一对应（按项目改）
COLORS = [
    (80, 162, 246), (124, 204, 255), (186, 226, 255),
    (224, 240, 255), (150, 255, 218), (180, 170, 255),
]


def render(items, path, W, H, SS):
    sw, sh = W // SS, H // SS
    rbuf = [0.0] * (sw * sh)
    gbuf = [0.0] * (sw * sh)
    bbuf = [0.0] * (sw * sh)
    for it in items:
        x, y, sz, al = it[0], it[1], it[2], it[3]
        ci = int(it[4]) if len(it) > 4 else 2
        cr, cg, cb = COLORS[ci % len(COLORS)]
        cx, cy = x / SS, y / SS
        r = max(1.6, sz * 0.30)
        R = int(r * 2.4) + 1
        icx, icy = int(cx), int(cy)
        for dy in range(-R, R + 1):
            yy = icy + dy
            if yy < 0 or yy >= sh:
                continue
            row = yy * sw
            for dx in range(-R, R + 1):
                xx = icx + dx
                if xx < 0 or xx >= sw:
                    continue
                d = (dx * dx + dy * dy) ** 0.5
                if d > R:
                    continue
                w = ((1 - d / R) ** 3.0) * al * 1.15
                i2 = row + xx
                rbuf[i2] += cr * w
                gbuf[i2] += cg * w
                bbuf[i2] += cb * w
    from PIL import Image
    img = Image.new("RGB", (sw, sh))
    px = img.load()
    for i in range(sw * sh):
        px[i % sw, i // sw] = (
            min(255, int(rbuf[i])),
            min(255, int(gbuf[i])),
            min(255, int(bbuf[i])),
        )
    img = img.resize((W, H), Image.LANCZOS)
    img.save(path)
    print("saved", path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("geom", help="_geom.json 路径")
    ap.add_argument("--out-prefix", default="", help="输出 PNG 前缀，默认与 json 同目录")
    ap.add_argument("--w", type=int, default=1440)
    ap.add_argument("--h", type=int, default=900)
    ap.add_argument("--ss", type=int, default=2, help="降采样倍率")
    a = ap.parse_args()

    data = json.load(open(a.geom, encoding="utf-8"))
    prefix = a.out_prefix or a.geom.rsplit(".", 1)[0]
    for st in data["states"]:
        name = str(st.get("name", "state")).replace("=", "").replace(".", "_").replace(" ", "")
        render(st["items"], prefix + "_" + name + ".png", a.w, a.h, a.ss)
    print("done")


if __name__ == "__main__":
    main()
