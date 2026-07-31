const errorHandler = (err, req, res, next) => {
  console.error('[Error]', err.message);
  
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || '服务器内部错误';

  if (process.env.NODE_ENV === 'development') {
    return res.status(statusCode).json({
      code: statusCode,
      message,
      stack: err.stack
    });
  }

  return res.status(statusCode).json({
    code: statusCode,
    message: statusCode === 500 ? '服务器内部错误' : message
  });
};

class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(message = '资源不存在') {
    super(message, 404);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = '未授权') {
    super(message, 401);
  }
}

class ForbiddenError extends AppError {
  constructor(message = '无权限访问') {
    super(message, 403);
  }
}

class ValidationError extends AppError {
  constructor(message = '参数验证失败', errors = null) {
    super(message, 400);
    this.errors = errors;
  }
}

module.exports = {
  errorHandler,
  AppError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError
};