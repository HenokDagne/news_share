export interface EnvironmentVariables {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  JWT_ACCESS_SECRET: string;
  JWT_ACCESS_TTL_SECONDS: number;
  JWT_REFRESH_TTL_DAYS: number;
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
  CLOUDINARY_UPLOAD_PRESET?: string;
  CLOUDINARY_ROOT_FOLDER: string;
  SWAGGER_ENABLED: boolean;
  MAIL_HOST?: string;
  MAIL_PORT?: number;
  MAIL_USER?: string;
  MAIL_PASSWORD?: string;
  MAIL_FROM?: string;
  APP_BASE_URL?: string;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const errors: string[] = [];

  const required = [
    'DATABASE_URL',
    'JWT_ACCESS_SECRET',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
  ];

  for (const key of required) {
    if (!config[key] || typeof config[key] !== 'string' || (config[key] as string).trim() === '') {
      errors.push(`Missing required environment variable: ${key}`);
    }
  }

  const jwtSecret = config['JWT_ACCESS_SECRET'] as string;
  if (jwtSecret && jwtSecret.length < 32) {
    errors.push('JWT_ACCESS_SECRET must be at least 32 characters long for security');
  }

  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
  }

  return {
    NODE_ENV: (config['NODE_ENV'] as string) || 'development',
    PORT: config['PORT'] ? parseInt(config['PORT'] as string, 10) : 3000,
    DATABASE_URL: config['DATABASE_URL'] as string,
    JWT_ACCESS_SECRET: jwtSecret,
    JWT_ACCESS_TTL_SECONDS: config['JWT_ACCESS_TTL_SECONDS']
      ? parseInt(config['JWT_ACCESS_TTL_SECONDS'] as string, 10)
      : 900,
    JWT_REFRESH_TTL_DAYS: config['JWT_REFRESH_TTL_DAYS']
      ? parseInt(config['JWT_REFRESH_TTL_DAYS'] as string, 10)
      : 30,
    CLOUDINARY_CLOUD_NAME: config['CLOUDINARY_CLOUD_NAME'] as string,
    CLOUDINARY_API_KEY: config['CLOUDINARY_API_KEY'] as string,
    CLOUDINARY_API_SECRET: config['CLOUDINARY_API_SECRET'] as string,
    CLOUDINARY_UPLOAD_PRESET: config['CLOUDINARY_UPLOAD_PRESET'] as string | undefined,
    CLOUDINARY_ROOT_FOLDER: (config['CLOUDINARY_ROOT_FOLDER'] as string) || 'news_share',
    SWAGGER_ENABLED: config['SWAGGER_ENABLED'] !== 'false',
    MAIL_HOST: (config['MAIL_HOST'] || config['SMTP_HOST']) as string | undefined,
    MAIL_PORT: config['MAIL_PORT']
      ? parseInt(config['MAIL_PORT'] as string, 10)
      : config['SMTP_PORT']
      ? parseInt(config['SMTP_PORT'] as string, 10)
      : undefined,
    MAIL_USER: (config['MAIL_USER'] || config['SMTP_USER']) as string | undefined,
    MAIL_PASSWORD: (config['MAIL_PASSWORD'] || config['SMTP_PASS']) as string | undefined,
    MAIL_FROM: (config['MAIL_FROM'] as string) || undefined,
    APP_BASE_URL: (config['APP_BASE_URL'] as string) || undefined,
  };
}
