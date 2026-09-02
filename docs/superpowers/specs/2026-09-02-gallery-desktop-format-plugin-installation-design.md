# Gallery 桌面格式插件安装设计

## 目标

为 `examples/gallery` 增加类似 Eagle 格式扩展的桌面安装能力。用户选择一个 ZIP 插件包后，应用安装、校验并立即启用它，使 Gallery 可为新文件格式生成缩略图，并在既有 `workbench` 中预览。

首个通过安装链路验证的插件是 PSD。它使用 `ag-psd` 在 Worker 中将 PSD 解码为可缓存的 WebP 缩略图。现有 JXL 仍是随应用静态打包的内置扩展，不在本次迁移范围内。

不兼容 Eagle 的 `manifest.json`、代码或 API；只借鉴它将缩略图脚本与独立预览页面分离的运行模型。

## 范围

包含：

- 从桌面文件选择器安装一个 ZIP 格式插件包。
- 安装、启用、停用、卸载以及重启后的状态保留。
- 受限 Worker 缩略图处理与受限 iframe 预览。
- 为 PSD 提供一个可安装的验证插件包。

不包含：开发目录加载、远程商店、自动更新、签名或证书信任链、Eagle 插件兼容、第三方插件的 Node/Electron API、任意 IPC、读写任意路径、插件间通信和视频格式支持。

## 插件包

ZIP 根目录必须有 `manifest.json`。插件资源只能位于该根目录之下：

```text
manifest.json
thumbnail/psd.worker.js
viewer/psd.html
assets/*
```

宿主清单为自有协议：

```json
{
  "schemaVersion": 1,
  "id": "com.example.psd",
  "name": "PSD Format",
  "version": "1.0.0",
  "formats": {
    ".psd": {
      "thumbnailWorker": "thumbnail/psd.worker.js",
      "viewer": "viewer/psd.html"
    }
  }
}
```

`id` 是稳定唯一标识；`version` 为展示与缩略图缓存失效的一部分；扩展名在安装时归一化为小写。入口路径必须是相对路径，且规范化后仍在插件根目录内。

## 分层与数据流

```text
Gallery renderer
  插件管理 UI、素材网格、workbench
       │ 明确的 preload API
       ▼
Gallery main
  ZIP 选择、校验、临时解压、原子安装、状态持久化、资源协议
       │ 仅列出的插件资源
       ▼
插件 Worker                 插件 iframe
  单个素材 bytes → 缩略图     单个素材 bytes → 独立预览页
```

主进程是唯一安装者。它把成功安装的包放入 `app.getPath('userData')/gallery/plugins/<id>`，并保存已安装插件、版本和启用状态。安装在临时目录完成校验后才原子移动，失败时不改变现有插件。

renderer 只能经 preload 发起安装、查询插件、切换启用和卸载；它不接收插件的真实安装路径。素材仍由既有 id-only `GalleryMediaApi` 读取，插件只得到宿主交给它的单个 `Uint8Array`。

缩略图 Worker 由宿主创建，接收素材字节与最大输出边长，返回 `image/png` 或 `image/webp` 字节。预览由现有 `workbench` Slot 装载受限 iframe；宿主使用消息通道传入当前素材字节与名称。插件没有 Node、Electron、preload、Gallery DOM 或任意 IPC 能力。

## 安装与生命周期

1. 用户在 Gallery 选择 ZIP 插件包。
2. 主进程解压到用户数据目录中的临时目录，并拒绝路径穿越、符号链接、超出安装大小上限或缺失清单的包。
3. 解析并校验清单：版本、id、扩展名和入口路径均有效；同一 `id` 替换前先完成完整校验；不同已启用插件不能声明相同扩展名。
4. 主进程原子安装并持久化为启用状态；renderer 刷新格式映射，安装无需重启即可使用。
5. 停用时移除映射，但保留安装文件；卸载时先关闭对应预览、移除映射与缩略图缓存，再删除该插件目录。原始素材不受影响。

## 资源与错误边界

- 插件文件 URL 只能解析至已启用插件根目录内的声明资源；不提供目录浏览。
- 每次缩略图处理限制输入大小、声明像素尺寸、返回字节数和运行时间。失败、超时或异常返回仅令当前卡片显示不可预览状态。
- 预览 iframe 禁止访问宿主上下文；切换素材或关闭 workbench 时终止其消息会话并释放 Object URL。
- 损坏 ZIP、无效清单、重复 id/扩展名、入口不存在或安装 I/O 失败必须给出可见错误，且不污染已安装状态。

## PSD 验证插件

PSD 包的缩略图 Worker 使用 `ag-psd` 读取合成图，并在检查最大宽高后绘制为 Canvas/WebP。它不解析或暴露图层编辑能力。viewer 仅显示宿主传入素材的渲染结果。

PSD 输入必须限制尺寸和解码预算，因为合法 PSD 也可声明过大的画布或图层数据。PSD 插件证明第三方包能通过桌面安装路径，而不是证明静态 Cordis 启动图可运行时加载任意模块。

## 验收

- 有效 PSD ZIP 可安装，并立即出现在已启用格式中；重启 Gallery 后仍生效。
- PSD 素材可生成缩略图并在 workbench 中预览。
- 停用后 PSD 不再匹配；重新启用后恢复；卸载后安装记录与相关缩略图缓存消失。
- 损坏 ZIP、越界路径、符号链接、无效入口、重复 id 或扩展冲突均被拒绝，既有已安装插件仍可使用。
- Gallery build、类型检查和相关单元测试通过；手动在 Electron 中执行一次安装、预览、停用和卸载。
