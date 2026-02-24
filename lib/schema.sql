-- GitStarHub Database Schema
-- This file contains the database schema for the GitHub Star Manager application

-- ============================================================================
-- 1. Users Table
-- ============================================================================
-- Stores user information from GitHub OAuth
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  github_id BIGINT NOT NULL UNIQUE,
  username VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  avatar_url TEXT,
  access_token TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 2. Starred Repositories Table
-- ============================================================================
-- Stores GitHub repositories that users have starred
CREATE TABLE IF NOT EXISTS starred_repositories (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  github_id BIGINT NOT NULL,
  name VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  description TEXT,
  html_url TEXT NOT NULL,
  language VARCHAR(100),
  stargazers_count INTEGER DEFAULT 0,
  topics TEXT[],
  owner_avatar_url TEXT,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, github_id)
);

-- ============================================================================
-- 3. Repository Updates Table
-- ============================================================================
-- Tracks updates/changes to repositories for notifications and analysis
CREATE TABLE IF NOT EXISTS repository_updates (
  id SERIAL PRIMARY KEY,
  repository_id INTEGER NOT NULL REFERENCES starred_repositories(id) ON DELETE CASCADE,
  update_type VARCHAR(50) NOT NULL,
  title VARCHAR(500),
  description TEXT,
  url TEXT,
  author VARCHAR(255),
  created_at_github TIMESTAMP WITH TIME ZONE,
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 4. User Sync Settings Table
-- ============================================================================
-- Stores user preferences for repository synchronization
CREATE TABLE IF NOT EXISTS user_sync_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  sync_enabled BOOLEAN DEFAULT true,
  sync_interval INTEGER DEFAULT 2,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  next_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 5. User AI Settings Table
-- ============================================================================
-- Stores user preferences for AI model configuration
CREATE TABLE IF NOT EXISTS user_ai_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  model_name VARCHAR(100) DEFAULT 'glm-4',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Indexes
-- ============================================================================

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id);

-- Starred repositories table indexes
CREATE INDEX IF NOT EXISTS idx_starred_repos_user_id ON starred_repositories(user_id);
CREATE INDEX IF NOT EXISTS idx_starred_repos_language ON starred_repositories(language);
CREATE INDEX IF NOT EXISTS idx_starred_repos_updated_at ON starred_repositories(updated_at DESC);

-- Repository updates table indexes
CREATE INDEX IF NOT EXISTS idx_updates_repository_id ON repository_updates(repository_id);
CREATE INDEX IF NOT EXISTS idx_updates_created_at_github ON repository_updates(created_at_github DESC);
CREATE INDEX IF NOT EXISTS idx_updates_type ON repository_updates(update_type);

-- User sync settings table indexes
CREATE INDEX IF NOT EXISTS idx_sync_next_at ON user_sync_settings(next_sync_at);

-- User AI settings table indexes
CREATE INDEX IF NOT EXISTS idx_ai_settings_user_id ON user_ai_settings(user_id);
