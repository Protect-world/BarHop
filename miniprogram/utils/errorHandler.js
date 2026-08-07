/**
 * 统一错误处理工具
 * 提供错误分类、统一 toast 提示等能力
 */

function showErrorToast(message) {
  wx.showToast({
    title: message || '操作失败',
    icon: 'none',
    duration: 2000
  });
}

/**
 * 处理 API 错误
 * @param {Object|Error} err - 错误对象
 * @param {string} customMessage - 自定义错误提示（优先级低于 err.message）
 */
function handleApiError(err, customMessage) {
  console.error('[API Error]:', err);

  if (!err) {
    showErrorToast(customMessage || '未知错误');
    return;
  }

  // 网络错误
  if (err.code === -1 && err.message && err.message.includes('网络')) {
    showErrorToast('网络异常，请检查网络连接');
    return;
  }

  // 认证错误
  if (err.code === 401) {
    showErrorToast('登录已过期，请重新登录');
    return;
  }

  // 业务错误
  showErrorToast(err.message || customMessage || '操作失败');
}

module.exports = {
  showErrorToast,
  handleApiError
};
