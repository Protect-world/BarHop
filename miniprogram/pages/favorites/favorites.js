const app = getApp();
const request = require('../../utils/request.js');
const imageUtil = require('../../utils/image');
const config = require('../../utils/config');

Page({
  data: {
    user_id: '',
    bars: [],
    total: 0,
    loading: false
  },

  onLoad: function() {
    this.initUserInfo();
  },

  onShow: function() {
    this.initUserInfo();
    if (this.data.user_id) {
      this.loadFavorites();
    }
  },

  initUserInfo: function() {
    const userInfo = app.getUserInfo();
    if (userInfo && userInfo.id !== this.data.user_id) {
      this.setData({ user_id: userInfo.id });
      this.loadFavorites();
    }
  },

  loadFavorites: function() {
    this.setData({ loading: true });
    const DEFAULT_IMG = '/images/默认图.png';
    
    request.getFavorites({ user_id: this.data.user_id }).then(res => {
      if (res.code === 0) {
        // 处理图片URL和评分显示
        const bars = (res.data.list || []).map(bar => {
          // 处理图片：如果photos为空数组，使用默认图片
          if (!bar.photos || !Array.isArray(bar.photos) || bar.photos.length === 0) {
            bar.photos = [DEFAULT_IMG];
          } else {
            // 处理图片URL
            bar.photos = bar.photos.map(photo => {
              if (photo && photo.startsWith('/uploads/')) {
                return config.API_BASE_URL + photo;
              }
              return photo;
            });
          }
          
          // 处理评分显示
          // 后端已按优先级返回：高德评分 > 用户评分 > null(暂无)
          if (bar.avg_rating !== null && bar.avg_rating !== undefined && String(bar.avg_rating) !== '0.0') {
            bar.avg_rating = String(bar.avg_rating);
            bar.has_rating = true;
          } else {
            bar.avg_rating = '';
            bar.has_rating = false;
          }
          
          return bar;
        });
        
        this.setData({
          bars,
          total: res.data.total || 0
        });
      }
    }).catch(err => {
      console.error('加载收藏失败:', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }).finally(() => {
      this.setData({ loading: false });
    });
  },

  toggleFavorite: function(e) {
    const barId = e.currentTarget.dataset.id;
    const favorite = this.data.bars.find(b => b.id === barId);
    
    if (!favorite) return;

    wx.showModal({
      title: '取消收藏',
      content: '确定要取消收藏这家酒吧吗？',
      success: (res) => {
        if (res.confirm) {
          request.deleteFavorite({ user_id: this.data.user_id, bar_id: barId }).then(res => {
            if (res.code === 0) {
              wx.showToast({ title: '已取消收藏', icon: 'success' });
              this.loadFavorites();
            }
          }).catch(err => {
            console.error('取消收藏失败:', err);
            wx.showToast({ title: '操作失败', icon: 'none' });
          });
        }
      }
    });
  },

  goToDetail: function(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` });
  },

  onPullDownRefresh: function() {
    this.loadFavorites();
    wx.stopPullDownRefresh();
  },

  onImageError: function(e) {
    const { index } = e.currentTarget.dataset;
    const { bars } = this.data;
    const DEFAULT_IMG = '/images/默认图.png';
    
    if (index !== undefined && bars[index]) {
      const bar = bars[index];
      if (!bar._imgErrorHandled) {
        bars[index].photos = [DEFAULT_IMG];
        bars[index]._imgErrorHandled = true;
        
        this.setData({ bars });
      }
    }
  },

  // 分享
  onShareAppMessage: function () {
    return {
      title: 'BarHop · 我的私藏酒吧清单',
      path: '/pages/index/index'
    };
  },

  onShareTimeline: function () {
    return {
      title: 'BarHop · 发现你附近的宝藏酒吧'
    };
  }
});
