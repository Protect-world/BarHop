// 自定义错误类
class AppError extends Error {
  constructor(message, statusCode = 500, code = -1) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(message = '资源不存在') {
    super(message, 404, 404);
    this.name = 'NotFoundError';
  }
}

class BadRequestError extends AppError {
  constructor(message = '请求参数错误', errors = null) {
    super(message, 400, 400);
    this.name = 'BadRequestError';
    this.errors = errors;
  }
}

class UnauthorizedError extends AppError {
  constructor(message = '未授权') {
    super(message, 401, 401);
    this.name = 'UnauthorizedError';
  }
}

class ForbiddenError extends AppError {
  constructor(message = '无权限访问') {
    super(message, 403, 403);
    this.name = 'ForbiddenError';
  }
}

class ConflictError extends AppError {
  constructor(message = '资源冲突') {
    super(message, 409, 409);
    this.name = 'ConflictError';
  }
}

class ServiceUnavailableError extends AppError {
  constructor(message = '服务暂不可用') {
    super(message, 503, 503);
    this.name = 'ServiceUnavailableError';
  }
}

// 全局错误处理中间件
function errorHandler(err, req, res, next) {
  console.error('[Error]', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    timestamp: new Date().toISOString()
  });

  if (err instanceof AppError) {
    const response = {
      code: err.code,
      message: err.message
    };
    if (err.errors) {
      response.errors = err.errors;
    }
    return res.status(err.statusCode).json(response);
  }

  // 数据库错误
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      code: 409,
      message: '数据重复，可能已存在'
    });
  }

  if (err.code === 'ER_NO_REFERENCED_ROW') {
    return res.status(400).json({
      code: 400,
      message: '引用的数据不存在'
    });
  }

  if (err.code === 'ER_ROW_IS_REFERENCED') {
    return res.status(400).json({
      code: 400,
      message: '数据被引用，无法删除'
    });
  }

  // 验证错误
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      code: 400,
      message: '数据验证失败',
      errors: err.details
    });
  }

  // JWT错误
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      code: 401,
      message: '无效的认证令牌'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      code: 401,
      message: '认证令牌已过期'
    });
  }

  // 默认服务器错误
  const isProduction = process.env.NODE_ENV === 'production';
  return res.status(500).json({
    code: 500,
    message: isProduction ? '服务器内部错误' : err.message,
    ...(isProduction ? {} : { stack: err.stack })
  });
}

// 异步错误包装器
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  AppError,
  NotFoundError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  ServiceUnavailableError,
  errorHandler,
  asyncHandler
};
