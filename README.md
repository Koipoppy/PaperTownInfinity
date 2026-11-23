# Pop-up Atlas

浏览器里的无限可交互立体书世界。一个纸片旅行者走过完全程序化生成的纸雕地图，地形和道具会从书页上弹起，走远后又折回平面。

这是当前可玩原型（v0.1），目标是向 Papertrails 的纸雕质感与无限地图看齐。

## 快速开始

```bash
npm install
npm run dev        # http://127.0.0.1:5173
npm run build      # 生产构建到 dist/
npm run preview    # http://127.0.0.1:4173
```

URL 参数：

- `?seed=93` — 复现指定世界（默认 93，村庄 + 河流 + 桥 + 秋林）
- `?quality=low|med|high` — 画质/DPR/阴影分辨率
- `?night=1` — 直接进入夜景
- `?mute=1` — 静音启动
- `?hint=0` — 不显示底部提示

操作：WASD / 方向键或点击、拖拽行走，Shift 快走，N 昼夜，M 静音。

## 已实现

- **无限地图**：全局噪声场生成小路、河流、池塘、村庄、森林、花田、丘陵；8×8 tile 分块，按种子和区块坐标纯函数生成，任意顺序加载结果一致；区块流式创建/回收。
- **程序化路网 + 拱桥**：种子驱动的南北/东西蜿蜒小路网格，保证全图有连续可走路线；南北主路在河流处自动生成拱桥。道路会避开阻挡道具，交叉口放路牌/灯笼；村庄沿路生成。
- **连续动态河流**：河流由按种子随机化的解析曲线定义（JS 与水面几何共用同一套函数），页面局部生成连续水带网格；卡通化平涂水面、流动波纹、纸边泡沫、夜间冷色，跨区块不断。
- **立体书页 + 印刷淡出**：48×48 tile 的印刷窗口跟随旅行者，每 16 tile 重绘；中央装订沟、纸纤维、柔和地面。每个区块有独立印刷层，道具弹起时对应印刷图按进度淡出/隐藏，折回时恢复（睡莲/鸭子只保留印刷）。
- **剪纸道具**：23 种 ComfyUI 生成的剪纸（树、松、灌木、花、草、石、蘑菇、芦苇、睡莲、房屋、风车、栅栏、路牌、草垛、板车、蜂箱、灯笼、猫、狗、羊、鸭、桥）。统一 2048² 图集、单材质、alpha 裁切、软阴影。
- **多部件 3D 房屋**：运行时从参考 Papertrails 的 `tiles.glb` 抽取 `house__house_*` / `village__cottage_a_*` / `village__house_w_*` 分件（前后墙、左右墙、双坡屋顶、烟囱、窗），用 UV1 art atlas 上色；每个模板合并成纸面 + 窗户两块几何体，一个房屋只需 2 个网格 + 地基。
- **3D 拱桥**：自建多片纸拱桥（石拱墙 + 真实拱洞 + 桥面/坡道 + 桥台 + 护墙/纸栏杆），按南北向路网与东西向河流对齐；桥面可走（`heightAt` 跟随拱高），从固定高视角能看到拱脸和桥下水。
- **弹起动画**：每个道具一个铰链 + 弹簧（rise / overshoot / wobble / fall），固定子步积分，与帧率无关；按距离和每个 tile 的随机延迟触发；走远自动折回。
- **旅行者**：程序化纸偶（草帽、围巾、背包、挎包、手提灯笼），行走摆臂/摆腿、身体起伏、朝向插值；简单的圆形碰撞；夜间灯笼点光源。
- **渲染**：暖色主光 + 冷色补光、PCF 软阴影、纸材质纤维、优化后的 tilt-shift 景深（16-tap 金色角圆盘 + 高光 bokeh 权重 + 轻微色散）、暗角 + 暖色分级 + 颗粒、指数雾；昼夜平滑过渡。
- **夜间**：灯笼点光源、房屋窗光、旅行者提灯、页面冷色调。
- **音频**：Web Audio 纯合成，无音频素材；纸张翻折、脚步、风声；首次交互后启动 AudioContext。
- **性能**：参考房屋/桥梁模板在加载时按材质合并几何体，56 个 3D 房屋只占 168 个网格（约 2 个/房屋 + 地基）；25 个区块、约 1650 个道具。RTX 5090 / 1280×720 下高帧率运行。

## 结构

```
src/
  config.ts              尺寸/颜色/画质/弹起半径
  core/rng.ts            hash / value noise / fbm
  core/events.ts         事件总线（翻折音效、脚步、首次输入）
  world/map.ts           无限地图场：小路、河流、村庄、森林、道具权重
  world/build.ts         剪纸卡片、灯/窗发光、实验性 3D 模型
  world/houses.ts        从参考 tiles.glb 抽取多部件 3D 房屋 + UV1 art atlas 材质
  world/world.ts         区块流式加载、弹簧折叠、印刷层淡出、碰撞、灯笼点光
  world/page.ts          书页 canvas 印刷、地面模糊、装订沟、夜间色
  player/traveller.ts    纸偶模型、行走循环、提灯
  player/controls.ts     WASD / 点击寻路 / 触控
  camera/follow.ts       高角度跟随 + 前视偏移 + 景深焦点
  render/                renderer / materials / lights / post
  audio/paper.ts         程序化翻折/脚步/风声
tools/
  comfy/generate.mjs     ComfyUI API 批量出图
  comfy/prompts.*.json   概念图、纸张、剪纸提示词
  atlas/build_atlas.py   白底洪泛抠图 + WEBP 图集 + contact sheet
public/
  atlases/               props.webp + props.json
  textures/              paper_fibre / paper_page / paper_wood
REFERENCE/               本地参考仓库（Papertrails，MIT），被 .gitignore 排除
```

## 资产管线

1. 用 `tools/comfy/prompts.props_v2.json` 的模板出图：单张 die-cut sticker、连续奶油纸边、纯白底、无投影、扁平矢量。
2. `tools/atlas/build_atlas.py` 从白底和灰色投影做一次洪泛抠图（不碰奶油纸边），按 alpha 裁剪、缩放、打包成 2048² WEBP，并生成 `contact_sheet.png` 供检查。
3. 网页用同一张图集同时渲染“页面印刷”和“弹起卡片”；纸纹、边缘暗化、厚度和阴影在 shader 里完成。

生成命令：

```bash
node tools/comfy/generate.mjs tools/comfy/prompts.props_v2.json assets_src/props_v2
python tools/atlas/build_atlas.py assets_src/props_v2 assets_src/atlas_final
# 把 props.webp / props.json 复制到 public/atlases/
```

## 已知限制 / 下一步

- **资产许可（重要）**：当前 23 张剪纸、纸纹和 6 张概念图由本地 FLUX.1 [dev] 生成。FLUX.1 [dev] 官方为非商业许可，商业发行前需要向 Black Forest Labs 取得商业授权，或改用可商用模型（如 Apache-2.0 的 FLUX.1 [schnell]、SDXL 等）重生成，并重新走图集管线。3D 房屋与 art atlas 来自 MIT 的 Papertrails，可商用但需保留其 MIT 版权声明（见 CREDITS.md）。
- 还没有地图册（Tab）、收集/星星/灯笼进度、存档、音乐、移动端专项调优。
- 3D 房屋/拱桥已经很接近参考结构，但墙面/桥面 art atlas 的颜色、桥拱在固定高视角下的可读性还值得继续打磨。
- 风车仍是剪纸卡片；动物还没有独立动画；天气系统未做。
- 场景目前是单机演示，没有后端、账号、支付、分析埋点。

## 许可

源码：私有 / UNLICENSED（未授权分发）。第三方组件、参考项目与生成资产许可见 [CREDITS.md](CREDITS.md)。
