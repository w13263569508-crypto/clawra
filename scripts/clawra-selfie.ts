/**
 * Grok Imagine 与 OpenClaw 集成
 *
 * 通过 fal.ai 使用 xAI 的 Grok Imagine 模型生成图像，
 * 并通过 OpenClaw 发送到各消息频道。
 *
 * 用法：
 *   npx ts-node grok-imagine-send.ts "<提示词>" "<频道>" ["<说明文字>"]
 *
 * 环境变量：
 *   FAL_KEY - 你的 fal.ai API 密钥
 *   OPENCLAW_GATEWAY_URL - OpenClaw 网关地址（默认：http://localhost:18789）
 *   OPENCLAW_GATEWAY_TOKEN - 网关认证令牌（可选）
 */

import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// 类型定义
interface GrokImagineInput {
  prompt: string;
  num_images?: number;
  aspect_ratio?: AspectRatio;
  output_format?: OutputFormat;
}

interface GrokImagineImage {
  url: string;
  content_type: string;
  file_name?: string;
  width: number;
  height: number;
}

interface GrokImagineResponse {
  images: GrokImagineImage[];
  revised_prompt?: string;
}

interface OpenClawMessage {
  action: "send";
  channel: string;
  message: string;
  media?: string;
}

type AspectRatio =
  | "2:1"
  | "20:9"
  | "19.5:9"
  | "16:9"
  | "4:3"
  | "3:2"
  | "1:1"
  | "2:3"
  | "3:4"
  | "9:16"
  | "9:19.5"
  | "9:20"
  | "1:2";

type OutputFormat = "jpeg" | "png" | "webp";

interface GenerateAndSendOptions {
  prompt: string;
  channel: string;
  caption?: string;
  aspectRatio?: AspectRatio;
  outputFormat?: OutputFormat;
  useClaudeCodeCLI?: boolean;
}

interface Result {
  success: boolean;
  imageUrl: string;
  channel: string;
  prompt: string;
  revisedPrompt?: string;
}

// 检查 fal.ai 客户端是否可用
let falClient: any;
try {
  const { fal } = require("@fal-ai/client");
  falClient = fal;
} catch {
  // fal 客户端不可用，将使用 fetch 作为替代
  falClient = null;
}

/**
 * 通过 fal.ai 使用 Grok Imagine 生成图像
 */
async function generateImage(
  input: GrokImagineInput
): Promise<GrokImagineResponse> {
  const falKey = process.env.FAL_KEY;

  if (!falKey) {
    throw new Error(
      "未设置 FAL_KEY 环境变量。请从 https://fal.ai/dashboard/keys 获取密钥"
    );
  }

  // 优先使用 fal 客户端
  if (falClient) {
    falClient.config({ credentials: falKey });

    const result = await falClient.subscribe("xai/grok-imagine-image", {
      input: {
        prompt: input.prompt,
        num_images: input.num_images || 1,
        aspect_ratio: input.aspect_ratio || "1:1",
        output_format: input.output_format || "jpeg",
      },
    });

    return result.data as GrokImagineResponse;
  }

  // 回退到 fetch 方式
  const response = await fetch("https://fal.run/xai/grok-imagine-image", {
    method: "POST",
    headers: {
      Authorization: `Key ${falKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: input.prompt,
      num_images: input.num_images || 1,
      aspect_ratio: input.aspect_ratio || "1:1",
      output_format: input.output_format || "jpeg",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`图像生成失败：${error}`);
  }

  return response.json();
}

/**
 * 通过 OpenClaw 发送图像
 */
async function sendViaOpenClaw(
  message: OpenClawMessage,
  useCLI: boolean = true
): Promise<void> {
  if (useCLI) {
    // 使用 OpenClaw CLI 发送
    const cmd = `openclaw message send --action send --channel "${message.channel}" --message "${message.message}" --media "${message.media}"`;
    await execAsync(cmd);
    return;
  }

  // 直接调用 API
  const gatewayUrl =
    process.env.OPENCLAW_GATEWAY_URL || "http://localhost:18789";
  const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (gatewayToken) {
    headers["Authorization"] = `Bearer ${gatewayToken}`;
  }

  const response = await fetch(`${gatewayUrl}/message`, {
    method: "POST",
    headers,
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenClaw 发送失败：${error}`);
  }
}

/**
 * 主函数：生成图像并发送到频道
 */
async function generateAndSend(options: GenerateAndSendOptions): Promise<Result> {
  const {
    prompt,
    channel,
    caption = "由 Grok Imagine 生成",
    aspectRatio = "1:1",
    outputFormat = "jpeg",
    useClaudeCodeCLI = true,
  } = options;

  console.log(`[信息] 正在使用 Grok Imagine 生成图像...`);
  console.log(`[信息] 提示词：${prompt}`);
  console.log(`[信息] 宽高比：${aspectRatio}`);

  // 生成图像
  const imageResult = await generateImage({
    prompt,
    num_images: 1,
    aspect_ratio: aspectRatio,
    output_format: outputFormat,
  });

  const imageUrl = imageResult.images[0].url;
  console.log(`[信息] 图像已生成：${imageUrl}`);

  if (imageResult.revised_prompt) {
    console.log(`[信息] 优化后提示词：${imageResult.revised_prompt}`);
  }

  // 通过 OpenClaw 发送
  console.log(`[信息] 正在发送到频道：${channel}`);

  await sendViaOpenClaw(
    {
      action: "send",
      channel,
      message: caption,
      media: imageUrl,
    },
    useClaudeCodeCLI
  );

  console.log(`[信息] 完成！图像已发送到 ${channel}`);

  return {
    success: true,
    imageUrl,
    channel,
    prompt,
    revisedPrompt: imageResult.revised_prompt,
  };
}

// 命令行入口
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log(`
用法：npx ts-node grok-imagine-send.ts <提示词> <频道> [说明文字] [宽高比] [输出格式]

参数：
  提示词        - 图像描述（必填）
  频道          - 目标频道（必填），例如 #general、@user
  说明文字      - 消息说明（默认：'由 Grok Imagine 生成'）
  宽高比        - 图像比例（默认：1:1），可选：2:1、16:9、4:3、1:1、3:4、9:16
  输出格式      - 图像格式（默认：jpeg），可选：jpeg、png、webp

环境变量：
  FAL_KEY       - 你的 fal.ai API 密钥（必填）

示例：
  FAL_KEY=your_key npx ts-node grok-imagine-send.ts "赛博朋克城市" "#art" "快看这个！"
`);
    process.exit(1);
  }

  const [prompt, channel, caption, aspectRatio, outputFormat] = args;

  try {
    const result = await generateAndSend({
      prompt,
      channel,
      caption,
      aspectRatio: aspectRatio as AspectRatio,
      outputFormat: outputFormat as OutputFormat,
    });

    console.log("\n--- 结果 ---");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(`[错误] ${(error as Error).message}`);
    process.exit(1);
  }
}

// 导出供模块使用
export {
  generateImage,
  sendViaOpenClaw,
  generateAndSend,
  GrokImagineInput,
  GrokImagineResponse,
  OpenClawMessage,
  GenerateAndSendOptions,
  Result,
};

// 直接执行时运行
if (require.main === module) {
  main();
}
