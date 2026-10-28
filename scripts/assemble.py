"""assemble.py —— 拼接「无头全链路测试」的运行文件

    dom-stub.js + 主脚本（从 index.html 提取）+ _driver.js  →  _run.js

关键点（踩过坑的）：
  1. **严格模式必须提升到整个文件最顶部**。主脚本以 "use strict" 开头时，
     拼接后若这条指令不在文件第一行就失效——而它恰好会掩盖"赋值给未声明变量"
     这类致命 bug（实测曾因此让整页打不开）。所以：外层统一加一条 "use strict"，
     再把 stub / 主脚本 / driver 各自的 use strict 剥掉。
  2. index.html 里可能同时有 <script>（主脚本）和 <script type="module">（如 CDN 加载器）。
     裸标签正则取到多段时要**取最长的一段**，并用 'use strict' 特征校验选对了。
  3. 取出来的主脚本必须包含 "use strict" —— 这是"选对了 script 块"的校验条件；
     若你的主脚本没有严格模式，改改这个校验条件即可。

用法：
    python assemble.py                        # 默认：./index.html + ./_tools/ 三件套
    python assemble.py --base <发布目录> --dev <脚手架目录>
"""
import re
import sys
import os
import argparse

p = argparse.ArgumentParser()
p.add_argument("--base", default=".", help="index.html 所在目录（发布目录）")
p.add_argument("--dev", default="_tools", help="dom-stub.js / _driver.js 所在目录（脚手架目录）")
p.add_argument("--out", default="", help="输出 _run.js 路径，默认 <dev>/_run.js")
args = p.parse_args()

base, dev = args.base, args.dev
out_path = args.out or os.path.join(dev, "_run.js")

html = open(os.path.join(base, "index.html"), encoding="utf-8").read()

# 页面里有 <script type="module"> 和裸 <script> 两种；裸标签的正则不会命中带属性的那个，
# 但为稳妥取最长的一段
cands = re.findall(r"<script>(.*?)</script>", html, re.S)
assert cands, "main script not found"
main = max(cands, key=len)
assert "use strict" in main, "picked the wrong script block"   # 校验：选中的是主脚本

stub = open(os.path.join(dev, "dom-stub.js"), encoding="utf-8").read()
driver = open(os.path.join(dev, "_driver.js"), encoding="utf-8").read()


def strip_strict(s):
    return re.sub(r'^\s*"use strict";\s*', "", s, count=1)


out = ('"use strict";\n'
       + strip_strict(stub)
       + "\n/* ===== MAIN SCRIPT ===== */\n" + strip_strict(main)
       + "\n/* ===== DRIVER ===== */\n" + strip_strict(driver))
open(out_path, "w", encoding="utf-8").write(out)
print("assembled", len(out), "chars ->", out_path)
