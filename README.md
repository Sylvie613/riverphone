# RiverPhone

RiverPhone 是一个给 SillyTavern 用的轻量“小手机”扩展。

这一版把原本塞在「余斯是」角色卡里的 RiverPhone 从 Tavern Helper 角色脚本 iframe 中拆了出来，改成直接运行在 SillyTavern 主页面的第三方扩展。这样悬浮按钮和手机面板的点击事件不会再因为角色脚本 iframe 重载而失效。

## v0.1.0

目前包含：

- 常驻悬浮手机按钮
- iPhone / 手机端适配
- Night 私聊
- 余斯是线下私聊
- 204 宿舍群聊
- 手机内发送消息，并通过当前 SillyTavern 模型生成对方回复
- 剧情状态
- 十轮记忆显示
- 未读通知
- 从角色回复末尾的隐藏 RiverPhone 数据自动更新手机
- 把手机内发生的互动重新注入主剧情上下文
- 在正文下方渲染原来的折叠状态栏
- 当前聊天独立保存手机数据

## 安装

在 SillyTavern 的「扩展 / Download Extensions & Assets」里选择安装第三方扩展，填写仓库地址：

```
https://github.com/Sylvie613/riverphone
```

安装后刷新 SillyTavern。

### 余斯是旧卡

安装扩展后，请关闭角色卡里旧的：

`RiverPhone · 余斯是`

角色脚本，避免旧手机和扩展版重复加载。

RiverPhone 扩展会直接读取余斯是已有的 `<!--RIVERPHONE ... RIVERPHONE-->` 数据格式，因此状态和记忆协议可以继续沿用。

## 文件

- `manifest.json` — SillyTavern 扩展清单
- `index.js` — RiverPhone 引擎
- `style.css` — 手机 UI

## 计划

后续在仓库里继续补：

- 动态 / 朋友圈
- 校园论坛
- 音乐页
- 备忘录
- 更通用的角色配置接口
- 不同角色卡独立主题

River × Sylvie
