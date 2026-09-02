# Gallery 本地素材与格式扩展宿主设计

## 目标

在 `examples/gallery` 中实现一个本地素材浏览 MVP：用户选择一个目录，应用递归展示其中的 PNG、JPEG/JPG、WebP 与 JXL 文件；双击素材后，在现有右侧 `workbench` 中预览。JXL 是第一个内置格式扩展，用于验证宿主边界。

首版只交付随应用静态打包的格式扩展。它不安装、下载或执行第三方扩展；后续动态安装能力必须另立需求，因为当前 Cordis Web 启动图只在构建期生成，生产静态包不支持运行时模块加载。

## 范围与非目标

包含：

- 选择并持久化一个本地素材根目录；目录变更时重新扫描。
- 递归扫描该目录，跳过符号链接、无权限项和不支持的文件。
- JustifiedInfiniteGrid 中展示缩略图；继续复用当前 `@examples/gallery-assets` 页面，不替换为新的 Cordis 页面插件。
- PNG、JPEG/JPG、WebP 由浏览器原生解码。
- 内置 JXL 扩展生成缩略图并提供预览。
- 双击素材时，在 `assets` 路由声明的子 Slot 中占据全局 `workbench`；离开该路由即释放。
- 缩略图磁盘缓存，以源文件绝对路径、大小、修改时间、格式扩展版本组成失效键。

不包含：多目录资源库、目录树/标签/搜索、文件监听、导入复制、素材元数据数据库、编辑、第三方插件商店、运行时安装、远程插件、权限管理与扩展自动更新。

## 分层与责任

格式扩展不能只是 `@examples/gallery-assets` 中的一组 `if`。该页面负责列表、选择和工作台交互；格式处理以可静态登记的扩展贡献给一个小型 Gallery 宿主。

```text
Gallery 主进程
  选择目录、扫描、文件读取、缩略图缓存
       │ 受限 IPC
       ▼
Gallery renderer 格式宿主
  格式匹配、缩略图/预览委派
       ├─ 浏览器原生格式（png/jpeg/webp）
       └─ 内置 JXL 格式扩展（worker 解码）
       ▼
@examples/gallery-assets
  JustifiedInfiniteGrid、双击选择、assets.workbench
```

新增共享模块只承载跨进程 DTO 和格式扩展注册契约；不为首版创建安装器、扩展生命周期管理器或多实现工厂。契约至少包含：

- `AssetRecord`：稳定 id、显示名、扩展名、大小、修改时间与可读取句柄；不把真实路径直接作为页面状态中的可编辑值。
- `FormatExtension`：`id`、`version`、支持扩展名、`createThumbnail` 与 `Viewer`。一次请求只匹配一个扩展；原生格式同样通过内置处理器进入该接口。
- `GalleryMediaApi`：`chooseRoot`、`listAssets`、`readAsset`、`readThumbnail`、`writeThumbnail`。preload 仅暴露这组明确方法，renderer 没有 Node 或任意路径文件系统权限。

首版 JXL 扩展以工作区静态包的形式加入构建图，并在启动时向格式宿主注册。它不是 Eagle 插件包，也不直接加载 Eagle 的 `manifest.json`。参考 `eagle-plugin-jxl` 的“浏览器优先、worker/WASM 回退、超时失败”的处理方向；引入其代码或二进制前必须单独核验许可证与上游版本。

## 静态扩展与动态安装边界

首版的“扩展”只表示静态 Cordis 启动图中的格式贡献点。`examples/gallery/cordis.yml` 在构建期固定包含格式宿主、承载原生格式处理器的 assets 插件与 JXL 扩展；它们和 Worker/WASM 一起进入受控的应用构建产物。`FormatRegistry.register()` 只接收这些已随应用打包并由启动图激活的贡献，不扫描本地插件目录、不下载模块，也不按 renderer 输入导入代码。

本地目录能力同样不属于格式扩展。只有 Gallery 主进程可以通过原生选择器取得并持久化素材根目录、扫描文件并维护授权素材 id 映射；renderer 只能把素材 id 交给 `GalleryMediaApi` 请求字节或缩略图缓存，不能把绝对路径交给主进程读取。格式处理器只处理宿主返回的单个素材字节，因此静态扩展注册不会扩大文件系统权限。

动态第三方安装由独立的 [桌面格式插件安装设计](2026-09-02-gallery-desktop-format-plugin-installation-design.md) 交付：它采用 ZIP、主进程校验与受限 iframe/Worker，不改变 Cordis 静态启动图，也不把当前注册接口暴露为任意第三方代码入口。

## 主进程与数据流

1. 空列表提供“选择素材目录”入口；主进程通过原生目录选择框取得根目录，并将该路径保存在 `userData` 下的 Gallery 配置文件。
2. 主进程递归枚举常规文件，按扩展名过滤，跳过符号链接与不可读项，按修改时间倒序返回 `AssetRecord`。首次版本不监听文件变化，页面提供刷新动作。
3. renderer 请求缩略图时，主进程先按失效键读取缓存。未命中时仅返回该单个文件的字节；renderer 的已匹配格式处理器生成 PNG/WebP 缩略图后写回缓存。
4. 双击卡片会记录当前 `AssetRecord`，调用 `ctx.layout.openWorkbench()`，并在 `assets.workbench` 中渲染对应 `Viewer`。未能解码的素材显示可识别的失败状态，不能影响同一列表中的其他项目。
5. 资源离开视图时撤销 Object URL、终止进行中的 worker 请求；工作台 Slot 的 disposer 负责释放路由贡献。

文件读取请求必须验证记录属于当前选择根目录，且请求的 id 与当次扫描结果匹配；不接受 renderer 传入的任意绝对路径。缩略图写入还应限制格式为图片字节和合理大小，避免 renderer 借缓存接口写入任意文件。

## 预览与缓存策略

原生格式直接将受限 IPC 读取的字节转为 Blob/Object URL，供 `img` 预览。JXL 扩展在 Worker 中尝试可用的浏览器解码能力，再使用随应用打包的 WASM 解码器；超过限定时间或发生解码错误时，返回失败结果而不是阻塞主线程。

缓存目录位于 Gallery 的 `userData`，不修改源目录。缓存键包含源文件路径、大小、修改时间、扩展名与处理器版本；任一项变化即失效。缓存缺失与写入失败只降低性能，不能使素材列表失败。

## UI 约束

`@examples/gallery-assets` 保留主内容区素材页职责，使用已接入的 `JustifiedInfiniteGrid`。选择目录前显示空状态；扫描完成前显示加载状态；扫描后沿用 justified 图片流。工作台仍是 `ui-layout` 的唯一 `workbench` Slot，不新增平行预览面板或持久化分栏状态。

## 验证与验收

- 主进程扫描测试：只返回四种支持格式；递归目录有效；符号链接、目录和不可读项不会导致整体失败。
- IPC 测试：不能读取当前素材根之外的路径；缓存键在大小、修改时间或格式处理器版本变化时失效。
- renderer 测试：PNG/JPEG/WebP 选择原生处理器；`.jxl` 选择 JXL 扩展；未知/解码失败素材保持可见并标明失败。
- 路由交互测试：双击素材打开 `workbench`；离开 assets 路由释放工作台贡献。
- 生产验证：Gallery Electron build、类型检查、lint，以及手工选择含原生图片和 JXL 样本的目录，确认网格、缩略图与工作台预览。

验收标准是用户能在本地选择一个目录并稳定浏览原生素材与 JXL 样本；格式实现可通过静态注册扩展而非修改素材页的分支逻辑接入。运行时第三方插件安装不在本次验收范围内。
