# 云函数说明

## 函数

- `createMatch`：创建比赛、房间和初始快照。
- `parseEvent`：把文本解析为待确认草稿。
- `confirmEvent`：确认草稿、写入正式事件、重算快照。
- `transcribeAudio`：把云存储中的录音交给火山引擎转写。
- `saveSignature`：保存双方队长签字图片引用。
- `generateArchive`：生成归档版本、正式计分表 HTML、PDF 报告和结构化 JSON。
- `getArchiveStatus`：读取已保存签字和最新归档文件临时链接。

## 需要的集合

- `matches`
- `rooms`
- `snapshots`
- `events`
- `signatures`
- `archives`
- `exportFiles`

建议权限：

- `matches`、`events`、`signatures`、`archives`、`exportFiles`：仅云函数读写。
- `rooms`、`snapshots`：允许所有用户读取，写入仅走云函数。

当前环境已用 CloudBase CLI 设置为：

- `rooms`、`snapshots`：`ADMINWRITE`
- `matches`、`events`、`signatures`、`archives`、`exportFiles`：`ADMINONLY`

## 需要的环境变量

`transcribeAudio` 云函数需要在云端函数配置中设置：

- `VOLC_ASR_APP_ID`
- `VOLC_ASR_ACCESS_TOKEN`
- `VOLC_ASR_SECRET_KEY`
- `VOLC_ASR_CLUSTER`

敏感值不要写入小程序端代码。云函数环境变量会在运行时注入函数执行环境。
