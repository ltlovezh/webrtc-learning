# AGENTS.md · WebRTC 学习站

本仓库是「WebRTC 学习地图」静态学习站（Vercel 项目 `webrtc-learning`，推送 `main` 自动部署生产）。
**任何 agent 在本仓库新增或修改页面，必须遵守本文件的设计规范**；规范与实现冲突时，以本文件为准。

## 视觉风格：数字花园（Digital Garden）

2026-08-11 定稿，全站统一。取法 maggieappleton.com 的 digital garden 路线：冷调米白＋苔绿墨＋少量陶土色，清新、透气、保留手绘温度。**禁止**深色技术风、终端霓虹风、暗底长文。

### 色板 token（新页面直接复制这份 `:root`）

```css
:root{
  --paper:#F9FAF4;    /* 页面底 · 冷调米白 */
  --paper-2:#FEFEFB;  /* 卡片底 */
  --paper-3:#F0F2E4;  /* 次级底 */
  --paper-4:#DDE4D2;  /* 深一档底 */

  --ink:#333D2E;      /* 正文墨 · 苔墨 */
  --ink-2:#66705A;
  --ink-3:#8B957D;
  --rule:#D5DCC6;     /* 分隔线 / 卡片描边 */
  --rule-2:#E6EBDA;

  --a:#C97B4A;        /* Peer A · 发起方 · 陶土 */
  --a-ink:#A05C2C;  --a-soft:#F5E6D8;
  --b:#4A7856;        /* Peer B · 应答方 · 林绿 */
  --b-ink:#3D6B4C;  --b-soft:#E7EFE3;
  --wire:#4E8378;     /* 信令 / 连接 · 溪青 */
  --wire-ink:#3F6B60; --wire-soft:#E4EEE9;

  --sh-s:0 2px 10px rgba(74,120,86,.12);   /* 软弥散投影 · 小 */
  --sh-m:0 6px 18px rgba(74,120,86,.14);   /* 软弥散投影 · 中 */

  --sans:-apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Helvetica Neue",sans-serif;
  --serif:"Songti SC","STSong","Noto Serif SC",Georgia,serif;
  --mono:ui-monospace,"SF Mono",Menlo,"JetBrains Mono",Consolas,monospace;
}
```

语义警示色**不随主题走**，跨页保持一致：错误/拦截用红系（`#B34238`、`#A33B47`），放行/成功用深绿系（`#287158`），提醒用橄榄琥珀（`#9C7C25`）。

### 排版与质感

- 大标题用宋体（`--serif`）、正文用苹方（`--sans`）、代码与图内标注用 `--mono`。
- 投影一律软弥散（`--sh-s` / `--sh-m`），**禁止** `Npx Npx 0` 的平涂偏移投影。
- 卡片 / 面板描边用 `1.5px solid var(--rule)`，**不要** 2px 深墨描边；SVG 插画内部的线稿可以用 `--ink`。
- 手绘感插画（机器人、信封、云朵、植物）是站点标识，继续沿用；意象取「植物图鉴」而非「工坊手作」。
- SVG 图内文字不得跨越色块边界或与相邻元素相交（提交前检查 getBBox 是否越界）。

### 文案隐喻：生长

- 专题状态用「**已长成 / 发芽中**」（不用「可读 / 在建」）；已长成 = 绿色实心点，发芽中 = 灰虚线圈。
- 新增专题 = 在 `index.html` 的 `TOPICS` 数组末尾追加一条（首页页脚有示例），卡片与地图自动联动。

## 工程约定

- 每个专题页是零依赖单文件 HTML（内联 CSS/JS），移动端可用，动效尊重 `prefers-reduced-motion`，交互元素有 `:focus-visible` 与 aria 标注。
- 源码引用统一指向 `https://webrtc.googlesource.com/src/+/refs/heads/main/...`，不要本地 `../src` 相对路径。
- 页脚保留「基于本地 checkout src@<commit>」的溯源信息。
- 视频渲染产物、缓存、凭据不入库（见 `.gitignore`）。
