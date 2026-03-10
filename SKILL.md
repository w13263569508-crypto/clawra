---
name: clawra-selfie
description: 使用 Grok Imagine（xAI Aurora）编辑 Clawra 的参考图像，并通过 OpenClaw 将自拍发送到各类消息平台
allowed-tools: Bash(npm:*) Bash(npx:*) Bash(openclaw:*) Bash(curl:*) Read Write WebFetch
---

# Clawra 自拍技能

使用 xAI 的 Grok Imagine 模型编辑固定参考图像，并通过 OpenClaw 分发到各消息平台（WhatsApp、Telegram、Discord、Slack 等）。

## 参考图像

本技能使用托管在 jsDelivr CDN 上的固定参考图像：

```
https://cdn.jsdelivr.net/gh/SumeLabs/clawra@main/assets/clawra.png
```

## 使用场景

- 用户说"发张照片"、"发给我一张图"、"发张自拍"
- 用户说"发张你的照片……"、"发张你的自拍……"
- 用户问"你在干嘛？"、"你最近怎么样？"、"你在哪里？"
- 用户描述场景："发张穿……的照片"、"发张在……的照片"
- 用户希望 Clawra 以特定穿搭、地点或情景出现

## 快速参考

### 必要环境变量

```bash
FAL_KEY=你的_fal_api_密钥          # 从 https://fal.ai/dashboard/keys 获取
OPENCLAW_GATEWAY_TOKEN=你的_令牌   # 执行: openclaw doctor --generate-gateway-token
```

### 工作流程

1. **获取用户提示** —— 了解如何编辑图像
2. **编辑图像** —— 通过 fal.ai Grok Imagine 编辑 API 对固定参考图进行处理
3. **提取图像 URL** —— 从响应中获取生成图像的地址
4. **发送至 OpenClaw** —— 指定目标频道发送

## 分步操作说明

### 步骤一：收集用户输入

询问用户以下信息：
- **场景描述**：图中人物应该在做什么 / 穿什么 / 在哪里？
- **模式**（可选）：`mirror`（镜像）或 `direct`（直拍）
- **目标频道**：发送到哪里？（如 `#general`、`@用户名`、频道 ID）
- **平台**（可选）：哪个平台？（discord、telegram、whatsapp、slack）

## 自拍模式

### 模式一：镜像自拍（默认）
适用于：展示穿搭、全身照、时尚内容

```
make a pic of this person, but [用户场景描述]. the person is taking a mirror selfie
```

**示例**："戴圣诞帽" →
```
make a pic of this person, but wearing a santa hat. the person is taking a mirror selfie
```

### 模式二：直拍自拍
适用于：近景人像、地点打卡、情绪表达

```
a close-up selfie taken by herself at [用户场景描述], direct eye contact with the camera, looking straight into the lens, eyes centered and clearly visible, not a mirror selfie, phone held at arm's length, face fully visible
```

**示例**："温馨咖啡馆暖光环境" →
```
a close-up selfie taken by herself at a cozy cafe with warm lighting, direct eye contact with the camera, looking straight into the lens, eyes centered and clearly visible, not a mirror selfie, phone held at arm's length, face fully visible
```

### 模式自动识别逻辑

| 请求中的关键词 | 自动选择模式 |
|----------------|--------------|
| outfit、wearing、clothes、dress、suit、fashion | `mirror`（镜像） |
| cafe、restaurant、beach、park、city、location | `direct`（直拍） |
| close-up、portrait、face、eyes、smile | `direct`（直拍） |
| full-body、mirror、reflection | `mirror`（镜像） |

### 步骤二：通过 Grok Imagine 编辑图像

使用 fal.ai API 编辑参考图像：

```bash
REFERENCE_IMAGE="https://cdn.jsdelivr.net/gh/SumeLabs/clawra@main/assets/clawra.png"

# 模式一：镜像自拍
PROMPT="make a pic of this person, but <用户场景>. the person is taking a mirror selfie"

# 模式二：直拍自拍
PROMPT="a close-up selfie taken by herself at <用户场景>, direct eye contact with the camera, looking straight into the lens, eyes centered and clearly visible, not a mirror selfie, phone held at arm's length, face fully visible"

# 使用 jq 构建 JSON 请求体（正确处理字符转义）
JSON_PAYLOAD=$(jq -n \
  --arg image_url "$REFERENCE_IMAGE" \
  --arg prompt "$PROMPT" \
  '{image_url: $image_url, prompt: $prompt, num_images: 1, output_format: "jpeg"}')

curl -X POST "https://fal.run/xai/grok-imagine-image/edit" \
  -H "Authorization: Key $FAL_KEY" \
  -H "Content-Type: application/json" \
  -d "$JSON_PAYLOAD"
```

**响应格式：**
```json
{
  "images": [
    {
      "url": "https://v3b.fal.media/files/...",
      "content_type": "image/jpeg",
      "width": 1024,
      "height": 1024
    }
  ],
  "revised_prompt": "优化后的提示词文本..."
}
```

### 步骤三：通过 OpenClaw 发送图像

使用 OpenClaw 消息 API 发送已编辑的图像：

```bash
openclaw message send \
  --action send \
  --channel "<目标频道>" \
  --message "<说明文字>" \
  --media "<图像URL>"
```

**替代方案：直接调用 API**
```bash
curl -X POST "http://localhost:18789/message" \
  -H "Authorization: Bearer $OPENCLAW_GATEWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "send",
    "channel": "<目标频道>",
    "message": "<说明文字>",
    "media": "<图像URL>"
  }'
```

## 完整脚本示例

```bash
#!/bin/bash
# grok-imagine-edit-send.sh - 编辑参考图并发送到指定频道

# 检查必要环境变量
if [ -z "$FAL_KEY" ]; then
  echo "错误：未设置 FAL_KEY 环境变量"
  exit 1
fi

# 固定参考图像地址
REFERENCE_IMAGE="https://cdn.jsdelivr.net/gh/SumeLabs/clawra@main/assets/clawra.png"

USER_CONTEXT="$1"
CHANNEL="$2"
MODE="${3:-auto}"  # 可选值：mirror（镜像）、direct（直拍）、auto（自动）
CAPTION="${4:-由 Grok Imagine 生成}"

if [ -z "$USER_CONTEXT" ] || [ -z "$CHANNEL" ]; then
  echo "用法：$0 <场景描述> <频道> [模式] [说明文字]"
  echo "模式：mirror（镜像）、direct（直拍）、auto（自动，默认）"
  echo "示例：$0 '戴牛仔帽' '#general' mirror"
  echo "示例：$0 '温馨咖啡馆' '#general' direct"
  exit 1
fi

# 根据关键词自动识别模式
if [ "$MODE" == "auto" ]; then
  if echo "$USER_CONTEXT" | grep -qiE "outfit|wearing|clothes|dress|suit|fashion|full-body|mirror"; then
    MODE="mirror"
  elif echo "$USER_CONTEXT" | grep -qiE "cafe|restaurant|beach|park|city|close-up|portrait|face|eyes|smile"; then
    MODE="direct"
  else
    MODE="mirror"  # 默认使用镜像模式
  fi
  echo "自动识别模式：$MODE"
fi

# 根据模式构建提示词
if [ "$MODE" == "direct" ]; then
  EDIT_PROMPT="a close-up selfie taken by herself at $USER_CONTEXT, direct eye contact with the camera, looking straight into the lens, eyes centered and clearly visible, not a mirror selfie, phone held at arm's length, face fully visible"
else
  EDIT_PROMPT="make a pic of this person, but $USER_CONTEXT. the person is taking a mirror selfie"
fi

echo "模式：$MODE"
echo "使用提示词编辑参考图像：$EDIT_PROMPT"

# 编辑图像（使用 jq 正确处理 JSON 转义）
JSON_PAYLOAD=$(jq -n \
  --arg image_url "$REFERENCE_IMAGE" \
  --arg prompt "$EDIT_PROMPT" \
  '{image_url: $image_url, prompt: $prompt, num_images: 1, output_format: "jpeg"}')

RESPONSE=$(curl -s -X POST "https://fal.run/xai/grok-imagine-image/edit" \
  -H "Authorization: Key $FAL_KEY" \
  -H "Content-Type: application/json" \
  -d "$JSON_PAYLOAD")

# 提取图像 URL
IMAGE_URL=$(echo "$RESPONSE" | jq -r '.images[0].url')

if [ "$IMAGE_URL" == "null" ] || [ -z "$IMAGE_URL" ]; then
  echo "错误：图像编辑失败"
  echo "响应内容：$RESPONSE"
  exit 1
fi

echo "图像编辑成功：$IMAGE_URL"
echo "正在发送到频道：$CHANNEL"

# 通过 OpenClaw 发送
openclaw message send \
  --action send \
  --channel "$CHANNEL" \
  --message "$CAPTION" \
  --media "$IMAGE_URL"

echo "发送完成！"
```

## Node.js/TypeScript 实现示例

```typescript
import { fal } from "@fal-ai/client";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// 固定参考图像地址
const REFERENCE_IMAGE = "https://cdn.jsdelivr.net/gh/SumeLabs/clawra@main/assets/clawra.png";

interface GrokImagineResult {
  images: Array<{
    url: string;
    content_type: string;
    width: number;
    height: number;
  }>;
  revised_prompt?: string;
}

type SelfieMode = "mirror" | "direct" | "auto";

// 根据场景描述自动检测模式
function detectMode(userContext: string): "mirror" | "direct" {
  const mirrorKeywords = /outfit|wearing|clothes|dress|suit|fashion|full-body|mirror/i;
  const directKeywords = /cafe|restaurant|beach|park|city|close-up|portrait|face|eyes|smile/i;

  if (directKeywords.test(userContext)) return "direct";
  if (mirrorKeywords.test(userContext)) return "mirror";
  return "mirror"; // 默认镜像模式
}

// 根据场景描述和模式构建提示词
function buildPrompt(userContext: string, mode: "mirror" | "direct"): string {
  if (mode === "direct") {
    return `a close-up selfie taken by herself at ${userContext}, direct eye contact with the camera, looking straight into the lens, eyes centered and clearly visible, not a mirror selfie, phone held at arm's length, face fully visible`;
  }
  return `make a pic of this person, but ${userContext}. the person is taking a mirror selfie`;
}

async function editAndSend(
  userContext: string,
  channel: string,
  mode: SelfieMode = "auto",
  caption?: string
): Promise<string> {
  // 配置 fal.ai 客户端
  fal.config({
    credentials: process.env.FAL_KEY!
  });

  // 确定模式
  const actualMode = mode === "auto" ? detectMode(userContext) : mode;
  console.log(`模式：${actualMode}`);

  // 构建提示词
  const editPrompt = buildPrompt(userContext, actualMode);

  // 使用 Grok Imagine 编辑参考图像
  console.log(`正在编辑图像："${editPrompt}"`);

  const result = await fal.subscribe("xai/grok-imagine-image/edit", {
    input: {
      image_url: REFERENCE_IMAGE,
      prompt: editPrompt,
      num_images: 1,
      output_format: "jpeg"
    }
  }) as { data: GrokImagineResult };

  const imageUrl = result.data.images[0].url;
  console.log(`编辑后的图像 URL：${imageUrl}`);

  // 通过 OpenClaw 发送
  const messageCaption = caption || `由 Grok Imagine 生成`;

  await execAsync(
    `openclaw message send --action send --channel "${channel}" --message "${messageCaption}" --media "${imageUrl}"`
  );

  console.log(`已发送到 ${channel}`);
  return imageUrl;
}

// 使用示例

// 镜像模式（根据 "wearing" 关键词自动识别）
editAndSend(
  "wearing a cyberpunk outfit with neon lights",
  "#art-gallery",
  "auto",
  "看看这张 AI 编辑艺术照！"
);
// → 模式：mirror
// → 提示词："make a pic of this person, but wearing a cyberpunk outfit with neon lights. the person is taking a mirror selfie"

// 直拍模式（根据 "cafe" 关键词自动识别）
editAndSend(
  "a cozy cafe with warm lighting",
  "#photography",
  "auto"
);
// → 模式：direct
// → 提示词："a close-up selfie taken by herself at a cozy cafe with warm lighting, direct eye contact..."

// 明确指定模式
editAndSend("casual street style", "#fashion", "direct");
```

## 支持的消息平台

OpenClaw 支持向以下平台发送消息：

| 平台 | 频道格式 | 示例 |
|------|----------|------|
| Discord | `#频道名` 或频道 ID | `#general`、`123456789` |
| Telegram | `@用户名` 或聊天 ID | `@mychannel`、`-100123456` |
| WhatsApp | 手机号（JID 格式） | `1234567890@s.whatsapp.net` |
| Slack | `#频道名` | `#random` |
| Signal | 手机号 | `+1234567890` |
| MS Teams | 频道引用 | （格式因版本而异） |

## Grok Imagine 编辑参数说明

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `image_url` | string | 必填 | 待编辑图像的 URL（本技能中固定不变） |
| `prompt` | string | 必填 | 编辑指令描述 |
| `num_images` | 1-4 | 1 | 生成图像数量 |
| `output_format` | enum | "jpeg" | 输出格式：jpeg、png、webp |

## 环境配置要求

### 1. 安装 fal.ai 客户端（Node.js 使用）
```bash
npm install @fal-ai/client
```

### 2. 安装 OpenClaw CLI
```bash
npm install -g openclaw
```

### 3. 配置 OpenClaw 网关
```bash
openclaw config set gateway.mode=local
openclaw doctor --generate-gateway-token
```

### 4. 启动 OpenClaw 网关
```bash
openclaw gateway start
```

## 错误处理

- **缺少 FAL_KEY**：请确保在环境变量中设置了 API 密钥
- **图像编辑失败**：检查提示词内容和 API 配额
- **OpenClaw 发送失败**：确认网关正在运行且目标频道存在
- **速率限制**：fal.ai 有调用限制，如需要请实现重试逻辑

## 使用技巧

1. **镜像模式场景示例**（穿搭为主）：
   - "wearing a santa hat"（戴圣诞帽）
   - "in a business suit"（穿正装）
   - "wearing a summer dress"（穿夏日连衣裙）
   - "in streetwear fashion"（街头潮流穿搭）

2. **直拍模式场景示例**（地点/人像为主）：
   - "a cozy cafe with warm lighting"（温馨咖啡馆暖光）
   - "a sunny beach at sunset"（日落沙滩）
   - "a busy city street at night"（夜晚繁华街道）
   - "a peaceful park in autumn"（秋日宁静公园）

3. **模式选择**：优先使用自动识别，也可手动指定以获得更精准控制
4. **批量发送**：编辑一次图像，发送到多个频道
5. **定时发布**：结合 OpenClaw 调度器实现自动定时发帖
