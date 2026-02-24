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
  github_repo_id BIGINT NOT NULL,
  repo_name VARCHAR(255) NOT NULL,
  owner_login VARCHAR(255) NOT NULL,
  repo_full_name VARCHAR(255) NOT NULL,
  description TEXT,
  html_url TEXT NOT NULL,
  language VARCHAR(100),
  stargazers_count INTEGER DEFAULT 0,
  fork_count INTEGER DEFAULT 0,
  open_issues_count INTEGER DEFAULT 0,
  topics TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, github_repo_id)
);

-- ============================================================================
-- 3. Repository Updates Table
-- ============================================================================
-- Tracks updates/changes to repositories for notifications and analysis
CREATE TABLE IF NOT EXISTS repository_updates (
  id SERIAL PRIMARY KEY,
  repo_id INTEGER NOT NULL REFERENCES starred_repositories(id) ON DELETE CASCADE,
  update_type VARCHAR(50) NOT NULL,
  title VARCHAR(500),
  description TEXT,
  url TEXT,
  author VARCHAR(255),
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_read BOOLEAN DEFAULT FALSE
);

-- ============================================================================
-- 4. User Sync Settings Table
-- ============================================================================
-- Stores user preferences for repository synchronization
CREATE TABLE IF NOT EXISTS user_sync_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  sync_enabled BOOLEAN DEFAULT TRUE,
  sync_interval_minutes INTEGER DEFAULT 120,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_notifications_enabled BOOLEAN DEFAULT TRUE,
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
  preferred_model VARCHAR(100) DEFAULT 'glm-4',
  custom_prompt TEXT,
  analysis_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Indexes
-- ============================================================================

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Starred repositories table indexes
CREATE INDEX IF NOT EXISTS idx_starred_repos_user_id ON starred_repositories(user_id);
CREATE INDEX IF NOT EXISTS idx_starred_repos_github_repo_id ON starred_repositories(github_repo_id);
CREATE INDEX IF NOT EXISTS idx_starred_repos_language ON starred_repositories(language);
CREATE INDEX IF NOT EXISTS idx_starred_repos_created_at ON starred_repositories(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_starred_repos_repo_name ON starred_repositories(repo_name);
CREATE INDEX IF NOT EXISTS idx_starred_repos_owner_login ON starred_repositories(owner_login);

-- Repository updates table indexes
CREATE INDEX IF NOT EXISTS idx_repo_updates_repo_id ON repository_updates(repo_id);
CREATE INDEX IF NOT EXISTS idx_repo_updates_detected_at ON repository_updates(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_repo_updates_is_read ON repository_updates(is_read);
CREATE INDEX IF NOT EXISTS idx_repo_updates_type ON repository_updates(update_type);

-- User sync settings table indexes
CREATE INDEX IF NOT EXISTS idx_user_sync_settings_user_id ON user_sync_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sync_settings_last_sync ON user_sync_settings(last_sync_at);

-- User AI settings table indexes
CREATE INDEX IF NOT EXISTS idx_user_ai_settings_user_id ON user_ai_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_ai_settings_model ON user_ai_settings(preferred_model);

-- ============================================================================
-- Functions for auto-updating updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_starred_repositories_updated_at
  BEFORE UPDATE ON starred_repositories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_sync_settings_updated_at
  BEFORE UPDATE ON user_sync_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_ai_settings_updated_at
  BEFORE UPDATE ON user_ai_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
