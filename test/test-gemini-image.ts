/**
 * 测试 DeerAPI gemini-3-pro-image 模型生成知识点卡通图片
 *
 * 用法: npx tsx test/test-gemini-image.ts
 */

import OpenAI from "openai";
import fs from "fs";
import path from "path";

const API_KEY = process.env.DEER_API_KEY || "YOUR_API_KEY_HERE";
const BASE_URL = "https://api.deerapi.com/v1";
const MODEL = "gemini-3-pro-image";

async function main() {
  const openai = new OpenAI({
    apiKey: API_KEY,
    baseURL: BASE_URL,
  });

  console.log("正在调用 DeerAPI gemini-3-pro-image 模型...");
  console.log(`模型: ${MODEL}`);
  console.log(`请求: 生成 Go 语言知识点卡通图片 (4K)`);
  console.log("---");

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "user",
        content:
          "请用中文介绍Go语言的核心特性（并发、goroutine、channel），并生成一张4K分辨率的可爱卡通风格知识点图片，图片中包含Go语言的吉祥物Gopher，配上中文标注的关键知识点，色彩明亮活泼，适合学生学习。",
      },
    ],
  });

  console.log("API 响应成功!");
  console.log("---");

  const choice = response.choices[0];
  const message = choice.message;

  // 输出文本内容
  if (message.content) {
    console.log("文本内容:");
    console.log(message.content);
    console.log("---");
  }

  // 检查是否有图片返回 (base64 in content parts or url)
  // Gemini image model 可能通过不同方式返回图片
  // 方式1: message.content 中包含 base64 图片数据
  // 方式2: 自定义字段

  // 打印完整响应结构以便调试
  console.log("完整响应结构 (choices[0].message keys):");
  console.log(Object.keys(message));

  // 检查是否存在图片 URL 或 base64 数据
  const fullMessage = message as unknown as Record<string, unknown>;

  // 尝试从各种可能的字段提取图片
  const possibleImageFields = ["image", "images", "image_url", "media", "attachments"];
  for (const field of possibleImageFields) {
    if (fullMessage[field]) {
      console.log(`发现图片字段 [${field}]:`, typeof fullMessage[field]);
      console.log(JSON.stringify(fullMessage[field]).slice(0, 200) + "...");
    }
  }

  // 如果 content 中包含 base64 图片数据 (data:image 开头)
  if (message.content) {
    const base64Match = message.content.match(/data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)/);
    if (base64Match) {
      const ext = base64Match[1];
      const base64Data = base64Match[2];
      const outputPath = path.join(__dirname, `go-knowledge.${ext}`);
      fs.writeFileSync(outputPath, Buffer.from(base64Data, "base64"));
      console.log(`图片已保存到: ${outputPath}`);
    }

    // 检查 markdown 图片链接
    const urlMatch = message.content.match(/!\[.*?\]\((https?:\/\/[^\)]+)\)/);
    if (urlMatch) {
      console.log(`发现图片 URL: ${urlMatch[1]}`);
    }
  }

  // 打印原始 JSON (截取) 以便分析
  const rawJson = JSON.stringify(response, null, 2);
  const outputJsonPath = path.join(__dirname, "response-debug.json");
  fs.writeFileSync(outputJsonPath, rawJson);
  console.log(`完整响应已保存到: ${outputJsonPath}`);
  console.log(`响应大小: ${(rawJson.length / 1024).toFixed(1)} KB`);
}

main().catch((err) => {
  console.error("请求失败:", err.message);
  if (err.response) {
    console.error("HTTP 状态:", err.response.status);
    console.error("响应体:", err.response.data);
  }
  process.exit(1);
});
