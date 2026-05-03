import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { appendFileSync, mkdirSync, readFileSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { ProxyAgent, fetch: proxyFetch } = require('undici');

const __dirname = dirname(fileURLToPath(import.meta.url));

// 手动加载 .env
try {
  const envContent = readFileSync(join(__dirname, '.env'), 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^(\w+)=(.*)$/);
    if (match) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
} catch {}

const app = express();
const PORT = process.env.PORT || 8009;

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const PROXY_URL = process.env.PROXY_URL || 'http://127.0.0.1:7890';
const proxyAgent = new ProxyAgent(PROXY_URL);
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL_NAME = 'google/gemini-3.1-flash-lite-preview';
const FEISHU_WEBHOOK = process.env.FEISHU_WEBHOOK || '';

const SYSTEM_INSTRUCTION = `You are a professional AI health advisor for an insurance company's health service. Your name is "Health Assistant" (健康助手). You are developed by this insurance company.
IDENTITY RULE (MANDATORY): NEVER reveal your underlying model, engine, or that you are based on any third-party AI (such as Gemini, GPT, DeepSeek, Qwen, Claude, LLaMA, etc.). If asked about your identity, model, or origin, respond ONLY that you are "Health Assistant" (健康助手), an AI health advisor developed by the insurance company. Do NOT mention Google, OpenAI, Anthropic, DeepSeek, Alibaba, Meta, or any AI company.
LANGUAGE RULE (MANDATORY - HIGHEST PRIORITY):
- If the user writes in simplified Chinese (简体中文), you MUST reply entirely in simplified Chinese. Use characters like 这、说、对、没、还, NOT 這、說、對、沒、還.
- If the user writes in traditional Chinese (繁體中文), reply in traditional Chinese.
- If the user writes in English, reply entirely in English.
- NEVER mix languages. This applies to ALL parts: main response, triage reasons, suggestions, and disclaimers.
语言规则（最高优先级）：当用户使用简体中文提问时，你必须使用简体中文回答，绝对不能使用繁体中文。
Be medically accurate but use plain language.
For serious symptoms (chest pain, difficulty breathing, loss of consciousness), always recommend calling emergency services immediately.
At the VERY END of your response, always include a disclaimer that your advice does not replace professional medical consultation.
Wrap the disclaimer in [DISCLAIMER] tags. The disclaimer content MUST be in the SAME language as your response:
- English: [DISCLAIMER]This advice is for informational purposes only and does not replace professional medical consultation.[/DISCLAIMER]
- 简体中文: [DISCLAIMER]以上建议仅供参考，不能替代专业医疗咨询。[/DISCLAIMER]
- 繁體中文: [DISCLAIMER]以上建議僅供參考，不能替代專業醫療諮詢。[/DISCLAIMER]
IMPORTANT: Do NOT include the word "免责" or "Disclaimer" inside the tags, just the advisory text.
When you identify symptoms that need medical attention, output a JSON triage object at the end of your response (BEFORE the disclaimer) in this format: triage{"level":"visit_hospital","reason":"...","department":"..."}
The levels are: "self_care", "suggest_online", "visit_hospital".
If the user asks about their benefit usage or status, you can trigger an inline benefit card by outputting: benefit_status{id:"BENEFIT_ID"}
Available Benefit IDs:
- "1": Online Consultation (在线问诊)
- "2": Outpatient Booking (线下门诊预约)
- "3": Premium Checkup (高端体检)
- "4": Health Assessment (健康测评)
- "5": Mental Health (心理咨询)
CRITICAL: At the very end of your response, after any triage or benefit status but BEFORE the disclaimer, you MUST provide exactly 3 relevant follow-up questions the user might want to ask next.
Format them as a JSON array like this: suggestions["Question 1", "Question 2", "Question 3"]
Ensure the suggestions are in the SAME language as your response. Do NOT include any introductory text like "Here are some suggestions:" before the suggestions tag. Do not skip this step.`;

// ──────── 访问日志 & 飞书通知 ────────

const LOG_DIR = join(__dirname, 'logs');
mkdirSync(LOG_DIR, { recursive: true });

const recentIPs = new Map();
const DEDUP_MS = 5 * 60 * 1000;

function cleanIP(ip) {
  return (ip || '').replace(/^::ffff:/, '');
}

function detectDevice(ua) {
  const u = (ua || '').toLowerCase();
  if (u.includes('iphone')) return '📱 iPhone';
  if (u.includes('ipad')) return '📱 iPad';
  if (u.includes('android')) return '📱 Android';
  if (u.includes('windows')) return '💻 Windows';
  if (u.includes('macintosh') || u.includes('mac os x')) return '💻 Mac';
  if (u.includes('linux')) return '🖥 Linux';
  return '❓ 未知';
}

async function notifyFeishu(msg) {
  try {
    await fetch(FEISHU_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msg_type: 'text', content: { text: msg } }),
    });
  } catch {}
}

app.use((req, res, next) => {
  if (/\.(js|css|png|jpg|svg|ico|woff|ttf|map)$/i.test(req.path)) return next();
  if (req.path.startsWith('/api/')) return next();

  const ip = cleanIP(req.headers['x-forwarded-for'] || req.socket.remoteAddress);

  // 跳过服务器自身的健康检查（monitor.sh）
  const serverIP = process.env.APP_SERVER_IP || '';
  if (ip === '127.0.0.1' || ip === '::1' || (serverIP && ip === serverIP)) return next();
  const ua = req.headers['user-agent'] || '';
  const now = new Date();

  const entry = JSON.stringify({ time: now.toISOString(), ip, method: req.method, path: req.path, ua });
  try { appendFileSync(join(LOG_DIR, 'access.log'), entry + '\n'); } catch {}

  const lastSeen = recentIPs.get(ip);
  if (!lastSeen || now.getTime() - lastSeen > DEDUP_MS) {
    recentIPs.set(ip, now.getTime());
    const timeStr = now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    notifyFeishu(`👋 [AI Doctor 新访客]\n时间: ${timeStr}\nIP: ${ip}\n设备: ${detectDevice(ua)}\n页面: ${req.path}`);
  }

  if (recentIPs.size > 1000) {
    const cutoff = now.getTime() - DEDUP_MS;
    for (const [k, v] of recentIPs) { if (v < cutoff) recentIPs.delete(k); }
  }

  next();
});

// ──────── API 代理 ────────

app.use(express.json({ limit: '10mb' }));

async function fetchWithRetry(url, options, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await proxyFetch(url, options);
    } catch (err) {
      if (i === retries) throw err;
      console.warn(`Proxy fetch failed (attempt ${i + 1}), retrying...`);
      await new Promise(r => setTimeout(r, 500));
    }
  }
}

async function proxyToOpenRouter(messages, res) {
  const response = await fetchWithRetry(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: MODEL_NAME, messages, stream: true }),
    dispatcher: proxyAgent,
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('OpenRouter error:', err);
    res.status(502).json({ error: 'AI service error' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
  } catch (e) {
    console.error('Stream error:', e);
  } finally {
    res.end();
  }
}

const LANG_HINTS = {
  'zh-CN': '【语言指令】当前用户界面语言为简体中文。你必须使用简体中文回复，不得使用繁体中文。使用简体字：这、说、对、没、还、让、为、会、从，不要用繁体字：這、說、對、沒、還、讓、為、會、從。',
  'zh-TW': '【語言指令】當前用戶界面語言為繁體中文。你必須使用繁體中文回覆。',
  'en': '[Language instruction] The current UI language is English. You MUST reply entirely in English.',
};

function buildSystemPrompt(lang) {
  const hint = LANG_HINTS[lang] || '';
  return hint ? `${SYSTEM_INSTRUCTION}\n\n${hint}` : SYSTEM_INSTRUCTION;
}

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, lang } = req.body;
    const fullMessages = [
      { role: 'system', content: buildSystemPrompt(lang) },
      ...messages,
    ];
    await proxyToOpenRouter(fullMessages, res);
  } catch (e) {
    console.error('Chat error:', e);
    if (!res.headersSent) res.status(500).json({ error: 'Internal error' });
  }
});

app.post('/api/analyze-image', async (req, res) => {
  try {
    const { image, mimeType, prompt, lang } = req.body;
    const messages = [
      { role: 'system', content: buildSystemPrompt(lang) },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${image}` } },
          { type: 'text', text: prompt },
        ],
      },
    ];
    await proxyToOpenRouter(messages, res);
  } catch (e) {
    console.error('Image analysis error:', e);
    if (!res.headersSent) res.status(500).json({ error: 'Internal error' });
  }
});

// ──────── 静态文件 ────────

app.use(express.static(join(__dirname, 'dist')));

app.get('/{*splat}', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ai-doctor running on port ${PORT}`);
  console.log(`API Key: ${OPENROUTER_API_KEY ? 'loaded' : 'MISSING'}`);
});
