# 小程序工程说明

这里是“篮球技术台自动化”的微信小程序实现目录。

## 运行检查

```powershell
npm install
npm run typecheck
npm test
npm run build:miniprogram
```

## 微信开发者工具

用微信开发者工具打开当前 `coding区` 目录。项目已配置真实小程序 AppID，云开发环境在小程序启动时初始化。

## 目录

- `miniprogram/`：小程序页面、领域逻辑和云服务调用。
- `cloudfunctions/`：云函数，覆盖建赛、解析、确认、语音转写、签字、归档。
- `tests/`：本地确定性测试。

敏感凭据不在源码中；语音服务凭据只通过云函数环境变量读取。
