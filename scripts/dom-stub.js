/* dom-stub.js —— 浏览器假环境：让「交互网页」的主脚本在 Node 中严格模式跑起来
 *
 * ── 三件套之一 ──
 *   dom-stub.js + 主脚本（从 index.html 提取）+ driver.js  →  拼接成 _run.js，用 Node 执行。
 *   本文件职责：伪造 DOM / Canvas 2D / WebAudio / requestAnimationFrame / 计时，
 *   使主脚本的初始化、事件绑定、逐帧循环能无浏览器运行；
 *   再由 driver.js 派发事件、手动泵帧、断言状态。
 *
 * ── 用法 ──
 *   1. 复制到项目 _tools/ 目录（与 _driver.js、_assemble.py 并列）
 *   2. 改下方「① 元素表」：把 id 换成你 index.html 里 getElementById 用到的清单
 *   3. 主脚本若用到 stub 未覆盖的 API，在此补 no-op（或用 Proxy 兜底，见文末）
 *   4. 拼接与运行：
 *        python _assemble.py          # 生成 _run.js
 *        node _run.js                 # 跑全链路测试
 */
function noop() {}

/* ============ ① 元素表：按你的 index.html 修改这里 ============ */
/* id → 标签类型。只有 <canvas> 和 <video> 需要特殊造；其余按 div 造 */
const ID_TAGS = {
  /* 示例：画布与视频 */
  magic: "canvas", cam: "video",
  /* 其余界面元素（全部按普通元素造） */
};
const IDS = [
  /* 把主脚本里出现过的 getElementById("...") 的 id 全部列进来，缺一个就是 null 崩溃 */
  "overlay", "hud", "status-line", "tip", "guide", "dot", "tracker-text",
  "btn-sound", "btn-cam", "btn-start", "btn-mouse",
  "magic", "cam",
];
/* ============================================================= */

/* ---- Canvas 2D 上下文（显式 no-op 列表，稳；想偷懒可换 Proxy 兜底） ---- */
function mkCtx2D(canvas) {
  const grad = { addColorStop: noop };
  return {
    canvas,
    globalAlpha: 1, globalCompositeOperation: "source-over",
    fillStyle: "#000", strokeStyle: "#000", lineWidth: 1, lineCap: "butt", lineJoin: "miter",
    shadowBlur: 0, shadowColor: "", font: "10px sans-serif", textAlign: "left", textBaseline: "alphabetic",
    setTransform: noop, resetTransform: noop, save: noop, restore: noop,
    translate: noop, rotate: noop, scale: noop, transform: noop,
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop, arcTo: noop,
    bezierCurveTo: noop, quadraticCurveTo: noop, rect: noop,
    stroke: noop, fill: noop, fillRect: noop, strokeRect: noop, clearRect: noop, clip: noop,
    fillText: noop, strokeText: noop, measureText: () => ({ width: 10 }),
    drawImage: noop,
    createRadialGradient: () => grad, createLinearGradient: () => grad, createPattern: () => null,
    /* createImageData / getImageData 必须返回真 Uint8ClampedArray，否则直写像素类代码崩 */
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    getImageData: function (x, y, w, h) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; },
    putImageData: noop, setLineDash: noop, getLineDash: () => [],
  };
}
function mkClassList() {
  const set = new Set();
  return {
    add: function () { for (const c of arguments) set.add(c); },
    remove: function () { for (const c of arguments) set.delete(c); },
    toggle: function (c, f) { const want = f === undefined ? !set.has(c) : !!f; want ? set.add(c) : set.delete(c); return want; },
    contains: c => set.has(c),
  };
}
function mkCanvas() {
  const c = {
    width: 300, height: 150, videoWidth: 320, videoHeight: 240,
    style: {}, classList: mkClassList(),
    _ls: {}, readyState: 0,
    addEventListener: function (t, fn) { (c._ls[t] = c._ls[t] || []).push(fn); },
    removeEventListener: noop,
  };
  c.getContext = function () { return c._ctx || (c._ctx = mkCtx2D(c)); };
  return c;
}
function mkElement(tag) {
  const el = {
    tagName: String(tag || "div").toUpperCase(),
    style: {}, classList: mkClassList(), children: [],
    textContent: "", innerHTML: "", className: "", readyState: 0,
    _ls: {},
    addEventListener: function (t, fn) { (el._ls[t] = el._ls[t] || []).push(fn); },
    removeEventListener: noop,
    appendChild: function (c) { el.children.push(c); return c; },
    setAttribute: noop, getAttribute: () => null, removeAttribute: noop,
    click: function () { (el._ls.click || []).forEach(fn => fn({})); },
    play: function () { return Promise.resolve(); },
    pause: noop,
  };
  return el;
}

/* ---- 元素实例化 ---- */
const ELEMENTS = {};
for (const id of IDS) {
  ELEMENTS[id] = ID_TAGS[id] === "canvas" ? mkCanvas()
    : ID_TAGS[id] === "video" ? mkCanvas()
    : mkElement("div");
}

/* ---- window / document / 计时 ---- */
const WIN_LS = {};
global.window = {
  innerWidth: 1440, innerHeight: 900, devicePixelRatio: 1,
  addEventListener: function (t, fn) { (WIN_LS[t] = WIN_LS[t] || []).push(fn); },
  removeEventListener: noop,
  /* 若主脚本用 matchMedia（触摸判定等），补一个假实现；默认返回 false 分支 */
  matchMedia: q => ({ matches: false, media: q, addEventListener: noop, removeEventListener: noop, addListener: noop, removeListener: noop }),
  /* WebAudio 全链伪造：任何一个节点属性都是安全的 no-op 参数 */
  AudioContext: function AudioContext() {
    function param(v) { return { value: v, setValueAtTime: noop, exponentialRampToValueAtTime: noop, linearRampToValueAtTime: noop, cancelScheduledValues: noop }; }
    function node() { return { connect: noop, disconnect: noop, start: noop, stop: noop, gain: param(0.5), frequency: param(440), Q: param(1), delayTime: param(0.3), type: "sine", loop: false, buffer: null }; }
    return {
      destination: node(), currentTime: 0, sampleRate: 44100,
      resume: noop, suspend: noop, close: noop,
      createGain: node, createDelay: node, createOscillator: node,
      createBiquadFilter: node, createBufferSource: node,
      createBuffer: (ch, len) => ({ getChannelData: () => new Float32Array(len), length: len, numberOfChannels: ch }),
    };
  },
};
global.document = {
  getElementById: id => ELEMENTS[id] || null,
  createElement: tag => (tag === "canvas" ? mkCanvas() : mkElement(tag)),
  addEventListener: noop, removeEventListener: noop,
  body: mkElement("body"), documentElement: mkElement("html"),
  hidden: false, exitFullscreen: noop,
  querySelector: () => null, querySelectorAll: () => [],
};
let NOW = 0;                              /* 伪时钟：driver 用 T.advance(ms) 推进 */
global.performance = { now: () => NOW };
const RAFQ = [];                          /* rAF 队列：driver 用 T.step() 手动泵帧 */
global.requestAnimationFrame = cb => { RAFQ.push(cb); return RAFQ.length; };
global.cancelAnimationFrame = noop;
global.localStorage = { getItem: () => null, setItem: noop, removeItem: noop };
Object.defineProperty(global, "navigator", {
  value: {
    /* 默认模拟"无摄像头"，走降级路径；要测摄像头路径直接注入假手势数据给主循环（见 driver） */
    mediaDevices: { getUserMedia: async () => { throw new Error("no camera in test"); } },
    userAgent: "node-test", maxTouchPoints: 0,
  },
  configurable: true, writable: true,
});

/* ---- 测试驱动器接口（driver.js 用 global.__T 操作一切） ---- */
global.__T = {
  ELEMENTS, WIN_LS, RAFQ,
  advance: ms => { NOW += ms; },                                  /* 推进伪时钟 */
  step: () => { const q = RAFQ.splice(0, RAFQ.length); for (const cb of q) cb(NOW); },  /* 泵一帧 */
  fire: (store, t, ev) => { (store[t] || []).forEach(fn => fn(ev)); },                  /* 派发事件 */
};
