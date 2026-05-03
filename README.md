# AI Doctor — 智能健康助手

保险公司健康服务场景下的 AI 健康顾问，面向保险用户提供症状分析、医疗资源导航和健康权益管理。

## 功能

### AI 健康问诊
- 基于 OpenRouter（Gemini 模型）的流式对话，实时输出回复
- 症状智能分级分诊（自我护理 / 建议线上问诊 / 建议到院就医），并推荐科室
- 支持图片上传，AI 分析皮肤、伤口等可视症状
- 每次回复末尾附带 3 条追问建议，引导深入对话
- 多语言支持（简体中文 / 繁體中文 / English），自动匹配用户输入语言

### 保险权益管理
- 展示用户保险健康权益：在线问诊、线下门诊预约、高端体检、健康测评、心理咨询
- 显示每项权益的总次数、已用次数、有效期及使用记录
- AI 对话中可内联触发权益卡片，按需呈现相关权益状态

### 医生预约
- 医生列表，含专科、医院、评分、从业年限、匹配度评分
- 医生详情页：多维评分（专业度 / 服务 / 经验 / 治疗效果）、患者评价、预约时间段
- 支持图文问诊 / 视频问诊两种模式

### 医疗机构搜索
- 机构列表 + 地图双视图，支持按距离、类型（公立 / 私立 / 连锁）和可预约时间筛选
- 每家机构展示评分、营业时间、电话、电子报告支持情况及用户评价

### 运营监控
- 访客实时通知（飞书 webhook），新 IP 访问时推送设备与来源信息
- 每小时访问统计报告，包含独立 IP 数和访问明细
- 服务健康监测（`monitor.sh`），检测到宕机自动重启并告警

## 技术栈

- **前端**：React + TypeScript + Vite + Tailwind CSS + Framer Motion
- **后端**：Node.js + Express，代理 OpenRouter API（SSE 流式转发）
- **部署**：PM2 进程管理，Alibaba Cloud ECS，`deploy.sh` 一键构建上传

## 本地运行

**前提**：Node.js

```bash
npm install
cp .env.example .env   # 填入各项配置
npm run dev
```

## 环境变量

参考 `.env.example`：

| 变量 | 说明 |
|------|------|
| `OPENROUTER_API_KEY` | OpenRouter API 密钥 |
| `FEISHU_WEBHOOK` | 飞书机器人 Webhook URL（访客通知 & 监控告警） |
| `APP_SERVER_IP` | 生产服务器 IP（健康检查白名单） |
| `APP_SERVER_URL` | 生产服务器完整 URL |
| `APP_URL` | 本地或部署后的应用地址 |

## 部署

```bash
# 传入服务器 IP、用户名和 SSH 密钥路径
./deploy.sh <SERVER_IP> <USER> <SSH_KEY_PATH>

# 或通过环境变量设置默认值
export APP_SERVER_IP=your_server_ip
export DEPLOY_SSH_KEY_PATH=~/.ssh/your_key.pem
./deploy.sh
```
