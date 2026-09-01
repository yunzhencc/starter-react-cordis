# DeepSeek 对齐的静态插件启动设计

## 目标

以 DeepSeek Harness 的启动模型替换 Web 应用中硬编码的插件数组：`cordis.yml` 决定启用的插件，Node 侧读取其包元数据生成启动图，浏览器按图加载并通过 Cordis 激活插件。

开发期由 Vite 的 Node 进程生成启动图；生产构建把启动图和插件 chunk 输出到 `dist`，部署时仍是普通静态站点，不需要常驻 Node 宿主。

## 非目标

- 不提供生产期 Node Web 服务器、组合 bundle URL 或服务端缓存策略。
- 不提供插件 HMR、远程下载、运行时安装、动态插件运行器或插件管理 UI。
- 不支持 `!!js` 配置表达式；浏览器可见的 `config` 必须是 JSON 可序列化值。
- 不扫描整个工作区；只有 `cordis.yml` 中启用的 Loader 条目才会被解析。

## 配置与包契约

根目录 `cordis.yml` 是顶层 Loader 条目数组，沿用 DeepSeek 的 `id`、`name`、`disabled` 与 `config` 语义：

```yml
- id: renderer
  name: '@yunzhen/cordis-ui-renderer'

- id: dashboard
  name: '@yunzhen/cordis-feature-dashboard'
  disabled: false
```

每个进入浏览器启动图的包必须同时满足：

1. 在配置中有唯一的启用 `id`。
2. `package.json` 有 `exports["./client"]`。
3. `package.json` 声明 `yunzhen.client`：

```json
{
  "yunzhen": {
    "client": {
      "platform": "web",
      "inject": ["slots", "routes"],
      "immediately": false
    }
  }
}
```

`yunzhen.client.inject` 用于生成启动图的依赖顺序；插件自身的 Cordis `inject + apply` 仍是运行时服务等待和生命周期的唯一依据。`immediately` 保留为启动优先级元数据，但第一版不做预取或并行批次优化。

## 架构

```text
cordis.yml + package.json 的 yunzhen.client
                    ↓
           Node 侧插件目录生成器
                    ↓
BootManifest（id、依赖、配置、版本、入口）
          ↙                         ↘
Vite 开发虚拟模块                 Vite 构建 dist/cordis.boot.json
          ↓                         ↓
          浏览器 Boot Loader + 插件 registry
                    ↓
                Cordis 激活插件
                    ↓
              uiRenderer 挂载应用
```

### Node 侧目录生成器

新增最小的 Node-only catalog 包。它读取 `cordis.yml`、解析每个已启用包的 `package.json`，并产出确定性的 `BootManifest`。它必须在任何浏览器 bundle 创建前拒绝：

- 重复 `id`；
- 找不到的包或 `./client` 导出；
- 缺失或非 web 的 `yunzhen.client`；
- 缺失的启动依赖或依赖循环；
- 不能 JSON 序列化的 `config`。

该包不启动 Cordis Fiber，也不执行插件代码。

### Vite 集成

`apps/web/vite.config.ts` 以同一个 catalog 作为开发与构建入口：

- 开发：暴露虚拟启动模块和按插件 ID 解析的 `import()` registry；Vite 负责提供模块。
- 构建：发出 `dist/cordis.boot.json`，同时让 Vite 为 registry 中的动态导入产生独立 chunk。

浏览器 Loader 的输入在两种模式下都等价：manifest 与 `id -> import()` registry。生产环境只要托管 `dist`；不使用 Node 的发现、扫描或请求处理能力。

### 浏览器启动

应用入口不再导入或遍历 `webAppPlugins`。Boot Loader 读取 manifest，按其拓扑顺序导入插件模块，并将每个模块交给 Cordis Loader 激活。全部条目 active 后，才调用 `ctx.uiRenderer.mount()`。

加载、导入或激活失败时，入口保留明确的启动失败画面和控制台错误；错误必须包含条目 `id` 和阶段（catalog、import、activate）。不能显示空白页面，也不能继续挂载半初始化应用。

## 迁移范围

- 新增根目录 `cordis.yml`，并把现有六个内置插件迁移到其中。
- 扩展现有 `@yunzhen/cordis-client-modules`，承载 `BootManifest`、浏览器 registry 合约与 Boot Loader。
- 新增 Node-only catalog 包，供 Vite 配置复用。
- 改造 `apps/web/vite.config.ts` 与 `apps/web/src/main.tsx`。
- 各内置插件包添加 `yunzhen.client` 与 `./client` 导出。
- 删除 `@yunzhen/cordis-bundle-web-app` 的硬编码 `webAppPlugins`，不保留兼容入口。

## 验收与测试

1. Catalog 单元测试覆盖配置、包元数据、依赖拓扑与所有拒绝路径。
2. Browser Boot Loader 测试覆盖依赖顺序、模块导入失败与插件激活失败。
3. 构建测试验证 `cordis.boot.json` 与被引用插件 chunk 均存在。
4. `cordis.yml` 禁用 Dashboard 后，Dashboard 路由和 workbench 不出现；Settings 与 Theme 仍正常工作。
5. `pnpm dev` 与 `pnpm build` 生成的纯静态产物均能启动应用。

## 后续演进

以后若需要对齐 DeepSeek 的完整设施，可以在此边界外增量加入：Node Web 宿主、组合 bundle/版本缓存、预取批次、HMR、远程插件和动态运行器。它们不改变本设计的配置、manifest 或浏览器 Loader 基本契约。
