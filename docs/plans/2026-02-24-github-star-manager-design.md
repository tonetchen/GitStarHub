# GitHub Star Manager 设计文档

## 项目概述

一个用于管理 GitHub Stars 的 Web 应用，提供智能搜索和更新追踪功能。

### 核心功能

1. **GitHub OAuth 登录** - 用户通过 GitHub 账号登录
2. **Stars 展示** - 展示用户所有 starred 仓库
3. **AI 智能搜索** - 通过自然语言搜索符合场景的仓库
4. **更新追踪** - 展示 starred 仓库的最近更新（commits、issues、PRs）
5. **自动同步** - 定时同步 GitHub 数据

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 14 (App Router) |
| 语言 | TypeScript |
| UI | shadcn/ui + Tailwind CSS |
| 数据库 | Vercel Postgres |
| AI | Vercel AI SDK (支持 OpenAI 兼容 API) |
| 认证 | NextAuth.js (GitHub OAuth) |
| 部署 | Vercel |

## 架构设计

### 整体架构

```
用户浏览器
    ↓
Vercel Edge Network (静态页面 ISR)
    ↓
Next.js API Routes (Serverless)
    ↓
Vercel Postgres Database
    ↓
GitHub API
```

### 数据同步机制

- **Vercel Cron Jobs** 每小时检查一次
- **用户可配置**同步频率（1/2/6/12/24小时）
- **串行同步**避免触发 GitHub API 限速

## 数据库设计

### 表结构

```sql
-- 用户表
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  github_id INTEGER UNIQUE NOT NULL,
  username VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  access_token TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Star 仓库表
CREATE TABLE starred_repositories (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  github_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  description TEXT,
  html_url TEXT NOT NULL,
  language VARCHAR(100),
  stargazers_count INTEGER DEFAULT 0,
  topics TEXT[],
  owner_avatar_url TEXT,
  last_synced_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, github_id)
);

-- 仓库更新记录表
CREATE TABLE repository_updates (
  id SERIAL PRIMARY KEY,
  repository_id INTEGER REFERENCES starred_repositories(id) ON DELETE CASCADE,
  update_type VARCHAR(50) NOT NULL,
  title VARCHAR(500),
  description TEXT,
  url TEXT,
  author VARCHAR(255),
  created_at_github TIMESTAMP,
  fetched_at TIMESTAMP DEFAULT NOW()
);

-- 同步配置表
CREATE TABLE user_sync_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE REFERENCES users(id),
  sync_enabled BOOLEAN DEFAULT true,
  sync_interval INTEGER DEFAULT 2,
  last_sync_at TIMESTAMP,
  next_sync_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- AI 模型配置表
CREATE TABLE user_ai_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE REFERENCES users(id),
  model_name VARCHAR(100) DEFAULT 'glm-4',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 索引

```sql
CREATE INDEX idx_starred_repos_user ON starred_repositories(user_id);
CREATE INDEX idx_updates_time ON repository_updates(created_at_github DESC);
CREATE INDEX idx_updates_type ON repository_updates(update_type);
CREATE INDEX idx_sync_next ON user_sync_settings(next_sync_at);
```

## API 设计

### 认证

- `GET /api/auth/[...nextauth]` - GitHub OAuth

### 数据同步

- `GET /api/sync-check` - Cron 定时检查（每小时）
- `POST /api/sync/manual` - 手动触发同步

### 仓库

- `GET /api/repositories` - 获取仓库列表
- `GET /api/repositories/[id]` - 获取仓库详情

### 更新

- `GET /api/updates` - 获取更新记录

### AI 搜索

- `POST /api/ai-search` - AI 智能搜索（流式响应）

### 设置

- `GET /api/settings/sync` - 获取同步设置
- `PUT /api/settings/sync` - 更新同步设置
- `GET /api/settings/ai` - 获取 AI 设置
- `PUT /api/settings/ai` - 更新 AI 设置

## 页面设计

### 页面结构

1. **登录页** `/login` - GitHub OAuth 登录
2. **首页** `/` - AI 搜索 + 统计 + 仓库列表
3. **更新页** `/updates` - 最近更新列表
4. **详情页** `/repositories/[id]` - 仓库详情
5. **设置页** `/settings` - 同步配置 + AI 模型配置

### 统计卡片

- 本周活跃仓库（近7天有更新）
- 今日更新（条新动态）
- 上次同步（数据已同步）

## AI 配置

### 后端环境变量

```bash
OPENAI_API_KEY=your_glm_api_key
OPENAI_BASE_URL=https://open.bigmodel.cn/api/paas/v4

GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret

NEXTAUTH_SECRET=your_random_secret
NEXTAUTH_URL=http://localhost:3000

CRON_SECRET=your_cron_secret
```

### 用户配置

- 模型名称（如 `glm-4`、`gpt-3.5-turbo`）

## 部署配置

### Vercel Cron

```json
{
  "crons": [
    {
      "path": "/api/sync-check",
      "schedule": "0 * * * *"
    }
  ]
}
```

## 项目结构

```
app/
├── (auth)/
│   ├── login/page.tsx
│   └── layout.tsx
├── (dashboard)/
│   ├── page.tsx
│   ├── repositories/[id]/page.tsx
│   ├── updates/page.tsx
│   ├── settings/page.tsx
│   └── layout.tsx
├── api/
│   ├── auth/[...nextauth]/route.ts
│   ├── sync-check/route.ts
│   ├── sync/manual/route.ts
│   ├── repositories/route.ts
│   ├── repositories/[id]/route.ts
│   ├── updates/route.ts
│   ├── ai-search/route.ts
│   └── settings/
│       ├── sync/route.ts
│       └── ai/route.ts
├── lib/
│   ├── db.ts
│   ├── github.ts
│   ├── ai.ts
│   └── auth.ts
├── components/
│   ├── ui/
│   ├── RepositoryCard.tsx
│   ├── UpdateItem.tsx
│   └── SearchBox.tsx
└── types/index.ts
```

## 实施计划

详见 `writing-plans` skill 生成的实施计划。
