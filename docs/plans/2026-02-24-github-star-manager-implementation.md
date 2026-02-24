# GitHub Star Manager Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 构建一个 GitHub Stars 管理应用，支持 OAuth 登录、AI 智能搜索和自动更新同步。

**Architecture:** Next.js 14 App Router + Vercel Postgres + Vercel AI SDK。使用 Vercel Cron 定时同步 GitHub 数据，用户可配置同步频率。AI 搜索使用 OpenAI 兼容 API（支持 GLM）。

**Tech Stack:** Next.js 14, TypeScript, shadcn/ui, Tailwind CSS, Vercel Postgres, Vercel AI SDK, NextAuth.js

---

## 初始化项目

### Task 1: 创建 Next.js 项目

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.js`
- Create: `.env.local.example`
- Create: `.gitignore`

**Step 1: 初始化项目**

Run:
```bash
npm create next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*"
```

Expected: Next.js 项目创建成功

**Step 2: 安装依赖**

Run:
```bash
npm install @vercel/postgres ai openai next-auth @auth/prisma-adapter bcryptjs
npm install -D @types/bcryptjs
```

Expected: 依赖安装成功

**Step 3: 安装 shadcn/ui**

Run:
```bash
npx shadcn-ui@latest init -d
```

Expected: shadcn/ui 初始化完成

**Step 4: 安装 shadcn 组件**

Run:
```bash
npx shadcn-ui@latest add card button input badge switch select avatar tabs label
```

Expected: 组件安装到 `components/ui/`

**Step 5: Commit**

```bash
git add .
git commit -m "feat: initialize Next.js project with shadcn/ui"
```

---

### Task 2: 配置数据库

**Files:**
- Create: `lib/db.ts`
- Create: `lib/schema.sql`

**Step 1: 创建数据库配置**

Write `lib/db.ts`:
```typescript
import { sql } from '@vercel/postgres';

export async function getUserById(id: number) {
  const result = await sql`SELECT * FROM users WHERE id = ${id}`;
  return result.rows[0];
}

export async function getUserByGithubId(githubId: number) {
  const result = await sql`SELECT * FROM users WHERE github_id = ${githubId}`;
  return result.rows[0];
}

export async function createUser(user: {
  github_id: number;
  username: string;
  avatar_url: string;
  access_token: string;
}) {
  const result = await sql`
    INSERT INTO users (github_id, username, avatar_url, access_token)
    VALUES (${user.github_id}, ${user.username}, ${user.avatar_url}, ${user.access_token})
    RETURNING *
  `;
  return result.rows[0];
}
```

**Step 2: 创建数据库 Schema**

Write `lib/schema.sql`:
```sql
-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  github_id INTEGER UNIQUE NOT NULL,
  username VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  access_token TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Star 仓库表
CREATE TABLE IF NOT EXISTS starred_repositories (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
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
CREATE TABLE IF NOT EXISTS repository_updates (
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
CREATE TABLE IF NOT EXISTS user_sync_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  sync_enabled BOOLEAN DEFAULT true,
  sync_interval INTEGER DEFAULT 2,
  last_sync_at TIMESTAMP,
  next_sync_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- AI 模型配置表
CREATE TABLE IF NOT EXISTS user_ai_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  model_name VARCHAR(100) DEFAULT 'glm-4',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_starred_repos_user ON starred_repositories(user_id);
CREATE INDEX IF NOT EXISTS idx_updates_time ON repository_updates(created_at_github DESC);
CREATE INDEX IF NOT EXISTS idx_updates_type ON repository_updates(update_type);
CREATE INDEX IF NOT EXISTS idx_sync_next ON user_sync_settings(next_sync_at);
```

**Step 3: 创建环境变量模板**

Write `.env.local.example`:
```bash
# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# NextAuth
NEXTAUTH_SECRET=your_random_secret
NEXTAUTH_URL=http://localhost:3000

# AI (GLM)
OPENAI_API_KEY=your_glm_api_key
OPENAI_BASE_URL=https://open.bigmodel.cn/api/paas/v4

# Cron
CRON_SECRET=your_cron_secret

# Vercel Postgres
POSTGRES_URL=
POSTGRES_PRISMA_URL=
POSTGRES_URL_NON_POOLING=
```

**Step 4: Commit**

```bash
git add lib/db.ts lib/schema.sql .env.local.example
git commit -m "feat: add database schema and configuration"
```

---

### Task 3: 配置 NextAuth.js GitHub OAuth

**Files:**
- Create: `app/api/auth/[...nextauth]/route.ts`
- Modify: `lib/db.ts`

**Step 1: 创建 NextAuth 配置**

Write `app/api/auth/[...nextauth]/route.ts`:
```typescript
import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"
import { sql } from '@vercel/postgres'

const handler = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'read:user repo'
        }
      }
    })
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!account?.access_token) return false

      // 查找或创建用户
      const existingUser = await sql`
        SELECT * FROM users WHERE github_id = ${user.id}
      `

      if (existingUser.rows[0]) {
        // 更新 token
        await sql`
          UPDATE users
          SET access_token = ${account.access_token}, updated_at = NOW()
          WHERE github_id = ${user.id}
        `
      } else {
        // 创建新用户
        await sql`
          INSERT INTO users (github_id, username, avatar_url, access_token)
          VALUES (${user.id}, ${user.name}, ${user.image}, ${account.access_token})
        `
      }

      // 创建同步设置
      await sql`
        INSERT INTO user_sync_settings (user_id)
        SELECT id FROM users WHERE github_id = ${user.id}
        ON CONFLICT (user_id) DO NOTHING
      `

      // 创建 AI 设置
      await sql`
        INSERT INTO user_ai_settings (user_id)
        SELECT id FROM users WHERE github_id = ${user.id}
        ON CONFLICT (user_id) DO NOTHING
      `

      return true
    },
    async session({ session, user }) {
      if (session.user) {
        const dbUser = await sql`
          SELECT * FROM users WHERE github_id = ${user.id}
        `
        session.user.id = dbUser.rows[0].id
      }
      return session
    }
  }
})

export { handler as GET, handler as POST }
```

**Step 2: Commit**

```bash
git add app/api/auth/[...nextauth]/route.ts
git commit -m "feat: add GitHub OAuth authentication"
```

---

### Task 4: 创建登录页面

**Files:**
- Create: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/layout.tsx`

**Step 1: 创建登录页面**

Write `app/(auth)/login/page.tsx`:
```typescript
'use client'

import { signIn } from 'next-auth/react'
import { Github } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">GitHub Star Manager</CardTitle>
          <CardDescription>
            管理你的 GitHub Stars，智能搜索仓库
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full"
            size="lg"
            onClick={() => signIn('github', { callbackUrl: '/' })}
          >
            <Github className="mr-2 h-5 w-5" />
            使用 GitHub 登录
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
```

**Step 2: 创建认证布局**

Write `app/(auth)/layout.tsx`:
```typescript
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
```

**Step 3: Commit**

```bash
git add app/\(auth)/
git commit -m "feat: add login page"
```

---

### Task 5: 创建首页（仓库列表 + AI 搜索）

**Files:**
- Create: `app/(dashboard)/page.tsx`
- Create: `app/(dashboard)/layout.tsx`
- Create: `components/RepositoryCard.tsx`
- Create: `components/SearchBox.tsx`

**Step 1: 创建仓库卡片组件**

Write `components/RepositoryCard.tsx`:
```typescript
'use client'

import Link from 'next/link'
import { Star, Github } from 'lucide-react'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'

interface RepositoryCardProps {
  id: number
  name: string
  fullName: string
  description: string | null
  language: string | null
  stargazersCount: number
  topics: string[] | null
  ownerAvatarUrl: string | null
}

export function RepositoryCard({
  id,
  name,
  fullName,
  description,
  language,
  stargazersCount,
  topics,
  ownerAvatarUrl,
}: RepositoryCardProps) {
  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toString()
  }

  const languageColors: Record<string, string> = {
    JavaScript: 'bg-yellow-400',
    TypeScript: 'bg-blue-400',
    Python: 'bg-green-400',
    Go: 'bg-cyan-400',
    Rust: 'bg-orange-400',
    Java: 'bg-red-400',
    Ruby: 'bg-red-500',
  }

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-center gap-2">
          {ownerAvatarUrl && (
            <img src={ownerAvatarUrl} alt="" className="w-6 h-6 rounded" />
          )}
          <CardTitle className="text-lg">{name}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
          {description || 'No description'}
        </p>

        <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
          {language && (
            <span className="flex items-center gap-1">
              <span className={`w-3 h-3 rounded-full ${languageColors[language] || 'bg-gray-400'}`} />
              {language}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Star className="w-4 h-4" />
            {formatNumber(stargazersCount)}
          </span>
        </div>

        {topics && topics.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {topics.slice(0, 3).map(topic => (
              <Badge key={topic} variant="secondary">{topic}</Badge>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Link href={`/repositories/${id}`} className="w-full">
          <Button variant="outline" className="w-full">查看详情</Button>
        </Link>
      </CardFooter>
    </Card>
  )
}
```

**Step 2: 创建搜索框组件**

Write `components/SearchBox.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface SearchBoxProps {
  onSearch: (query: string) => void
}

export function SearchBox({ onSearch }: SearchBoxProps) {
  const [query, setQuery] = useState('')

  const exampleQueries = [
    'React 状态管理',
    'Node.js 日志框架',
    'Python 数据可视化',
    'TypeScript 工具库',
  ]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      onSearch(query)
    }
  }

  return (
    <Card className="mb-8 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <span>🤖</span> AI 智能搜索
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex gap-3 mb-4">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="例如：帮我找 React 状态管理的仓库"
            className="flex-1"
          />
          <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
            <Search className="w-4 h-4 mr-2" />
            搜索
          </Button>
        </form>

        <div>
          <span className="text-sm text-gray-500 mr-2">试试：</span>
          <div className="flex flex-wrap gap-2 mt-2">
            {exampleQueries.map(q => (
              <Badge
                key={q}
                variant="secondary"
                className="cursor-pointer hover:bg-blue-100 hover:text-blue-700"
                onClick={() => {
                  setQuery(q)
                  onSearch(q)
                }}
              >
                {q}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
```

**Step 3: 创建首页**

Write `app/(dashboard)/page.tsx`:
```typescript
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SearchBox } from '@/components/SearchBox'
import { RepositoryCard } from '@/components/RepositoryCard'
import { Card } from '@/components/ui/card'
import { sql } from '@vercel/postgres'

export default async function HomePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect('/login')
  }

  // 获取统计信息
  const [stats, repositories] = await Promise.all([
    sql`
      SELECT
        (SELECT COUNT(*) FROM starred_repositories WHERE user_id = ${session.user.id}) as total,
        (SELECT COUNT(*) FROM repository_updates
         WHERE repository_id IN (
           SELECT id FROM starred_repositories WHERE user_id = ${session.user.id}
         )
         AND fetched_at > NOW() - INTERVAL '7 days'
        ) as active_week,
        (SELECT COUNT(*) FROM repository_updates
         WHERE repository_id IN (
           SELECT id FROM starred_repositories WHERE user_id = ${session.user.id}
         )
         AND DATE(fetched_at) = CURRENT_DATE
        ) as today_updates,
        (SELECT last_sync_at FROM user_sync_settings WHERE user_id = ${session.user.id}) as last_sync
    `,
    sql`
      SELECT * FROM starred_repositories
      WHERE user_id = ${session.user.id}
      ORDER BY created_at DESC
      LIMIT 20
    `,
  ])

  return (
    <div className="container mx-auto px-4 py-8">
      <SearchBox onSearch={(query) => console.log('Search:', query)} />

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="p-6">
          <div className="text-sm text-gray-500 mb-1">本周活跃仓库</div>
          <div className="text-3xl font-bold">{stats.rows[0].active_week}</div>
          <div className="text-xs text-gray-400 mt-1">近7天有更新</div>
        </Card>
        <Card className="p-6">
          <div className="text-sm text-gray-500 mb-1">今日更新</div>
          <div className="text-3xl font-bold">{stats.rows[0].today_updates}</div>
          <div className="text-xs text-gray-400 mt-1">条新动态</div>
        </Card>
        <Card className="p-6">
          <div className="text-sm text-gray-500 mb-1">上次同步</div>
          <div className="text-lg font-semibold">
            {stats.rows[0].last_sync
              ? new Date(stats.rows[0].last_sync).toLocaleString('zh-CN')
              : '从未同步'}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {stats.rows[0].last_sync ? '数据已同步' : '点击设置开始同步'}
          </div>
        </Card>
      </div>

      {/* 仓库列表 */}
      <h2 className="text-xl font-bold mb-4">我的 Stars</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {repositories.rows.map((repo: any) => (
          <RepositoryCard
            key={repo.id}
            id={repo.id}
            name={repo.name}
            fullName={repo.full_name}
            description={repo.description}
            language={repo.language}
            stargazersCount={repo.stargazers_count}
            topics={repo.topics}
            ownerAvatarUrl={repo.owner_avatar_url}
          />
        ))}
      </div>
    </div>
  )
}
```

**Step 4: 创建仪表板布局**

Write `app/(dashboard)/layout.tsx`:
```typescript
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <nav className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="container mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">GitHub Star Manager</h1>
          <div className="flex items-center gap-4">
            <a href="/" className="text-sm text-gray-600 hover:text-gray-900">首页</a>
            <a href="/updates" className="text-sm text-gray-600 hover:text-gray-900">最近更新</a>
            <a href="/settings" className="text-sm text-gray-600 hover:text-gray-900">设置</a>
            <span className="text-sm text-gray-500">|</span>
            <span className="text-sm text-gray-600">{session.user.name}</span>
          </div>
        </div>
      </nav>
      {children}
    </div>
  )
}
```

**Step 5: 创建 Auth 配置**

Write `lib/auth.ts`:
```typescript
import { authOptions } from 'next-auth'
import { NextAuthOptions } from 'next-auth'

export const authOptions: NextAuthOptions = {
  providers: [
    {
      id: 'github',
      name: 'GitHub',
      type: 'oauth',
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: { scope: 'read:user repo' }
      }
    }
  ],
  session: { strategy: 'jwt' },
}
```

**Step 6: Commit**

```bash
git add components/ app/\(dashboard)/ lib/auth.ts
git commit -m "feat: add homepage with repository list and search box"
```

---

### Task 6: 实现 GitHub API 封装

**Files:**
- Create: `lib/github.ts`

**Step 1: 创建 GitHub API 客户端**

Write `lib/github.ts`:
```typescript
export class GitHubClient {
  private token: string
  private baseUrl = 'https://api.github.com'

  constructor(token: string) {
    this.token = token
  }

  private async fetch(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`)
    }

    return response.json()
  }

  async getStarredRepos(page = 1, perPage = 100) {
    return this.fetch(`/user/starred?page=${page}&per_page=${perPage}`)
  }

  async getAllStarredRepos() {
    const repos = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      const pageRepos = await this.getStarredRepos(page)
      repos.push(...pageRepos)
      hasMore = pageRepos.length === 100
      page++
    }

    return repos
  }

  async getRecentCommits(owner: string, repo: string, count = 5) {
    return this.fetch(`/repos/${owner}/${repo}/commits?per_page=${count}`)
  }

  async getRecentIssues(owner: string, repo: string, count = 5) {
    return this.fetch(`/repos/${owner}/${repo}/issues?per_page=${count}&sort=updated`)
  }

  async getRecentPRs(owner: string, repo: string, count = 5) {
    return this.fetch(`/repos/${owner}/${repo}/pulls?per_page=${count}&sort=updated`)
  }
}
```

**Step 2: Commit**

```bash
git add lib/github.ts
git commit -m "feat: add GitHub API client"
```

---

### Task 7: 实现数据同步 API

**Files:**
- Create: `app/api/sync-check/route.ts`
- Create: `app/api/sync/manual/route.ts`
- Modify: `lib/db.ts`

**Step 1: 扩展数据库操作**

Add to `lib/db.ts`:
```typescript
export async function saveRepository(userId: number, repo: any) {
  const [owner, name] = repo.full_name.split('/')
  const topics = repo.topics || []

  const result = await sql`
    INSERT INTO starred_repositories (
      user_id, github_id, name, full_name, description,
      html_url, language, stargazers_count, topics, owner_avatar_url
    )
    VALUES (
      ${userId},
      ${repo.id},
      ${repo.name},
      ${repo.full_name},
      ${repo.description || null},
      ${repo.html_url},
      ${repo.language || null},
      ${repo.stargazers_count || 0},
      ${topics.length > 0 ? topics : null},
      ${repo.owner?.avatar_url || null}
    )
    ON CONFLICT (user_id, github_id)
    DO UPDATE SET
      description = ${repo.description || null},
      stargazers_count = ${repo.stargazers_count || 0},
      topics = ${topics.length > 0 ? topics : null},
      last_synced_at = NOW()
    RETURNING id
  `
  return result.rows[0]
}

export async function saveUpdate(repositoryId: number, update: any) {
  await sql`
    INSERT INTO repository_updates (
      repository_id, update_type, title, description, url, author, created_at_github
    )
    VALUES (
      ${repositoryId},
      ${update.type},
      ${update.title},
      ${update.description || null},
      ${update.url},
      ${update.author},
      ${update.createdAt}
    )
    ON CONFLICT DO NOTHING
  `
}

export async function updateUserSyncTime(userId: number, interval: number) {
  await sql`
    UPDATE user_sync_settings
    SET last_sync_at = NOW(),
        next_sync_at = NOW() + INTERVAL '1 hour' * ${interval},
        updated_at = NOW()
    WHERE user_id = ${userId}
  `
}

export async function getUsersToSync() {
  const result = await sql`
    SELECT u.id, u.access_token, s.sync_interval
    FROM users u
    JOIN user_sync_settings s ON u.id = s.user_id
    WHERE s.sync_enabled = true
      AND (s.next_sync_at IS NULL OR s.next_sync_at <= NOW())
  `
  return result.rows
}

export async function getRepositoriesByUser(userId: number) {
  const result = await sql`
    SELECT * FROM starred_repositories
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `
  return result.rows
}
```

**Step 2: 创建定时同步 API**

Write `app/api/sync-check/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { GitHubClient } from '@/lib/github'
import { saveRepository, saveUpdate, updateUserSyncTime } from '@/lib/db'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const usersToSync = await sql`
      SELECT u.id, u.access_token, s.sync_interval
      FROM users u
      JOIN user_sync_settings s ON u.id = s.user_id
      WHERE s.sync_enabled = true
        AND (s.next_sync_at IS NULL OR s.next_sync_at <= NOW())
    `

    const results = []

    for (const user of usersToSync.rows) {
      try {
        const client = new GitHubClient(user.access_token)
        const repos = await client.getAllStarredRepos()

        for (const repo of repos) {
          const savedRepo = await saveRepository(user.id, repo)

          // 获取最近更新
          const [owner, name] = repo.full_name.split('/')

          const [commits, issues, prs] = await Promise.all([
            client.getRecentCommits(owner, name),
            client.getRecentIssues(owner, name),
            client.getRecentPRs(owner, name),
          ])

          for (const commit of commits) {
            await saveUpdate(savedRepo.id, {
              type: 'commit',
              title: commit.commit?.message?.split('\n')[0] || 'Update',
              description: commit.commit?.message,
              url: commit.html_url,
              author: commit.author?.login || commit.commit?.author?.name,
              createdAt: commit.commit?.author?.date || commit.created_at,
            })
          }

          for (const issue of issues) {
            await saveUpdate(savedRepo.id, {
              type: 'issue',
              title: issue.title,
              description: issue.body,
              url: issue.html_url,
              author: issue.user?.login,
              createdAt: issue.updated_at,
            })
          }

          for (const pr of prs) {
            await saveUpdate(savedRepo.id, {
              type: 'pr',
              title: pr.title,
              description: pr.body,
              url: pr.html_url,
              author: pr.user?.login,
              createdAt: pr.updated_at,
            })
          }
        }

        await updateUserSyncTime(user.id, user.sync_interval)
        results.push({ userId: user.id, success: true })
      } catch (error) {
        console.error(`User ${user.id} sync failed:`, error)
        results.push({ userId: user.id, success: false, error: String(error) })
      }
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      checkedUsers: usersToSync.rows.length,
      results,
    })
  } catch (error) {
    console.error('Sync check failed:', error)
    return NextResponse.json({ error: 'Sync check failed' }, { status: 500 })
  }
}
```

**Step 3: 创建手动同步 API**

Write `app/api/sync/manual/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@vercel/postgres'
import { GitHubClient } from '@/lib/github'
import { saveRepository, saveUpdate, updateUserSyncTime } from '@/lib/db'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const userResult = await sql`
      SELECT access_token, sync_interval
      FROM users u
      JOIN user_sync_settings s ON u.id = s.user_id
      WHERE u.id = ${session.user.id}
    `

    const user = userResult.rows[0]
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const client = new GitHubClient(user.access_token)
    const repos = await client.getAllStarredRepos()

    for (const repo of repos) {
      const savedRepo = await saveRepository(session.user.id, repo)

      const [owner, name] = repo.full_name.split('/')

      const [commits, issues, prs] = await Promise.all([
        client.getRecentCommits(owner, name),
        client.getRecentIssues(owner, name),
        client.getRecentPRs(owner, name),
      ])

      for (const commit of commits) {
        await saveUpdate(savedRepo.id, {
          type: 'commit',
          title: commit.commit?.message?.split('\n')[0] || 'Update',
          url: commit.html_url,
          author: commit.author?.login,
          createdAt: commit.commit?.author?.date,
        })
      }

      for (const issue of issues) {
        await saveUpdate(savedRepo.id, {
          type: 'issue',
          title: issue.title,
          url: issue.html_url,
          author: issue.user?.login,
          createdAt: issue.updated_at,
        })
      }

      for (const pr of prs) {
        await saveUpdate(savedRepo.id, {
          type: 'pr',
          title: pr.title,
          url: pr.html_url,
          author: pr.user?.login,
          createdAt: pr.updated_at,
        })
      }
    }

    await updateUserSyncTime(session.user.id, user.sync_interval)

    return NextResponse.json({
      success: true,
      syncedAt: new Date().toISOString(),
      repositoriesCount: repos.length,
    })
  } catch (error) {
    console.error('Manual sync failed:', error)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
```

**Step 4: Commit**

```bash
git add lib/db.ts app/api/sync/
git commit -m "feat: add GitHub sync API"
```

---

### Task 8: 实现 AI 搜索 API

**Files:**
- Create: `app/api/ai-search/route.ts`
- Create: `lib/ai.ts`

**Step 1: 创建 AI 客户端**

Write `lib/ai.ts`:
```typescript
import { OpenAI } from 'openai'

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
})

export async function searchWithAI(
  query: string,
  repositories: any[],
  modelName: string = 'glm-4'
) {
  const context = repositories.map((r, i) =>
    `${i + 1}. ${r.full_name}: ${r.description || '无描述'}`
  ).join('\n')

  const response = await client.chat.completions.create({
    model: modelName,
    messages: [
      {
        role: 'system',
        content: '你是一个专业的代码仓库推荐助手。根据用户需求，从提供的仓库列表中推荐最合适的项目，并说明推荐理由。'
      },
      {
        role: 'user',
        content: `用户需求：${query}\n\n可选仓库：\n${context}\n\n请推荐最合适的仓库，并说明理由。`
      },
    ],
    stream: true,
    temperature: 0.7,
  })

  return response
}
```

**Step 2: 创建 AI 搜索 API**

Write `app/api/ai-search/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@vercel/postgres'
import { searchWithAI } from '@/lib/ai'
import { OpenAIStream, StreamingTextResponse } from 'ai'

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { query } = await request.json()
  if (!query?.trim()) {
    return NextResponse.json({ error: 'Query is required' }, { status: 400 })
  }

  try {
    // 获取用户 AI 模型配置
    const modelResult = await sql`
      SELECT model_name FROM user_ai_settings WHERE user_id = ${session.user.id}
    `
    const modelName = modelResult.rows[0]?.model_name || 'glm-4'

    // 搜索相关仓库（简单关键词匹配）
    const reposResult = await sql`
      SELECT * FROM starred_repositories
      WHERE user_id = ${session.user.id}
        AND (
          LOWER(name) LIKE LOWER(${`%${query}%`})
          OR LOWER(description) LIKE LOWER(${`%${query}%`})
          OR ${query} = ANY(ARRAY(
            SELECT unnest(topics) FROM starred_repositories WHERE id = starred_repositories.id
          ))
        )
      ORDER BY stargazers_count DESC
      LIMIT 20
    `

    // 调用 AI
    const stream = await searchWithAI(query, reposResult.rows, modelName)
    const aiStream = OpenAIStream(stream)

    return new StreamingTextResponse(aiStream)
  } catch (error) {
    console.error('AI search failed:', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
```

**Step 3: Commit**

```bash
git add lib/ai.ts app/api/ai-search/route.ts
git commit -m "feat: add AI search API"
```

---

### Task 9: 实现设置页面

**Files:**
- Create: `app/(dashboard)/settings/page.tsx`
- Create: `app/api/settings/sync/route.ts`
- Create: `app/api/settings/ai/route.ts`

**Step 1: 创建同步设置 API**

Write `app/api/settings/sync/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@vercel/postgres'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await sql`
    SELECT * FROM user_sync_settings WHERE user_id = ${session.user.id}
  `
  return NextResponse.json(result.rows[0])
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { syncEnabled, syncInterval } = await request.json()

  await sql`
    INSERT INTO user_sync_settings (user_id, sync_enabled, sync_interval)
    VALUES (${session.user.id}, ${syncEnabled}, ${syncInterval})
    ON CONFLICT (user_id)
    DO UPDATE SET
      sync_enabled = ${syncEnabled},
      sync_interval = ${syncInterval},
      updated_at = NOW()
  `

  return NextResponse.json({ success: true })
}
```

**Step 2: 创建 AI 设置 API**

Write `app/api/settings/ai/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@vercel/postgres'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await sql`
    SELECT model_name FROM user_ai_settings WHERE user_id = ${session.user.id}
  `
  return NextResponse.json(result.rows[0]?.model_name || 'glm-4')
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { modelName } = await request.json()

  await sql`
    INSERT INTO user_ai_settings (user_id, model_name)
    VALUES (${session.user.id}, ${modelName})
    ON CONFLICT (user_id)
    DO UPDATE SET model_name = ${modelName}, updated_at = NOW()
  `

  return NextResponse.json({ success: true })
}
```

**Step 3: 创建设置页面**

Write `app/(dashboard)/settings/page.tsx`:
```typescript
'use client'

import { useState, useEffect } from 'react'
import { signOut } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'

export default function SettingsPage() {
  const [syncSettings, setSyncSettings] = useState({
    syncEnabled: true,
    syncInterval: 2
  })
  const [aiModel, setAiModel] = useState('glm-4')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    const [syncRes, aiRes] = await Promise.all([
      fetch('/api/settings/sync'),
      fetch('/api/settings/ai')
    ])
    const sync = await syncRes.json()
    const ai = await aiRes.json()
    if (sync) {
      setSyncSettings({
        syncEnabled: sync.sync_enabled,
        syncInterval: sync.sync_interval
      })
    }
    if (ai) {
      setAiModel(ai)
    }
  }

  const saveSyncSettings = async () => {
    setSaving(true)
    await fetch('/api/settings/sync', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(syncSettings)
    })
    setSaving(false)
    alert('同步设置已保存')
  }

  const saveAiSettings = async () => {
    setSaving(true)
    await fetch('/api/settings/ai', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelName: aiModel })
    })
    setSaving(false)
    alert('AI 设置已保存')
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-8">设置</h1>

      {/* 同步设置 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>数据同步</CardTitle>
          <CardDescription>配置 GitHub Stars 同步频率</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div>
              <div className="font-medium">启用自动同步</div>
              <p className="text-sm text-gray-500">定时从 GitHub 同步你的 Stars</p>
            </div>
            <Switch
              checked={syncSettings.syncEnabled}
              onCheckedChange={(checked) =>
                setSyncSettings({ ...syncSettings, syncEnabled: checked })
              }
            />
          </div>

          <div>
            <Label>同步频率</Label>
            <Select
              value={syncSettings.syncInterval.toString()}
              onValueChange={(value) =>
                setSyncSettings({ ...syncSettings, syncInterval: parseInt(value) })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">每1小时</SelectItem>
                <SelectItem value="2">每2小时</SelectItem>
                <SelectItem value="6">每6小时</SelectItem>
                <SelectItem value="12">每12小时</SelectItem>
                <SelectItem value="24">每24小时</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={saveSyncSettings} disabled={saving} className="w-full">
            {saving ? '保存中...' : '保存同步设置'}
          </Button>
        </CardContent>
      </Card>

      {/* AI 模型设置 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>AI 模型配置</CardTitle>
          <CardDescription>配置 AI 搜索使用的模型</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>模型名称</Label>
            <Input
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
              placeholder="例如：glm-4、gpt-3.5-turbo"
            />
            <p className="text-sm text-gray-500 mt-1">
              API Key 和 Base URL 已在后端配置
            </p>
          </div>

          <Button onClick={saveAiSettings} disabled={saving} className="w-full">
            {saving ? '保存中...' : '保存 AI 设置'}
          </Button>
        </CardContent>
      </Card>

      {/* 账户信息 */}
      <Card>
        <CardHeader>
          <CardTitle>账户</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full"
          >
            退出登录
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
```

**Step 4: Commit**

```bash
git add app/\(dashboard\)/settings/ app/api/settings/
git commit -m "feat: add settings page"
```

---

### Task 10: 创建更新页面

**Files:**
- Create: `app/(dashboard)/updates/page.tsx`
- Create: `components/UpdateItem.tsx`

**Step 1: 创建更新项组件**

Write `components/UpdateItem.tsx`:
```typescript
'use client'

import { ExternalLink } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface UpdateItemProps {
  repositoryName: string
  type: 'commit' | 'issue' | 'pr'
  title: string
  author: string
  createdAt: string
  url: string
}

const typeConfig = {
  commit: { icon: '✓', color: 'bg-green-100 text-green-600', label: 'commit' },
  issue: { icon: '#', color: 'bg-blue-100 text-blue-600', label: 'issue' },
  pr: { icon: '⎇', color: 'bg-purple-100 text-purple-600', label: 'pr' },
}

export function UpdateItem({
  repositoryName,
  type,
  title,
  author,
  createdAt,
  url,
}: UpdateItemProps) {
  const config = typeConfig[type]

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}天前`
    if (hours > 0) return `${hours}小时前`
    return '刚刚'
  }

  return (
    <Card>
      <CardContent className="flex items-start gap-4 pt-6">
        <div className={`flex-shrink-0 w-8 h-8 ${config.color} rounded-full flex items-center justify-center text-sm`}>
          {config.icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold">{repositoryName}</span>
            <Badge variant="secondary">{config.label}</Badge>
          </div>
          <p className="text-sm mb-2">{title}</p>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>{author}</span>
            <span>{formatTime(createdAt)}</span>
          </div>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </CardContent>
    </Card>
  )
}
```

**Step 2: 创建更新页面**

Write `app/(dashboard)/updates/page.tsx`:
```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@vercel/postgres'
import { UpdateItem } from '@/components/UpdateItem'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

export default async function UpdatesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return null
  }

  const updatesResult = await sql`
    SELECT
      ru.*,
      sr.full_name as repository_name
    FROM repository_updates ru
    JOIN starred_repositories sr ON ru.repository_id = sr.id
    WHERE sr.user_id = ${session.user.id}
    ORDER BY ru.created_at_github DESC
    LIMIT 50
  `

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-8">最近更新</h1>

      {/* 筛选器 */}
      <div className="flex gap-2 mb-6">
        <Badge className="bg-blue-600 text-white border-none">全部</Badge>
        <Badge variant="outline" className="cursor-pointer">Commits</Badge>
        <Badge variant="outline" className="cursor-pointer">Issues</Badge>
        <Badge variant="outline" className="cursor-pointer">Pull Requests</Badge>
      </div>

      {/* 更新列表 */}
      <div className="space-y-4">
        {updatesResult.rows.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center py-12">
              <p className="text-gray-500">暂无更新记录</p>
              <p className="text-sm text-gray-400 mt-2">首次同步后会显示更新</p>
            </CardContent>
          </Card>
        ) : (
          updatesResult.rows.map((update: any) => (
            <UpdateItem
              key={update.id}
              repositoryName={update.repository_name}
              type={update.update_type}
              title={update.title}
              author={update.author}
              createdAt={update.created_at_github}
              url={update.url}
            />
          ))
        )}
      </div>
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add components/UpdateItem.tsx app/\(dashboard\)/updates/
git commit -m "feat: add updates page"
```

---

### Task 11: 创建仓库详情页面

**Files:**
- Create: `app/(dashboard)/repositories/[id]/page.tsx`

**Step 1: 创建仓库详情页**

Write `app/(dashboard)/repositories/[id]/page.tsx`:
```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@vercel/postgres'
import { ArrowLeft, ExternalLink, Star, Github } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default async function RepositoryDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return null
  }

  const repoResult = await sql`
    SELECT * FROM starred_repositories
    WHERE id = ${parseInt(params.id)} AND user_id = ${session.user.id}
  `

  const repo = repoResult.rows[0]
  if (!repo) {
    return <div className="container mx-auto px-4 py-8">仓库不存在</div>
  }

  const updatesResult = await sql`
    SELECT * FROM repository_updates
    WHERE repository_id = ${repo.id}
    ORDER BY created_at_github DESC
    LIMIT 20
  `

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toString()
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Link href="/">
        <Button variant="outline" size="sm" className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回列表
        </Button>
      </Link>

      {/* 仓库信息 */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center gap-4 mb-4">
            {repo.owner_avatar_url && (
              <img src={repo.owner_avatar_url} alt="" className="w-12 h-12 rounded-full" />
            )}
            <div>
              <CardTitle className="text-2xl">{repo.full_name}</CardTitle>
              <p className="text-gray-600">{repo.description || '无描述'}</p>
            </div>
          </div>

          <div className="flex items-center gap-6 mb-4">
            <span className="flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500" />
              {formatNumber(repo.stargazers_count)}
            </span>
            {repo.language && (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-yellow-400" />
                {repo.language}
              </span>
            )}
            <a
              href={repo.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
            >
              <Github className="w-5 h-5" />
              访问仓库
            </a>
          </div>

          {repo.topics && repo.topics.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {repo.topics.map((topic: string) => (
                <Badge key={topic} variant="secondary">{topic}</Badge>
              ))}
            </div>
          )}
        </CardHeader>
      </Card>

      {/* 最近更新 */}
      <Card>
        <CardHeader>
          <CardTitle>最近更新</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="commits">
            <TabsList>
              <TabsTrigger value="commits">Commits</TabsTrigger>
              <TabsTrigger value="issues">Issues</TabsTrigger>
              <TabsTrigger value="prs">Pull Requests</TabsTrigger>
            </TabsList>

            <TabsContent value="commits" className="mt-4">
              <div className="space-y-3">
                {updatesResult.rows
                  .filter((u: any) => u.update_type === 'commit')
                  .map((update: any) => (
                    <div key={update.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded">
                      <div className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm">✓</div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{update.title}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                          <span>{update.author}</span>
                          <span>{new Date(update.created_at_github).toLocaleString('zh-CN')}</span>
                        </div>
                      </div>
                      <a href={update.url} target="_blank" rel="noopener noreferrer" className="text-blue-600">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  ))}
              </div>
            </TabsContent>

            <TabsContent value="issues" className="mt-4">
              <div className="space-y-3">
                {updatesResult.rows
                  .filter((u: any) => u.update_type === 'issue')
                  .map((update: any) => (
                    <div key={update.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded">
                      <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm">#</div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{update.title}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                          <span>{update.author}</span>
                          <span>{new Date(update.created_at_github).toLocaleString('zh-CN')}</span>
                        </div>
                      </div>
                      <a href={update.url} target="_blank" rel="noopener noreferrer" className="text-blue-600">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  ))}
              </div>
            </TabsContent>

            <TabsContent value="prs" className="mt-4">
              <div className="space-y-3">
                {updatesResult.rows
                  .filter((u: any) => u.update_type === 'pr')
                  .map((update: any) => (
                    <div key={update.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded">
                      <div className="w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-sm">⎇</div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{update.title}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                          <span>{update.author}</span>
                          <span>{new Date(update.created_at_github).toLocaleString('zh-CN')}</span>
                        </div>
                      </div>
                      <a href={update.url} target="_blank" rel="noopener noreferrer" className="text-blue-600">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add app/\(dashboard\)/repositories/
git commit -m "feat: add repository detail page"
```

---

### Task 12: 配置 Vercel 部署

**Files:**
- Create: `vercel.json`
- Modify: `next.config.js`

**Step 1: 创建 Vercel 配置**

Write `vercel.json`:
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

**Step 2: 更新 Next.js 配置**

Write `next.config.js`:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
        port: '',
        pathname: '/u/**',
      },
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
}

module.exports = nextConfig
```

**Step 3: Commit**

```bash
git add vercel.json next.config.js
git commit -m "feat: add Vercel configuration"
```

---

### Task 13: 添加根布局和全局样式

**Files:**
- Create: `app/layout.tsx`
- Create: `app/globals.css`

**Step 1: 创建全局样式**

Write `app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 224.3 76.3% 48%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
```

**Step 2: 创建根布局**

Write `app/layout.tsx`:
```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'GitHub Star Manager',
  description: '管理你的 GitHub Stars，智能搜索仓库',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

**Step 3: Commit**

```bash
git add app/layout.tsx app/globals.css
git commit -m "feat: add root layout and global styles"
```

---

## 完成

所有任务完成！项目结构如下：

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
│   ├── settings/sync/route.ts
│   ├── settings/ai/route.ts
│   └── ai-search/route.ts
├── layout.tsx
└── globals.css

components/
├── ui/ (shadcn 组件)
├── RepositoryCard.tsx
├── UpdateItem.tsx
└── SearchBox.tsx

lib/
├── db.ts
├── github.ts
├── ai.ts
└── auth.ts

docs/plans/
└── 2026-02-24-*.md

docs/plans/
├── 2026-02-24-github-star-manager-design.md
└── 2026-02-24-github-star-manager-implementation.md
```

## 部署步骤

1. 推送代码到 GitHub
2. 在 Vercel 中导入项目
3. 配置环境变量
4. 创建 Vercel Postgres 数据库并执行 `lib/schema.sql`
5. 在 GitHub 创建 OAuth App 并配置 Client ID/Secret
6. 部署完成
