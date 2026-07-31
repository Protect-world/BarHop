const config = require('./config.js');

const BASE_URL = config.API_BASE_URL;

// 使用本地默认图片
const DEFAULT_PLACEHOLDER = '/images/默认图.png';

// 所有无照片的酒吧都使用同一张默认图
const BAR_PLACEHOLDERS = [
  '/images/默认图.png'
];

function resolveUrl(url) {
  if (!url) return DEFAULT_PLACEHOLDER;
  // 如果是相对路径，添加 BASE_URL（但本地图片路径保持不变）
  if (url.startsWith('/images/')) {
    return url;
  }
  if (url.startsWith('/uploads/')) {
    return `${BASE_URL}${url}`;
  }
  return url;
}

function ensureBarPhotos(bar) {
  if (!bar) return bar;
  
  let photos = bar.photos;
  if (!photos || !Array.isArray(photos) || photos.length === 0) {
    const index = Math.abs(hashCode(bar.id || bar.name || '')) % BAR_PLACEHOLDERS.length;
    photos = [BAR_PLACEHOLDERS[index]];
  }
  
  return {
    ...bar,
    photos: photos.map(p => resolveUrl(p))
  };
}

function ensureBarListPhotos(bars) {
  if (!Array.isArray(bars)) return [];
  return bars.map(ensureBarPhotos);
}

function getSafePhoto(photos, index = 0) {
  if (!photos || !Array.isArray(photos) || !photos[index]) {
    return DEFAULT_PLACEHOLDER;
  }
  return resolveUrl(photos[index]);
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

module.exports = {
  DEFAULT_PLACEHOLDER,
  BAR_PLACEHOLDERS,
  resolveUrl,
  ensureBarPhotos,
  ensureBarListPhotos,
  getSafePhoto
};
