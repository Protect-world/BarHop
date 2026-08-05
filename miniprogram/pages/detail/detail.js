const api = require('../../utils/request');
const app = getApp();
const imageUtil = require('../../utils/image');
const config = require('../../utils/config');

Page({
  data: {
    barId: '',
    bar: null,
    barName: '加载中...',
    barRating: '0.0',
    barTags: '',
    barAddress: '暂无地址',
    barHours: '暂无信息',
    barPhone: '暂无电话',
    barPhotos: [],
    headerBg: '',
    loading: true,
    user_id: '',
    isFavorite: false,
    reviews: [],
    totalReviews: 0,
    // 用户评分聚合
    userRating: 0,
    userRatingDisplay: '--',
    userRatingCount: 0,
    dist5: 0,
    dist4: 0,
    dist3: 0,
    dist2: 0,
    dist1: 0,
    myReview: null,
    ratingSource: 'amap'
  },

  onLoad: function (options) {
    const id = options.id;
    const userInfo = app.getUserInfo();
    
    this.setData({ 
      barId: id,
      user_id: userInfo ? userInfo.id : ''
    });
    
    if (id) {
      this.fetchBarDetail(id);
      this.checkFavorite();
      this.loadReviews();
    }
  },

  fetchBarDetail: function (id) {
    console.log('[Detail] 获取酒吧详情:', id);
    this.setData({ loading: true });

    // 添加user_id参数以获取用户自己的评价
    const params = this.data.user_id ? `?user_id=${this.data.user_id}` : '';
    
    api.getBarById(id + params).then(res => {
      let bar = imageUtil.ensureBarPhotos(res.data);
      const photos = bar.photos && Array.isArray(bar.photos) ? bar.photos : [imageUtil.DEFAULT_PLACEHOLDER];
      const headerBg = photos[0];
      
      console.log('[Detail] 酒吧信息:', bar.name, '- 高德评分:', bar.avg_rating);
      
      // 处理用户评分聚合数据
      const userRating = bar.user_rating || {};
      const myReview = bar.my_review || null;
      const dist = userRating.distribution || {};
      
      this.setData({
        bar,
        barName: bar.name || '未知酒馆',
        barRating: parseFloat(bar.avg_rating || 4.0).toFixed(1),
        barTags: bar.tags || '酒吧',
        barAddress: bar.address || '暂无地址',
        barHours: bar.hours || '暂无信息',
        barPhone: bar.phone || '暂无电话',
        barPhotos: photos,
        headerBg,
        loading: false,
        // 用户评分数据
        userRating: userRating.average || 0,
        userRatingDisplay: userRating.average > 0 ? parseFloat(userRating.average).toFixed(1) : '--',
        userRatingCount: userRating.count || 0,
        dist5: dist['5'] || 0,
        dist4: dist['4'] || 0,
        dist3: dist['3'] || 0,
        dist2: dist['2'] || 0,
        dist1: dist['1'] || 0,
        myReview: myReview,
        ratingSource: bar.rating_source || 'amap'
      });
    }).catch(err => {
      console.error('获取酒吧详情失败:', err);
      this.setData({ loading: false });
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    });
  },

  makeCall: function () {
    const phone = this.data.bar?.phone;
    if (phone) {
      wx.makePhoneCall({
        phoneNumber: phone,
        fail: () => {
          wx.showToast({
            title: '拨打失败',
            icon: 'none'
          });
        }
      });
    }
  },

  openLocation: function () {
    const bar = this.data.bar;
    if (!bar || !bar.lat || !bar.lng) {
      wx.showToast({
        title: '位置信息不可用',
        icon: 'none'
      });
      return;
    }

    // 后端 lat/lng 可能是字符串（MySQL DECIMAL 默认返回字符串），需强制转为 Number
    const latitude = parseFloat(bar.lat);
    const longitude = parseFloat(bar.lng);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      wx.showToast({
        title: '位置坐标无效',
        icon: 'none'
      });
      return;
    }

    wx.openLocation({
      latitude: latitude,
      longitude: longitude,
      name: bar.name,
      address: bar.address,
      scale: 18,
      fail: (err) => {
        console.error('[Detail] openLocation 失败:', err);
        wx.showToast({
          title: '打开地图失败',
          icon: 'none'
        });
      }
    });
  },

  goBack: function () {
    wx.navigateBack();
  },

  previewPhoto: function (e) {
    const index = e.currentTarget.dataset.index;
    wx.previewImage({
      current: this.data.barPhotos[index],
      urls: this.data.barPhotos
    });
  },

  onImageError: function (e) {
    const { index } = e.currentTarget.dataset;
    const { barPhotos, headerBg } = this.data;
    const DEFAULT_IMG = '/images/默认图.png';
    
    // 处理照片网格中的图片
    if (index !== undefined && barPhotos[index]) {
      barPhotos[index] = DEFAULT_IMG;
      this.setData({ barPhotos });
    }
    
    // 如果是 headerBg 加载失败
    if (headerBg && headerBg !== DEFAULT_IMG) {
      this.setData({ headerBg: DEFAULT_IMG });
    }
  },

  checkFavorite: function () {
    api.getFavorites({ 
      user_id: this.data.user_id,
      bar_id: this.data.barId 
    }).then(res => {
      if (res.code === 0) {
        this.setData({ isFavorite: res.data.is_favorite });
      }
    }).catch(err => {
      console.error('检查收藏状态失败:', err);
    });
  },

  toggleFavorite: function () {
    if (this.data.isFavorite) {
      api.deleteFavorite({ 
        user_id: this.data.user_id,
        bar_id: this.data.barId 
      }).then(res => {
        if (res.code === 0) {
          this.setData({ isFavorite: false });
          wx.showToast({ title: '已取消收藏', icon: 'success' });
        }
      }).catch(err => {
        console.error('取消收藏失败:', err);
        wx.showToast({ title: '操作失败', icon: 'none' });
      });
    } else {
      api.addFavorite({
        user_id: this.data.user_id,
        bar_id: this.data.barId
      }).then(res => {
        if (res.code === 0) {
          this.setData({ isFavorite: true });
          wx.showToast({ title: '收藏成功', icon: 'success' });
        }
      }).catch(err => {
        console.error('添加收藏失败:', err);
        wx.showToast({ title: '操作失败', icon: 'none' });
      });
    }
  },

  loadReviews: function () {
    const currentUserId = this.data.user_id;
    console.log('[Detail] 加载评价, 当前用户ID:', currentUserId);
    
    api.getBarReviews(this.data.barId).then(res => {
      if (res.code === 0) {
        const data = res.data;
        // 更新用户评分汇总（如果详情页没有的话）
        if (data.summary && data.summary.count > 0 && this.data.userRatingCount === 0) {
          const dist = data.summary.distribution || {};
          this.setData({
            userRating: data.summary.avg_rating || 0,
            userRatingDisplay: data.summary.avg_rating > 0 ? parseFloat(data.summary.avg_rating).toFixed(1) : '--',
            userRatingCount: data.summary.count || 0,
            dist5: dist['5'] || 0,
            dist4: dist['4'] || 0,
            dist3: dist['3'] || 0,
            dist2: dist['2'] || 0,
            dist1: dist['1'] || 0
          });
        }
        
        // 处理评论列表中的图片URL和删除权限
        const reviews = (data.reviews || []).map(review => {
          const canDelete = currentUserId && review.user_id && String(review.user_id) === String(currentUserId);
          console.log('[Detail] 评价用户ID:', review.user_id, 'canDelete:', canDelete);
          return {
            ...review,
            can_delete: canDelete,
            // 确保图片URL完整
            images: (review.images || []).map(img => {
              if (img && img.startsWith('/uploads/')) {
                return config.API_BASE_URL + img;
              }
              return img;
            })
          };
        });
        
        this.setData({
          reviews: reviews,
          totalReviews: data.summary ? data.summary.count : (data.total || 0)
        });
      }
    }).catch(err => {
      console.error('加载评价失败:', err);
    });
  },

  goReview: function () {
    wx.navigateTo({
      url: `/pages/review/review?bar_id=${this.data.barId}`
    });
  },

  previewReviewImage: function (e) {
    const urls = e.currentTarget.dataset.urls;
    const current = e.currentTarget.dataset.current;
    wx.previewImage({
      current,
      urls
    });
  },

  deleteReview: function (e) {
    const reviewId = e.currentTarget.dataset.id;
    const reviewUserId = e.currentTarget.dataset.userid;
    
    // 检查是否是自己的评价
    if (reviewUserId !== this.data.user_id) {
      wx.showToast({ title: '只能删除自己的评价', icon: 'none' });
      return;
    }
    
    wx.showModal({
      title: '删除评价',
      content: '确定要删除这条评价吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });
          api.deleteReview(reviewId, { user_id: this.data.user_id }).then(res => {
            wx.hideLoading();
            if (res.code === 0) {
              wx.showToast({ title: '删除成功', icon: 'success' });
              // 重新加载评价和酒吧详情
              this.loadReviews();
              this.fetchBarDetail(this.data.barId);
            } else {
              wx.showToast({ title: res.message || '删除失败', icon: 'none' });
            }
          }).catch(err => {
            wx.hideLoading();
            console.error('删除评价失败:', err);
            wx.showToast({ title: '删除失败', icon: 'none' });
          });
        }
      }
    });
  },

  onShow: function () {
    if (this.data.barId) {
      this.checkFavorite();
      this.loadReviews();
      // 重新获取详情以更新用户评分
      this.fetchBarDetail(this.data.barId);
    }
  }
});
