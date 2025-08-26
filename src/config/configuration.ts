export default () => ({
  port: parseInt(process.env.PORT!, 10) || 3000,
  
  database: {
    url: process.env.DATABASE_URL!,
  },
  
  jwt: {
    secret: process.env.JWT_SECRET!,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET!,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  
  app: {
    nodeEnv: process.env.NODE_ENV || 'development',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  },
  
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE!, 10) || 5242880,
    dest: process.env.UPLOAD_DEST || './uploads',
  },
  
  smtp: {
    host: process.env.SMTP_HOST!,
    port: parseInt(process.env.SMTP_PORT!, 10) || 587,
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASS!,
  },
  
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL!, 10) || 60000,
    limit: parseInt(process.env.THROTTLE_LIMIT!, 10) || 100,
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
});