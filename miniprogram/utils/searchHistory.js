const config = require('./config');

const SearchHistory = {
  getHistory() {
    try {
      const history = wx.getStorageSync(config.CACHE_KEYS.SEARCH_HISTORY);
      return Array.isArray(history) ? history : [];
    } catch (e) {
      console.error('[SearchHistory] 获取历史失败:', e);
      return [];
    }
  },

  addHistory(keyword) {
    if (!keyword || !keyword.trim()) return;
    
    const trimmedKeyword = keyword.trim();
    let history = this.getHistory();
    
    history = history.filter(item => item.keyword !== trimmedKeyword);
    
    history.unshift({
      keyword: trimmedKeyword,
      timestamp: Date.now()
    });
    
    if (history.length > config.SEARCH_HISTORY_MAX) {
      history = history.slice(0, config.SEARCH_HISTORY_MAX);
    }
    
    try {
      wx.setStorageSync(config.CACHE_KEYS.SEARCH_HISTORY, history);
      return history;
    } catch (e) {
      console.error('[SearchHistory] 保存历史失败:', e);
      return history;
    }
  },

  removeHistory(keyword) {
    let history = this.getHistory();
    history = history.filter(item => item.keyword !== keyword);
    
    try {
      wx.setStorageSync(config.CACHE_KEYS.SEARCH_HISTORY, history);
      return history;
    } catch (e) {
      console.error('[SearchHistory] 删除历史失败:', e);
      return history;
    }
  },

  clearHistory() {
    try {
      wx.removeStorageSync(config.CACHE_KEYS.SEARCH_HISTORY);
      return true;
    } catch (e) {
      console.error('[SearchHistory] 清除历史失败:', e);
      return false;
    }
  },

  clearExpired(days = 7) {
    const history = this.getHistory();
    const now = Date.now();
    const expireMs = days * 24 * 60 * 60 * 1000;
    
    const validHistory = history.filter(item => {
      return (now - item.timestamp) < expireMs;
    });
    
    try {
      wx.setStorageSync(config.CACHE_KEYS.SEARCH_HISTORY, validHistory);
      return validHistory;
    } catch (e) {
      console.error('[SearchHistory] 清理过期历史失败:', e);
      return validHistory;
    }
  },

  getSuggestions(keyword) {
    if (!keyword) return this.getHistory();
    
    const history = this.getHistory();
    const lowerKeyword = keyword.toLowerCase();
    
    return history.filter(item => 
      item.keyword.toLowerCase().includes(lowerKeyword)
    ).slice(0, 5);
  },

  formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    
    if (days === 0) {
      const hours = Math.floor(diff / (60 * 60 * 1000));
      if (hours === 0) {
        const minutes = Math.floor(diff / (60 * 1000));
        return minutes > 0 ? `${minutes}分钟前` : '刚刚';
      }
      return `${hours}小时前`;
    } else if (days < 7) {
      return `${days}天前`;
    } else {
      return `${date.getMonth() + 1}/${date.getDate()}`;
    }
  }
};

module.exports = SearchHistory;