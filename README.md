# 七圣召唤卡牌版本比较与选择器

基于 Solid.js 的静态页面，用于比较 `v3.3.0` 至当前正式版本的卡牌/实体变化，并导出逐实体的版本选择。

## 本地开发

要求 Node.js 26+ 与 pnpm 11。默认假设本仓库与 `static-data`、`genius-invokation` 位于同一父目录：

```powershell
pnpm install
pnpm dev
```

如目录不同，可通过 `STATIC_DATA_PATH` 和 `DEPENDENCY_DATA_PATH` 指定构建期数据源；运行时静态数据 API 可通过 `VITE_ASSETS_API_ENDPOINT` 覆盖。

## 验证

```powershell
pnpm check
pnpm test
pnpm test:e2e
pnpm build
```

生成的 `src/generated/compare-data.json` 与 `dist/` 均不进入版本控制。清单只包含版本区间等派生信息，不包含描述、费用、生命值或充能值原文。
