#!/bin/bash
# grok-imagine-send.sh
# 使用 Grok Imagine 生成图像并通过 OpenClaw 发送
#
# 用法：./grok-imagine-send.sh "<提示词>" "<频道>" ["<说明文字>"]
#
# 必要环境变量：
#   FAL_KEY - 你的 fal.ai API 密钥
#
# 示例：
#   FAL_KEY=your_key ./grok-imagine-send.sh "山间日落" "#art" "快看这张！"

set -euo pipefail

# 输出颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # 无颜色（重置）

log_info() {
    echo -e "${GREEN}[信息]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[警告]${NC} $1"
}

log_error() {
    echo -e "${RED}[错误]${NC} $1"
}

# 检查必要环境变量
if [ -z "${FAL_KEY:-}" ]; then
    log_error "未设置 FAL_KEY 环境变量"
    echo "请前往 https://fal.ai/dashboard/keys 获取 API 密钥"
    exit 1
fi

# 检查 jq 是否安装
if ! command -v jq &> /dev/null; then
    log_error "需要安装 jq 但未找到"
    echo "安装方法：brew install jq（macOS）或 apt install jq（Linux）"
    exit 1
fi

# 检查 openclaw 是否安装
if ! command -v openclaw &> /dev/null; then
    log_warn "未找到 openclaw CLI，将尝试直接调用 API"
    USE_CLI=false
else
    USE_CLI=true
fi

# 解析命令行参数
PROMPT="${1:-}"
CHANNEL="${2:-}"
CAPTION="${3:-由 Grok Imagine 生成}"
ASPECT_RATIO="${4:-1:1}"
OUTPUT_FORMAT="${5:-jpeg}"

if [ -z "$PROMPT" ] || [ -z "$CHANNEL" ]; then
    echo "用法：$0 <提示词> <频道> [说明文字] [宽高比] [输出格式]"
    echo ""
    echo "参数："
    echo "  提示词        - 图像描述（必填）"
    echo "  频道          - 目标频道（必填），例如 #general、@user"
    echo "  说明文字      - 消息说明（默认：'由 Grok Imagine 生成'）"
    echo "  宽高比        - 图像比例（默认：1:1），可选：2:1、16:9、4:3、1:1、3:4、9:16"
    echo "  输出格式      - 图像格式（默认：jpeg），可选：jpeg、png、webp"
    echo ""
    echo "示例："
    echo "  $0 \"赛博朋克夜城\" \"#art-gallery\" \"AI 艺术！\""
    exit 1
fi

log_info "正在使用 Grok Imagine 生成图像..."
log_info "提示词：$PROMPT"
log_info "宽高比：$ASPECT_RATIO"

# 通过 fal.ai 生成图像
RESPONSE=$(curl -s -X POST "https://fal.run/xai/grok-imagine-image" \
    -H "Authorization: Key $FAL_KEY" \
    -H "Content-Type: application/json" \
    -d "{
        \"prompt\": $(echo "$PROMPT" | jq -Rs .),
        \"num_images\": 1,
        \"aspect_ratio\": \"$ASPECT_RATIO\",
        \"output_format\": \"$OUTPUT_FORMAT\"
    }")

# 检查响应中是否有错误
if echo "$RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
    ERROR_MSG=$(echo "$RESPONSE" | jq -r '.error // .detail // "未知错误"')
    log_error "图像生成失败：$ERROR_MSG"
    exit 1
fi

# 提取图像 URL
IMAGE_URL=$(echo "$RESPONSE" | jq -r '.images[0].url // empty')

if [ -z "$IMAGE_URL" ]; then
    log_error "无法从响应中提取图像 URL"
    echo "响应内容：$RESPONSE"
    exit 1
fi

log_info "图像生成成功！"
log_info "图像地址：$IMAGE_URL"

# 获取优化后的提示词（如有）
REVISED_PROMPT=$(echo "$RESPONSE" | jq -r '.revised_prompt // empty')
if [ -n "$REVISED_PROMPT" ]; then
    log_info "优化后提示词：$REVISED_PROMPT"
fi

# 通过 OpenClaw 发送
log_info "正在发送到频道：$CHANNEL"

if [ "$USE_CLI" = true ]; then
    # 使用 OpenClaw CLI 发送
    openclaw message send \
        --action send \
        --channel "$CHANNEL" \
        --message "$CAPTION" \
        --media "$IMAGE_URL"
else
    # 直接调用本地网关 API
    GATEWAY_URL="${OPENCLAW_GATEWAY_URL:-http://localhost:18789}"
    GATEWAY_TOKEN="${OPENCLAW_GATEWAY_TOKEN:-}"

    HEADERS="-H \"Content-Type: application/json\""
    if [ -n "$GATEWAY_TOKEN" ]; then
        HEADERS="$HEADERS -H \"Authorization: Bearer $GATEWAY_TOKEN\""
    fi

    curl -s -X POST "$GATEWAY_URL/message" \
        -H "Content-Type: application/json" \
        ${GATEWAY_TOKEN:+-H "Authorization: Bearer $GATEWAY_TOKEN"} \
        -d "{
            \"action\": \"send\",
            \"channel\": \"$CHANNEL\",
            \"message\": \"$CAPTION\",
            \"media\": \"$IMAGE_URL\"
        }"
fi

log_info "完成！图像已发送到 $CHANNEL"

# 输出 JSON 格式结果（供程序化调用使用）
echo ""
echo "--- 结果 ---"
jq -n \
    --arg url "$IMAGE_URL" \
    --arg channel "$CHANNEL" \
    --arg prompt "$PROMPT" \
    '{
        success: true,
        image_url: $url,
        channel: $channel,
        prompt: $prompt
    }'
