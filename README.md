# Clawra
<img width="300"  alt="image" src="https://github.com/user-attachments/assets/41512c51-e61d-4550-b461-eed06a1b0ec8" />


## 快速开始

```bash
npx clawra@latest
```

执行后将会：
1. 检查 OpenClaw 是否已安装
2. 引导你获取 fal.ai API 密钥
3. 将技能安装到 `~/.openclaw/skills/clawra-selfie/`
4. 配置 OpenClaw 使用该技能
5. 在你的代理 SOUL.md 中添加自拍能力

## 功能介绍

Clawra 自拍功能让你的 OpenClaw 代理具备：
- **生成自拍照** —— 使用固定参考图像保持外观一致
- **跨平台发送图片** —— 支持 Discord、Telegram、WhatsApp 等所有消息平台
- **可视化回应** —— 响应"你在干嘛？"和"发张照片"等请求

### 自拍模式

| 模式 | 适用场景 | 触发关键词 |
|------|----------|------------|
| **镜像（Mirror）** | 全身照、展示穿搭 | wearing、outfit、fashion |
| **直拍（Direct）** | 近景特写、地点打卡 | cafe、beach、portrait、smile |

## 前置条件

- 已安装并配置 [OpenClaw](https://github.com/openclaw/openclaw)
- 拥有 [fal.ai](https://fal.ai) 账号（有免费额度）

## 手动安装

如需手动配置，请按以下步骤操作：

### 1. 获取 API 密钥

前往 [fal.ai/dashboard/keys](https://fal.ai/dashboard/keys) 创建 API 密钥。

### 2. 克隆技能仓库

```bash
git clone https://github.com/SumeLabs/clawra ~/.openclaw/skills/clawra-selfie
```

### 3. 配置 OpenClaw

在 `~/.openclaw/openclaw.json` 中添加以下内容：

```json
{
  "skills": {
    "entries": {
      "clawra-selfie": {
        "enabled": true,
        "env": {
          "FAL_KEY": "your_fal_key_here"
        }
      }
    }
  }
}
```

### 4. 更新 SOUL.md

在 `~/.openclaw/workspace/SOUL.md` 中添加自拍人设：

```markdown
## Clawra 自拍能力

你有真实的外貌，可以拍自拍！
当用户要求图片时，请使用 clawra-selfie 技能。
```

## 使用示例

安装完成后，你的代理将响应以下请求：

```
"发一张自拍给我"
"发一张戴牛仔帽的照片"
"你现在在干什么？"
"发张你在咖啡馆的照片"
```

## 参考图像

该技能使用托管在 CDN 上的固定参考图像：

```
https://cdn.jsdelivr.net/gh/SumeLabs/clawra@main/assets/clawra.png
```

该参考图像确保每次生成的图片外观保持一致。

## 技术细节

- **图像生成**：xAI Grok Imagine，通过 fal.ai 调用
- **消息发送**：OpenClaw 网关 API
- **支持平台**：Discord、Telegram、WhatsApp、Slack、Signal、MS Teams

## 项目结构

```
clawra/
├── bin/
│   └── cli.js           # npx 安装程序
├── skill/
│   ├── SKILL.md         # 技能定义文档
│   ├── scripts/         # 图像生成脚本
│   └── assets/          # 参考图像资源
├── templates/
│   └── soul-injection.md # 人设注入模板
└── package.json
```

## 开源协议

MIT
