// Express Request 扩展：auth 中间件挂载当前用户
declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string; role: string };
    }
  }
}

export {};
