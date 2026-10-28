---
name: interactive-web-building
description: Use when building a complete interactive web page end-to-end — single-file HTML, camera/gesture or mouse/touch interaction, particle visuals, shareable link. 交互网页制作、交互页面、手势互动、粒子特效、做网址分享。Covers requirements → interaction design → implementation → headless DOM-stub testing (catches strict-mode/TDZ crashes) → visual verification → preview → deploy → live check. Render techniques: sister skill canvas-particle-fx, or references/render-essentials.md when it is not installed.
agent_created: true
---

# 交互网页制作 · 从需求到上线的完整流程

## 用途

用户要"做一个网页 / 交互页面 / 能分享的网址 / 手势互动的特效页"时，走本流程。
适用形态：单文件 HTML（CSS/JS 全内联）+ 可选本地托管资源（模型/图片）+ 云静态部署。

**分工：** 本技能管**工程流程与验证方法**（怎么测、怎么交付、怎么上线、怎么保证质量）；
渲染层技法（粒子管线、性能预算、配色方法论、界面收尾三查）见姐妹技能 **`canvas-particle-fx`**；
该技能未安装时，读本目录的 `references/render-essentials.md`（精简兜底版）。

## 交付形态与目录结构（先立规矩，省掉后期所有混乱）

```
<项目名>/                   ← 发布目录：只放"线上需要"的东西
  index.html                ← 入口（单文件，全部内联）
  models/                   ← 本地托管资源（CDN 不可达的必须本地托管，如 MediaPipe 模型）
  设计思路.md / 提示词.md    ← 文档（与代码同步维护）
_tools/<项目名>/             ← 脚手架目录：**绝不在发布目录内**（部署是整包上传！）
  dom-stub.js  _driver.js  _assemble.py    ← 测试三件套
```

## 标准工作流（8 步，按顺序执行）

### 1. 需求收敛 → 定交付形态
确认为单文件 HTML；确认交互通道（摄像头手势 / 鼠标 / 触摸）；确认视觉主题与背景基调。

### 2. 交互系统设计（先列维度再写代码）
用"四类维度清单"设计交互集，**空着的维度就是可加的交互感**：
- **连续量**：开合度→生长、距离→大小、旋转→朝向、间距（双手）→大小
- **脉冲**：捏合/右键→能量脉冲、前推→冲击环、后撤→吸聚、握拳蓄力→释放新星
- **状态**：无输入时的待机行为（回中 + 呼吸 + 缓慢自转）
- **双手**：掌间距、合拢共鸣（`numHands: 2` 时白捡的维度）
三端对齐：每个手势在鼠标/触摸端要有对应物（右键/双指/滚轮）；提示文案分路
（`matchMedia("(hover: none)")`）。细节技法见 `references/lessons.md` 第三节。

### 3. 实现
渲染管线与性能规则照 `canvas-particle-fx`；连续映射用缓动、位置用欠阻尼弹簧、
脉冲带节流；**失去控制时目标值要同步回当前值**（否则重新接管时装置瞬跳）。

### 4. 无头全链路测试（**必做**，抓崩溃的主力）
```bash
# 三件套复制到 _tools/，改元素 ID 表，写好 _driver.js 后：
python _assemble.py        # index.html 主脚本 + dom-stub.js + _driver.js → _run.js
node _run.js               # 期望 "===== ALL PASSED ====="
```
- 抓的是**语法检查抓不到的**运行时崩溃：严格模式未声明赋值、TDZ、null、NaN 传染。
- **新增任何交互维度，driver 必须同步加断言**（触发构造 → 泵帧 → 断言目标状态）。
- 详细原理、driver 骨架、断言陷阱、快照导出：`references/harness.md`。

### 5. 视觉验证（看不到图时的三条替代路径）
1. **几何快照**：driver 导出粒子坐标 JSON → `scripts/snapshot_render.py` 渲染 PNG（给人看）；
2. **数值分析**：如离散度统计（最近邻距离 vs 粒子尺寸），验证"点阵感/密度"类判断；
3. **用户目测终审**：给**具体的选择题**（"更圆/更尖？卷曲更强？"），而非"好看吗"。
**永远不要在没有视觉反馈时假装能判断视觉效果。**

### 6. 本地预览
```bash
python -m http.server 8377 --directory <发布目录>
```
localhost 是测试摄像头（getUserMedia 需安全上下文）的唯一便捷通道；迭代时随改随看。

### 7. 目录卫生 + 部署
- 部署前：发布目录只留交付物（Glob 复核一遍）；脚手架确认在 `_tools/`。
- **授权规则：用户最新消息没提"发布/上线"→ 不得静默覆盖线上链接**，先给本地预览确认再问。
- 部署：`workbuddy_sites_deploy`（`action: deploy, updateExistingApp: true, userAskedToPublish: true`）。

### 8. 上线验证
用 **Python（urllib）** 拉回线上 HTML，逐条比对"新代码 present + 旧代码 absent"。
**禁止用 shell 做这件事**（PowerShell 引号转义与中文编码会给你假结论）。
提醒用户 **Ctrl+F5**（缓存）。

## 硬规则速查（每条都有血债）

1. 同一 HTML 文件**串行编辑**；并行编辑会互相覆盖（实测丢过 8 处）——改完逐项 grep 复核。
2. 严格模式下新增全局状态变量必须有 `let/const` 声明；拼接测试文件时 `"use strict"` 提到**第一行**。
3. 测试断言抓"事件发生"，别抓"衰减残值"；带冷却的脉冲先空泵到冷却过期。
4. 假数据字段必须齐全，改信号结构同步改 driver——缺字段会造成 NaN "假 bug"。
5. 移动端档位表：**单帧负荷显著变化后必须回头核对**（桌面好手机卡 = 此症状）。
6. 发布目录 = 交付物 + 运行资源，**不存在"子目录排除"**（整包上传）。
7. 优化前先写微基准测量（JS 循环便宜、填充率贵）；降 DPR 是性价比最高的杠杆之一。
8. 工具链连续 2~3 个坑打不通 → **果断止损**，换方案或向用户说明限制，不沉默烧时间。
9. 用户催促时，交付优先——砍掉一切探索性工作。
10. 文档与代码同步更新（每轮大改后）。

## 资源索引

| 资源 | 说明 |
|---|---|
| `scripts/dom-stub.js` | 浏览器假环境（DOM/Canvas/WebAudio/rAF/伪时钟），改「元素表」即用 |
| `scripts/assemble.py` | 三件套拼接器（严格模式提升）；`--base/--dev` 指定目录 |
| `scripts/snapshot_render.py` | 几何快照 JSON → 加色光点 PNG（人群审阅用） |
| `references/harness.md` | 无头测试详解：驱动器接口、driver 骨架、断言陷阱、快照导出 |
| `references/lessons.md` | 经验与反思全清单（性能/视觉/交互/测试/交付/环境坑/协作） |
| `references/render-essentials.md` | 渲染层精简兜底：管线/填充率/去白/界面三查/发布卫生（未安装姐妹技能时读它） |
| 姐妹技能 `canvas-particle-fx` | 渲染管线、性能预算、配色去白、界面收尾三查、发布卫生（完整版） |

## 环境备忘（Windows）

- bash 可能瘫痪 → 切 PowerShell；PowerShell 输出被吞 → **写文件再读**；
  复杂 JS/中文参数 → 写临时文件传递或交给 Python 落地。
- 删除/移动文件后 Glob 复核；临时产物（探测 txt、快照中间件）任务结束即清。

## 移植到其他 agent / 其他机器

**先看依赖——不能裸搬。** 本技能有 6 处指向姐妹技能 `canvas-particle-fx`（渲染管线、性能预算、配色去白、界面收尾三查）。只搬本目录，这些引用会全部悬空。两种处理：
- **成对搬**：`interactive-web-building` + `canvas-particle-fx` 一起带走（推荐）；
- 或把 `canvas-particle-fx` 的「性能预算 / 配色去白 / 界面收尾三查」三节摘进 `references/`，做自包含版。

**三个落地位置（按作用域）：**

| 目标 | 放哪 | 生效范围 |
|---|---|---|
| 本机所有项目、所有会话 | `~/.workbuddy/skills/`（默认位置） | 当前用户全部会话，**新会话自动加载** |
| 单个项目 / 与团队共享工作区 | `<工作区>/.workbuddy/skills/` | 仅该项目，随工作区分发 |
| 某个专家（Expert） | 专家包的 `skills/<技能名>/`（包结构：`agents/` + `skills/`） | 该专家启用时自带 |

**生效条件**：拷完不代表立即生效——技能表在**会话启动时**扫描。验证方法：新开会话看技能表是否列出 `interactive-web-building`，或直接说"做个交互网页"观察是否被主动加载。

**跨机器交付**：整目录压缩打包，保持 `SKILL.md` 在根、`scripts/`、`references/` 相对路径不变；对方解压到自己的 `~/.workbuddy/skills/` 即可。

**定时任务**：创建自动化时在 `skills` 字段点名本技能，可强制该任务加载（不依赖 description 触发词）。
