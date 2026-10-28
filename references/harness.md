# 无头全链路测试（harness）详解

> 目标：**在没有浏览器的情况下，把交互网页从"进入场景 → 各种交互 → 收尾"整条路径跑一遍**，
> 抓住语法检查抓不到的运行时崩溃（未声明变量、TDZ、null 引用、NaN 传染），并断言交互逻辑真的生效。

## 为什么需要它（实战战绩）

- 一次 `X = ...` 忘写 `let`（严格模式下 ReferenceError）让整个页面**打开完全没反应**——
  顶层初始化一崩，后面所有事件绑定都不执行。语法检查（`node --check`）完全看不出问题，
  DOM-stub 测试第一帧就抓到了。
- 一次移动端档位改造中 `applyCloudStep()` 在 `resize()` 里被调用、但依赖的数组声明在它下面（TDZ），
  也是 stub 测试立即抓住。**大改之后不跑这套测试 = 把 bug 直接交付给用户。**

## 三件套职责

| 文件 | 职责 |
|---|---|
| `dom-stub.js` | 伪造浏览器环境（DOM/Canvas/WebAudio/rAF/伪时钟），并暴露 `global.__T` 驱动器接口 |
| 主脚本 | 从 `index.html` 里提取（不复制！永远是测试最新版） |
| `_driver.js` | 测试脚本本体：点按钮进场景 → 泵帧 → 派发事件 → 注入假数据 → 断言状态 → 导出快照 |
| `assemble.py` | 拼接三者为 `_run.js`（**严格模式提升到文件顶部**） |

运行：`python _assemble.py && node _run.js`（Windows 下写成两条命令或用 `;` 连接）。

## 驱动器接口（driver 里能用的东西）

```js
const T = global.__T;
T.ELEMENTS        // 所有你列进 IDS 的元素；事件用 T.ELEMENTS.magic._ls 拿 handler 表
T.WIN_LS          // window 级事件 handler 表（mouseup 等）
T.RAFQ            // rAF 队列
T.advance(16.7)   // 推进伪时钟 16.7ms（帧间隔）
T.step()          // 泵一帧：把当前排队的 rAF 回调全部执行
T.fire(store, "mousedown", { clientX: 700, clientY: 420, button: 0 })   // 派发事件
```

## driver 编写模式（照抄这个骨架）

```js
const T = global.__T;
let fails = 0;
function log(m) { console.log("[TEST] " + m); }
function expect(cond, msg) { if (cond) log("PASS: " + msg); else { fails++; log("FAIL: " + msg); } }

try {
  /* 1. 进场景：模拟点按钮 */
  T.fire(T.ELEMENTS["btn-mouse"]._ls, "click", {});
  expect(mode === "mouse", "mode = mouse");

  /* 2. 泵帧：等状态稳定（90 帧）= 1.5 秒 */
  for (let i = 0; i < 90; i++) { T.advance(16.7); T.step(); }
  expect(bloom.bloomT > 0.1 && bloom.bloomT < 1.01, "idle bloomT=" + bloom.bloomT.toFixed(2));

  /* 3. 鼠标路径：mousemove → mousedown → 泵帧 → 断言 */
  T.fire(T.ELEMENTS.magic._ls, "mousedown", { clientX: 700, clientY: 420, button: 0 });
  for (let i = 0; i < 80; i++) { T.advance(16.7); T.step(); }
  expect(bloom.bloomT > 0.9, "bloom open, bloomT=" + bloom.bloomT.toFixed(2));

  /* 4. 摄像头路径：绕过引擎，直接向主循环注入"假手数据" */
  /*    前提：把主脚本里"分析结果"的结构摸清，字段一个不能少（缺字段 → NaN 假警报） */
  const mkA = (g, extra) => Object.assign({
    gesture: g, openness: g === "fist" ? 0.8 : 1.7, scale: 0.16, roll: 0,
    palm: { x: 600, y: 400 }, pinchX: 620, pinchY: 420,
    pts: Array.from({ length: 21 }, (_, i) => ({ x: 550 + i * 2, y: 380 + i * 3 })),
  }, extra || {});
  const h = { x: 600, y: 400, /* ...主脚本 tracked 对象需要的全部字段... */ data: mkA("open") };
  tracked.set(0, h);
  mode = "camera";
  T.advance(16.7); T.step();
  expect(bloom.target > 0.9, "hand open → target=" + bloom.target.toFixed(2));

  /* 5. 新特性要逐条加断言（改了不测 = 没改） */
  expect(Number.isFinite(bloom.bloomT) && Number.isFinite(bloom.x), "final state finite");

  log(fails ? "===== " + fails + " FAILURE(S) =====" : "===== ALL PASSED =====");
  if (fails) process.exitCode = 1;
} catch (e) {
  console.log("[TEST] EXCEPTION: " + ((e && e.stack) || e));
  process.exitCode = 1;
}
```

## 断言陷阱（都是实战踩出来的）

1. **抓"事件发生"，别抓"衰减残值"。** `bloom.flash` 这类脉冲量触发后按指数衰减——
   如果你在第 2 帧触发、第 12 帧才断言 `flash > 0.5`，读到的是只剩 0.39 的残值，白报 FAIL。
   正确写法：在循环里逐帧检查、命中即置 flag：
   ```js
   let fired = false;
   for (let i = 0; i < 12; i++) { T.advance(16.7); T.step(); if (bloom.flash > 0.5) fired = true; }
   expect(fired, "脉冲已触发");
   ```
2. **节流窗口要先等过期。** 有"420ms 冷却"的脉冲，测试里先空泵 80 帧（1.3s）再触发，否则被冷却吃掉。
3. **假数据字段必须齐全。** 驱动器造的对象若缺字段（如 `scale`/`roll`），主脚本算出 NaN，
   测试会报"看起来像产品 bug"的假警报。**改主脚本的信号结构时，同步改 driver 的 `mkA`。**
4. **只测"不崩"不够，要测"行为对"。** 至少覆盖：进场景、待机泵帧、每条交互路径的触发与效果、
   新特性逐条断言、收尾若干帧后关键量 `Number.isFinite`。
5. **模拟器与真实浏览器的边界**：DOM-stub 不查布局与样式（按钮并排、HUD 重叠这类问题必须人工核对，
   见 `canvas-particle-fx` 的「界面收尾三查」）。stub 测试管逻辑，人眼测试管视觉。

## 几何快照导出（无浏览器审阅视觉形态）

在 driver 末尾加一段"快照导出"：针对目标装置（花/图腾…），按几个关键时刻
（如生长度 bt = 1.0 / 0.55 / 0.15）把每颗粒子的最终**屏幕坐标 / 尺寸 / 亮度 / 色号**算出来，
写进 `_geom.json`：

```json
{ "states": [ { "name": "bt=1.00", "items": [[x, y, size, alpha, colorIndex], ...] } ] }
```

两条路线：
- **复刻渲染数学**（推荐）：把绘制函数里的变换链（基底位置、方向、卷曲、生长系数）在 driver 里
  重算一遍，只输出坐标——不依赖 canvas 假环境，数值最干净。改绘制公式时记得同步改快照代码。
- **直接调绘制函数**：让 stub 的 ctx 把 drawImage 坐标记录下来。省事但容易和状态耦合。

然后用 `scripts/snapshot_render.py` 渲染成 PNG 给人眼审阅。
**注意：这是"给人看"的产物——若模型自己看不了图，就配合数值分析**（如粒子最近邻距离统计），
并把 PNG 交给用户目测终审。
