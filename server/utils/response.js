const response = {
  success(res, data = null, message = '操作成功') {
    return res.json({
      code: 0,
      message,
      data
    });
  },

  error(res, message = '操作失败', code = -1, data = null) {
    return res.json({
      code,
      message,
      data
    });
  },

  created(res, data = null, message = '创建成功') {
    return res.json({
      code: 0,
      message,
      data
    });
  },

  updated(res, data = null, message = '更新成功') {
    return res.json({
      code: 0,
      message,
      data
    });
  },

  deleted(res, message = '删除成功') {
    return res.json({
      code: 0,
      message
    });
  },

  paginated(res, list, total, page = 1, pageSize = 10) {
    return res.json({
      code: 0,
      message: '获取成功',
      data: {
        list,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  },

  unauthorized(res, message = '未授权') {
    return res.status(401).json({
      code: 401,
      message
    });
  },

  forbidden(res, message = '无权限访问') {
    return res.status(403).json({
      code: 403,
      message
    });
  },

  notFound(res, message = '资源不存在') {
    return res.status(404).json({
      code: 404,
      message
    });
  },

  badRequest(res, message = '请求参数错误', errors = null) {
    return res.status(400).json({
      code: 400,
      message,
      errors
    });
  }
};

module.exports = response;