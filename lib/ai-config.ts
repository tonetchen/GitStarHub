/**
 * Global AI Configuration
 * Centralized configuration for AI model settings
 */

// Default AI model to use across the application
export const DEFAULT_AI_MODEL = 'deepseek-chat';

// List of supported AI models
export const SUPPORTED_AI_MODELS = [
  'deepseek-chat',
  'glm-4',
  'glm-4-flash',
  'gpt-4',
  'gpt-3.5-turbo',
  'claude-3',
] as const;

// Model display names for UI
export const AI_MODEL_LABELS: Record<string, string> = {
  'deepseek-chat': 'DeepSeek Chat (Recommended)',
  'glm-4': 'GLM-4',
  'glm-4-flash': 'GLM-4 Flash (Faster)',
  'gpt-4': 'GPT-4',
  'gpt-3.5-turbo': 'GPT-3.5 Turbo',
  'claude-3': 'Claude 3',
};

// Check if a model is supported
export function isModelSupported(model: string): boolean {
  return SUPPORTED_AI_MODELS.includes(model as typeof SUPPORTED_AI_MODELS[number]);
}

// Get default model (always returns the configured default)
export function getDefaultModel(): string {
  return DEFAULT_AI_MODEL;
}
