# WebRTC 学习地图

面向 WebRTC 学习的交互式网页、可视化示例和视频工程源码。

- 在线网站：https://webrtc-learning.vercel.app
- 首页：`index.html`（WebRTC 全景图 + 学习路线 + 专题目录）
- SDP 协商：`webrtc-sdp-exchange.html`
- NAT 类型可视化：`nat-types-visualizer.html`
- 规模化拓扑（SFU / MCU）：`webrtc-topology.html`

每个专题页都是单文件 HTML。新增专题时，在 `index.html` 的 `TOPICS` 数组末尾追加一条，首页卡片与地图会自动联动。视觉与工程规范见 [`AGENTS.md`](AGENTS.md)。

## 视频工程

`webrtc-call-flow-video/` 与 `webrtc-media-data-flow-video/` 是讲解视频的源码（脚本、旁白、字幕、动画页），仅在本地使用，不随网站部署（见 `.vercelignore`）。

## 部署

仓库连接到 Vercel。推送到 `main` 分支后自动更新生产网站，其他分支和 Pull Request 会生成预览部署。

视频渲染产物、本地虚拟环境、缓存和凭据不纳入版本控制。
