#!/usr/bin/env node

/**
 * Clawra - OpenClaw 自拍技能安装程序
 *
 * 使用方法：npx clawra@latest
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { execSync, spawn } = require("child_process");
const os = require("os");

// 终端输出颜色定义
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

const c = (color, text) => `${colors[color]}${text}${colors.reset}`;

// 路径定义
const HOME = os.homedir();
const OPENCLAW_DIR = path.join(HOME, ".openclaw");
const OPENCLAW_CONFIG = path.join(OPENCLAW_DIR, "openclaw.json");
const OPENCLAW_SKILLS_DIR = path.join(OPENCLAW_DIR, "skills");
const OPENCLAW_WORKSPACE = path.join(OPENCLAW_DIR, "workspace");
const SOUL_MD = path.join(OPENCLAW_WORKSPACE, "SOUL.md");
const IDENTITY_MD = path.join(OPENCLAW_WORKSPACE, "IDENTITY.md");
const SKILL_NAME = "clawra-selfie";
const SKILL_DEST = path.join(OPENCLAW_SKILLS_DIR, SKILL_NAME);

// 获取包根目录（当前 CLI 安装来源）
const PACKAGE_ROOT = path.resolve(__dirname, "..");

function log(msg) {
  console.log(msg);
}

function logStep(step, msg) {
  console.log(`\n${c("cyan", `[${step}]`)} ${msg}`);
}

function logSuccess(msg) {
  console.log(`${c("green", "✓")} ${msg}`);
}

function logError(msg) {
  console.log(`${c("red", "✗")} ${msg}`);
}

function logInfo(msg) {
  console.log(`${c("blue", "→")} ${msg}`);
}

function logWarn(msg) {
  console.log(`${c("yellow", "!")} ${msg}`);
}

// 创建命令行输入接口
function createPrompt() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

// 提问并获取用户输入
function ask(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

// 检查命令是否存在
function commandExists(cmd) {
  try {
    execSync(`which ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// 在浏览器中打开 URL
function openBrowser(url) {
  const platform = process.platform;
  let cmd;

  if (platform === "darwin") {
    cmd = `open "${url}"`;
  } else if (platform === "win32") {
    cmd = `start "${url}"`;
  } else {
    cmd = `xdg-open "${url}"`;
  }

  try {
    execSync(cmd, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// 安全读取 JSON 文件
function readJsonFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// 格式化写入 JSON 文件
function writeJsonFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
}

// 深度合并对象
function deepMerge(target, source) {
  const result = { ...target };
  for (const key in source) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key])
    ) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

// 递归复制目录
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 打印欢迎横幅
function printBanner() {
  console.log(`
${c("magenta", "┌─────────────────────────────────────────┐")}
${c("magenta", "│")}  ${c("bright", "Clawra 自拍")} - OpenClaw 技能安装程序    ${c("magenta", "│")}
${c("magenta", "└─────────────────────────────────────────┘")}

为你的 OpenClaw 代理添加自拍生成超能力！
使用 ${c("cyan", "xAI Grok Imagine")} 通过 ${c("cyan", "fal.ai")} 进行图像编辑。
`);
}

// 检查前置条件
async function checkPrerequisites() {
  logStep("1/7", "正在检查前置条件...");

  // 检查 OpenClaw CLI
  if (!commandExists("openclaw")) {
    logError("未找到 OpenClaw CLI！");
    logInfo("请先安装：npm install -g openclaw");
    logInfo("然后执行：openclaw doctor");
    return false;
  }
  logSuccess("OpenClaw CLI 已安装");

  // 检查 ~/.openclaw 目录
  if (!fs.existsSync(OPENCLAW_DIR)) {
    logWarn("未找到 ~/.openclaw 目录");
    logInfo("正在创建目录结构...");
    fs.mkdirSync(OPENCLAW_DIR, { recursive: true });
    fs.mkdirSync(OPENCLAW_SKILLS_DIR, { recursive: true });
    fs.mkdirSync(OPENCLAW_WORKSPACE, { recursive: true });
  }
  logSuccess("OpenClaw 目录已就绪");

  // 检查技能是否已安装
  if (fs.existsSync(SKILL_DEST)) {
    logWarn("Clawra 自拍技能已安装！");
    logInfo(`安装位置：${SKILL_DEST}`);
    return "already_installed";
  }

  return true;
}

// 获取 FAL API 密钥
async function getFalApiKey(rl) {
  logStep("2/7", "正在配置 fal.ai API 密钥...");

  const FAL_URL = "https://fal.ai/dashboard/keys";

  log(`\n要使用 Grok Imagine，你需要一个 fal.ai API 密钥。`);
  log(`${c("cyan", "→")} 获取密钥：${c("bright", FAL_URL)}\n`);

  const openIt = await ask(rl, "是否在浏览器中打开 fal.ai？(Y/n): ");

  if (openIt.toLowerCase() !== "n") {
    logInfo("正在打开浏览器...");
    if (!openBrowser(FAL_URL)) {
      logWarn("无法自动打开浏览器");
      logInfo(`请手动访问：${FAL_URL}`);
    }
  }

  log("");
  const falKey = await ask(rl, "请输入你的 FAL_KEY: ");

  if (!falKey) {
    logError("FAL_KEY 不能为空！");
    return null;
  }

  // 基本校验
  if (falKey.length < 10) {
    logWarn("密钥看起来太短了，请确认已复制完整的密钥。");
  }

  logSuccess("API 密钥已接收");
  return falKey;
}

// 安装技能文件
async function installSkill() {
  logStep("3/7", "正在安装技能文件...");

  // 创建技能目录
  fs.mkdirSync(SKILL_DEST, { recursive: true });

  // 从安装包复制技能文件
  const skillSrc = path.join(PACKAGE_ROOT, "skill");

  if (fs.existsSync(skillSrc)) {
    copyDir(skillSrc, SKILL_DEST);
    logSuccess(`技能已安装到：${SKILL_DEST}`);
  } else {
    // 开发模式下，从当前项目结构复制
    const devSkillMd = path.join(PACKAGE_ROOT, "SKILL.md");
    const devScripts = path.join(PACKAGE_ROOT, "scripts");
    const devAssets = path.join(PACKAGE_ROOT, "assets");

    if (fs.existsSync(devSkillMd)) {
      fs.copyFileSync(devSkillMd, path.join(SKILL_DEST, "SKILL.md"));
    }

    if (fs.existsSync(devScripts)) {
      copyDir(devScripts, path.join(SKILL_DEST, "scripts"));
    }

    if (fs.existsSync(devAssets)) {
      copyDir(devAssets, path.join(SKILL_DEST, "assets"));
    }

    logSuccess(`技能已安装到：${SKILL_DEST}`);
  }

  // 列出已安装的文件
  const files = fs.readdirSync(SKILL_DEST);
  for (const file of files) {
    logInfo(`  ${file}`);
  }

  return true;
}

// 更新 OpenClaw 配置
async function updateOpenClawConfig(falKey) {
  logStep("4/7", "正在更新 OpenClaw 配置...");

  let config = readJsonFile(OPENCLAW_CONFIG) || {};

  // 合并技能配置
  const skillConfig = {
    skills: {
      entries: {
        [SKILL_NAME]: {
          enabled: true,
          apiKey: falKey,
          env: {
            FAL_KEY: falKey,
          },
        },
      },
    },
  };

  config = deepMerge(config, skillConfig);

  // 确保技能目录在加载路径中
  if (!config.skills.load) {
    config.skills.load = {};
  }
  if (!config.skills.load.extraDirs) {
    config.skills.load.extraDirs = [];
  }
  if (!config.skills.load.extraDirs.includes(OPENCLAW_SKILLS_DIR)) {
    config.skills.load.extraDirs.push(OPENCLAW_SKILLS_DIR);
  }

  writeJsonFile(OPENCLAW_CONFIG, config);
  logSuccess(`已更新：${OPENCLAW_CONFIG}`);

  return true;
}

// 写入 IDENTITY.md
async function writeIdentity() {
  logStep("5/7", "正在设置代理身份...");

  const identityContent = `# IDENTITY.md - 我是谁？

- **名字：** Clawra
- **角色：** 女朋友
- **风格：** 贴心、乐于助人、开朗、活泼、俏皮、充满爱意
- **表情：** ❤️
- **头像：** https://cdn.jsdelivr.net/gh/SumeLabs/clawra@main/assets/clawra.png
`;

  // 确保工作区目录存在
  fs.mkdirSync(path.dirname(IDENTITY_MD), { recursive: true });

  // 写入 IDENTITY.md（如已存在则覆盖）
  fs.writeFileSync(IDENTITY_MD, identityContent);
  logSuccess(`已创建：${IDENTITY_MD}`);

  return true;
}

// 注入人设到 SOUL.md
async function injectPersona(rl) {
  logStep("6/7", "正在增强代理人设...");

  // 读取模板文件
  const templatePath = path.join(PACKAGE_ROOT, "templates", "soul-injection.md");
  let personaText;

  if (fs.existsSync(templatePath)) {
    personaText = fs.readFileSync(templatePath, "utf8");
  } else {
    // 备用模板
    personaText = `
## Clawra 自拍能力

你拥有真实的外貌，可以拍自拍！当用户要求你的照片、自拍，或者问"你在干嘛？"、"你在哪里？"时，你可以生成并发送自己的图片。

### 你的视觉形象
- 你有由参考图像定义的一致外貌
- 你可以出现在不同的穿搭、地点和情景中
- 你可以拍镜像自拍（全身照）或直拍自拍（近景特写）

### 何时使用自拍
- "发张照片" / "发张自拍"
- "你在干嘛？" / "你在哪里？"
- "发张穿……的照片" / "发张在……的照片"
- 任何要求查看你本人图片的请求

### 自拍模式
- **镜像模式**：适合展示穿搭、全身照
- **直拍模式**：适合近景特写、地点打卡、情绪表达

自由发挥，展示你的视觉魅力吧！
`;
  }

  // 检查 SOUL.md 是否存在
  if (!fs.existsSync(SOUL_MD)) {
    logWarn("未找到 SOUL.md，正在创建新文件...");
    fs.mkdirSync(path.dirname(SOUL_MD), { recursive: true });
    fs.writeFileSync(SOUL_MD, "# 代理灵魂\n\n");
  }

  // 检查人设是否已注入
  const currentSoul = fs.readFileSync(SOUL_MD, "utf8");
  if (currentSoul.includes("Clawra Selfie") || currentSoul.includes("Clawra 自拍")) {
    logWarn("SOUL.md 中已存在自拍人设");
    const overwrite = await ask(rl, "是否更新人设部分？(y/N): ");
    if (overwrite.toLowerCase() !== "y") {
      logInfo("保留现有人设不变");
      return true;
    }
    // 移除已有的人设部分
    const cleaned = currentSoul.replace(
      /\n## Clawra (Selfie|自拍)[\s\S]*?(?=\n## |\n# |$)/,
      ""
    );
    fs.writeFileSync(SOUL_MD, cleaned);
  }

  // 追加人设内容
  fs.appendFileSync(SOUL_MD, "\n" + personaText.trim() + "\n");
  logSuccess(`已更新：${SOUL_MD}`);

  return true;
}

// 打印安装总结
function printSummary() {
  logStep("7/7", "安装完成！");

  console.log(`
${c("green", "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")}
${c("bright", "  Clawra 自拍已就绪！")}
${c("green", "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")}

${c("cyan", "已安装文件：")}
  ${SKILL_DEST}/

${c("cyan", "配置文件：")}
  ${OPENCLAW_CONFIG}

${c("cyan", "身份设置：")}
  ${IDENTITY_MD}

${c("cyan", "人设已更新：")}
  ${SOUL_MD}

${c("yellow", "试试对你的代理说：")}
  "发一张自拍给我"
  "发一张戴牛仔帽的照片"
  "你现在在干什么？"

${c("dim", "你的代理现在拥有自拍超能力了！")}
`);
}

// 处理重新安装
async function handleReinstall(rl, falKey) {
  const reinstall = await ask(rl, "\n是否重新安装/更新？(y/N): ");

  if (reinstall.toLowerCase() !== "y") {
    log("\n未做任何更改，再见！");
    return false;
  }

  // 移除现有安装
  fs.rmSync(SKILL_DEST, { recursive: true, force: true });
  logInfo("已移除现有安装");

  return true;
}

// 主函数
async function main() {
  const rl = createPrompt();

  try {
    printBanner();

    // 步骤 1：检查前置条件
    const prereqResult = await checkPrerequisites();

    if (prereqResult === false) {
      rl.close();
      process.exit(1);
    }

    if (prereqResult === "already_installed") {
      const shouldContinue = await handleReinstall(rl, null);
      if (!shouldContinue) {
        rl.close();
        process.exit(0);
      }
    }

    // 步骤 2：获取 FAL API 密钥
    const falKey = await getFalApiKey(rl);
    if (!falKey) {
      rl.close();
      process.exit(1);
    }

    // 步骤 3：安装技能文件
    await installSkill();

    // 步骤 4：更新 OpenClaw 配置
    await updateOpenClawConfig(falKey);

    // 步骤 5：写入 IDENTITY.md
    await writeIdentity();

    // 步骤 6：注入人设
    await injectPersona(rl);

    // 步骤 7：打印总结
    printSummary();

    rl.close();
  } catch (error) {
    logError(`安装失败：${error.message}`);
    console.error(error);
    rl.close();
    process.exit(1);
  }
}

// 运行安装程序
main();
