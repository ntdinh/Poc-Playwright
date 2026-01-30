/**
 * Environment Configuration
 * Manage environment configs (dev, staging, production).
 */

export enum Environment {
  DEV = 'dev',
  STAGING = 'staging',
  PRODUCTION = 'production',
}

export interface EnvironmentConfig {
  baseURL: string;
  apiURL: string;
  timeout: number;
  credentials: {
    admin: {
      username: string;
      password: string;
    };
    user: {
      username: string;
      password: string;
    };
  };
}

/**
 * Get current environment from ENV/NODE_ENV or default to DEV.
 */
export function getEnvironment(): Environment {
  const env = process.env.ENV || process.env.NODE_ENV || 'dev';
  return env as Environment;
}

/**
 * Configuration for each environment.
 */
const environments: Record<Environment, EnvironmentConfig> = {
  [Environment.DEV]: {
    baseURL: 'https://opensource-demo.orangehrmlive.com',
    apiURL: 'https://opensource-demo.orangehrmlive.com/web/index.php/api',
    timeout: 30000,
    credentials: {
      admin: {
        username: 'Admin',
        password: 'admin123',
      },
      user: {
        username: 'testuser',
        password: 'testpass123',
      },
    },
  },
  [Environment.STAGING]: {
    baseURL: 'https://staging.example.com',
    apiURL: 'https://staging.example.com/api',
    timeout: 30000,
    credentials: {
      admin: {
        username: process.env.STAGING_ADMIN_USER || 'admin',
        password: process.env.STAGING_ADMIN_PASS || 'admin123',
      },
      user: {
        username: process.env.STAGING_USER_USER || 'user',
        password: process.env.STAGING_USER_PASS || 'user123',
      },
    },
  },
  [Environment.PRODUCTION]: {
    baseURL: 'https://production.example.com',
    apiURL: 'https://production.example.com/api',
    timeout: 60000,
    credentials: {
      admin: {
        username: process.env.PROD_ADMIN_USER || '',
        password: process.env.PROD_ADMIN_PASS || '',
      },
      user: {
        username: process.env.PROD_USER_USER || '',
        password: process.env.PROD_USER_PASS || '',
      },
    },
  },
};

/**
 * Get config for the current environment.
 */
export function getConfig(): EnvironmentConfig {
  const env = getEnvironment();
  return environments[env];
}

/**
 * Get base URL for the current environment.
 */
export function getBaseURL(): string {
  return getConfig().baseURL;
}

/**
 * Get API URL for the current environment.
 */
export function getAPIURL(): string {
  return getConfig().apiURL;
}

/**
 * Get credentials for a specific role.
 */
export function getCredentials(role: 'admin' | 'user' = 'admin') {
  return getConfig().credentials[role];
}
