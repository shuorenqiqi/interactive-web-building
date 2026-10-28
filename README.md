# 交互网页制作 · Interactive Web Building

一个可直接安装的 Agent Skill：把"做个能分享的交互网页"从**需求收敛**一路做到**线上可访问**，并把这一路上踩过的坑写成硬规则。

适用于单文件 HTML + 手势/鼠标/触摸交互 + 粒子视觉 + 静态部署的项目形态。

## 这个技能解决什么

| 常见翻车点 | 技能里的对应机制 |
|---|---|
| 页面打开"完全没反应" | 严格模式 / TDZ 静态扫描 + DOM-stub 运行时全链路测试 |
| `node --check` 过了但一跑就崩 | 三件套拼接 + 真实 rAF 泵帧 + 假手势数据直驱 |
| 桌面流畅、手机卡死 | 移动端档位表核对 + 填充率优先的性能诊断顺序 |
| 画面刺眼、光污染 | 去白处方（禁纯白辉光心）+ 粒子离散度量化验证 |
| 部署把测试脚手架传上去 | 发布目录卫生规则（整包上传，子目录≠排除） |
| 说"上线了"其实没生效 | 线上内容双向校验（新代码 present + 旧代码 absent） |

## 内容

```
SKILL.md                        8 步交付流程 + 10 条硬规则 + 资源索引
scripts/
  dom-stub.js                   浏览器假环境（DOM/Canvas/WebAudio/rAF/伪时钟）
  assemble.py                   stub + 主脚本 + driver 拼接器（严格模式提升到首行）
  snapshot_render.py            几何快照 JSON → 加色光点 PNG
references/
  harness.md                    无头测试详解：驱动器接口、driver 骨架、断言陷阱
  lessons.md                    经验反思全清单（性能/视觉/交互/测试/交付/环境坑/协作）
  render-essentials.md          渲染层精简兜底（未安装姐妹技能时读它）
```

## 安装

### WorkBuddy

```bash
git clone <repo-url> ~/.workbuddy/skills/interactive-web-building
```

用户级技能对**本机所有项目**生效，新会话自动加载。

### DeepSeek Harness（dsh）

dsh 从五个位置发现技能，按优先级（数值小者胜）：

| 优先级 | 位置 | 作用域 |
|---|---|---|
| 100 | `<repo>/.dsh/skills/<name>/SKILL.md` | 当前项目 |
| 200 | `<repo>/.agents/skills/<name>/SKILL.md` | 当前项目，**跨 agent 工具共享** |
| 300 | `customSkillDirs` 配置的目录 | 自定义 |
| 400 | `~/.dsh/skills/<name>/SKILL.md` | 所有项目（仅 dsh） |
| 500 | `~/.agents/skills/<name>/SKILL.md` | 所有项目（跨工具共享） |

推荐二选一：

```bash
# 全项目可用（推荐）
git clone <repo-url> ~/.agents/skills/interactive-web-building

# 或装进某个项目
git clone <repo-url> <your-repo>/.dsh/skills/interactive-web-building
```

dsh 的几条硬约束，本仓库已全部满足：

- `name` 必须匹配 `^[a-z0-9]+(-[a-z0-9]+)*$`（小写 + 连字符），否则**静默丢弃**
- `description` 超过 500 字符会被截断——本技能已压到 473
- **不递归扫描**：必须是 `skills/<name>/SKILL.md`，多套一层就找不到
- 正文每次加载时重新读取，改内容不用重启；新增/改名技能通常下一步即刷新目录
- 可选开关：`disable-model-invocation: true`（只许用户手动调）、`user-invocable: false`（只许模型调）

### 其他 Agent 工具

把整个目录放进它扫描的 skills 目录即可，保持 `SKILL.md` 在第一层、`scripts/` 与 `references/` 相对路径不变。`.agents/skills/` 是较通用的跨工具约定。

## 使用

装好后无需记命令，直接用自然语言触发：

> 帮我做一个手势控制的粒子网页，能分享给别人的那种

也可显式点名（dsh 中为 `/interactive-web-building`）。

**验证是否真的加载**：新开会话看技能目录里有没有它；或给一个应触发规则的任务，观察输出是否引用了本技能的步骤与硬规则——只说"我会遵守"不算数。

## 依赖

渲染层细节（粒子管线、性能预算、配色去白、界面收尾三查）来自姐妹技能 `canvas-particle-fx`，**可选**。

未安装时，本技能会回退读 `references/render-essentials.md`（已内置精简版），不会断链。

## 许可

MIT，见 [LICENSE](LICENSE)。
