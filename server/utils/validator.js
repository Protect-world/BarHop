const Joi = require('joi');

const validators = {
  // 酒吧搜索参数验证
  searchBars: Joi.object({
    lat: Joi.number().min(-90).max(90).required().messages({
      'any.required': '缺少纬度参数',
      'number.base': '纬度必须是数字',
      'number.min': '纬度范围错误',
      'number.max': '纬度范围错误'
    }),
    lng: Joi.number().min(-180).max(180).required().messages({
      'any.required': '缺少经度参数',
      'number.base': '经度必须是数字',
      'number.min': '经度范围错误',
      'number.max': '经度范围错误'
    }),
    radius: Joi.number().min(100).max(100000).default(10000).messages({
      'number.base': '搜索半径必须是数字',
      'number.min': '搜索半径最小100米',
      'number.max': '搜索半径最大100000米'
    }),
    keyword: Joi.string().max(100).allow('').default(''),
    type: Joi.string().max(50).allow('').default(''),
    forceRefresh: Joi.boolean().default(false)
  }),

  // 登录验证
  login: Joi.object({
    code: Joi.string().required().messages({
      'any.required': '缺少登录凭证',
      'string.empty': '登录凭证不能为空'
    })
  }),

  // 评价创建验证
  createReview: Joi.object({
    user_id: Joi.string().required().messages({
      'any.required': '缺少用户ID',
      'string.empty': '用户ID不能为空'
    }),
    bar_id: Joi.string().required().messages({
      'any.required': '缺少酒吧ID',
      'string.empty': '酒吧ID不能为空'
    }),
    rating: Joi.number().min(1).max(5).required().messages({
      'any.required': '请选择评分',
      'number.base': '评分必须是数字',
      'number.min': '评分最低1分',
      'number.max': '评分最高5分'
    }),
    content: Joi.string().max(500).allow('').messages({
      'string.max': '评价内容不能超过500字'
    }),
    images: Joi.array().items(Joi.string()).max(9).messages({
      'array.max': '最多上传9张图片'
    }),
    nickname: Joi.string().max(50).allow('').default('匿名用户')
  }),

  // 评价删除验证
  deleteReview: Joi.object({
    user_id: Joi.string().required().messages({
      'any.required': '缺少用户ID'
    })
  }),

  // 收藏操作验证
  favorite: Joi.object({
    bar_id: Joi.string().required().messages({
      'any.required': '缺少酒吧ID'
    })
  }),

  // 分页参数验证
  pagination: Joi.object({
    page: Joi.number().min(1).default(1),
    pageSize: Joi.number().min(1).max(50).default(10),
    user_id: Joi.string().required().messages({
      'any.required': '缺少用户ID'
    })
  }),

  // 用户信息更新验证
  updateProfile: Joi.object({
    nickname: Joi.string().max(50).allow(''),
    avatar: Joi.string().allow(''),
    gender: Joi.string().valid('male', 'female', '').allow('')
  }).min(1).messages({
    'object.min': '至少提供一个要更新的字段'
  }),

  // 上传文件验证
  uploadFile: Joi.object({
    // 文件在multer中验证，这里验证其他参数
    description: Joi.string().max(200).allow('').default('')
  })
};

function validate(schema, data) {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true
  });
  
  if (error) {
    const errors = error.details.map(d => d.message);
    return {
      valid: false,
      errors,
      value: null
    };
  }
  
  return {
    valid: true,
    errors: [],
    value
  };
}

module.exports = { validators, validate };
