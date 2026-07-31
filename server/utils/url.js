const config = require('../config');

const urlService = {
  // 将相对路径转为完整URL
  toFullUrl(relativePath) {
    if (!relativePath) return '';
    if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
      return relativePath;
    }
    const baseUrl = config.server.baseUrl.replace(/\/$/, '');
    const path = relativePath.startsWith('/') ? relativePath : '/' + relativePath;
    return baseUrl + path;
  },

  // 将相对路径数组转为完整URL数组
  toFullUrls(urls) {
    if (!Array.isArray(urls)) return [];
    return urls.map(url => this.toFullUrl(url)).filter(Boolean);
  },

  // 解析photos字段（JSON字符串或数组）并转为完整URL
  parsePhotos(photos) {
    if (!photos) return [];
    let urls = [];
    try {
      if (typeof photos === 'string') {
        urls = JSON.parse(photos);
      } else if (Array.isArray(photos)) {
        urls = photos;
      }
    } catch (e) {
      urls = [];
    }
    return this.toFullUrls(urls);
  },

  // 处理酒吧数据中的图片和URL字段
  processBarData(bar) {
    if (!bar) return null;
    const processed = { ...bar };
    
    // 处理图片
    processed.photos = this.parsePhotos(bar.photos);
    
    // 处理封面图
    if (bar.cover && !bar.cover.startsWith('http')) {
      processed.cover = this.toFullUrl(bar.cover);
    }
    
    // 处理其他可能的URL字段
    if (bar.logo && !bar.logo.startsWith('http')) {
      processed.logo = this.toFullUrl(bar.logo);
    }
    
    return processed;
  },

  // 批量处理酒吧数据
  processBarList(bars) {
    if (!Array.isArray(bars)) return [];
    return bars.map(bar => this.processBarData(bar));
  },

  // 生成上传文件的访问路径
  generateUploadPath(filename) {
    return `/uploads/${filename}`;
  },

  // 生成上传文件的完整URL
  generateUploadUrl(filename) {
    return this.toFullUrl(this.generateUploadPath(filename));
  },

  // 判断是否是本地上传的文件
  isLocalUpload(url) {
    if (!url) return false;
    return url.startsWith('/uploads/') || url.startsWith('uploads/');
  },

  // 确保URL安全（防止XSS）
  sanitizeUrl(url) {
    if (!url) return '';
    // 移除可能的危险协议
    const dangerous = ['javascript:', 'data:', 'vbscript:'];
    const lowerUrl = url.toLowerCase();
    for (const proto of dangerous) {
      if (lowerUrl.startsWith(proto)) {
        return '';
      }
    }
    return url;
  }
};

module.exports = urlService;
