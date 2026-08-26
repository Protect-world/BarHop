const app = getApp();
const request = require('../../utils/request.js');
const config = require('../../utils/config.js');

const DEFAULT_BAR_IMAGE = '/images/默认图.png';

Page({
  data: {
    barId: '',
    bar: {},
    barImage: DEFAULT_BAR_IMAGE,
    selectedRating: 0,
    ratingText: '请选择评分',
    content: '',
    images: [],
    uploading: false,
    user_id: '',
    isEditing: false,
    existingReview: null
  },

  onLoad: function(options) {
    const barId = options.bar_id;
    const userInfo = app.getUserInfo();
    
    this.setData({ 
      barId,
      user_id: userInfo ? userInfo.id : ''
    });
    
    this.loadBarInfo();
    this.loadExistingReview();
  },

  loadBarInfo: function() {
    request.getBarById(this.data.barId).then(res => {
      if (res.code === 0) {
        const bar = res.data;
        const barImage = (bar.photos && bar.photos.length > 0) ? bar.photos[0] : DEFAULT_BAR_IMAGE;
        this.setData({ 
          bar,
          barImage 
        });
      }
    }).catch(err => {
      console.error('加载酒吧信息失败:', err);
    });
  },

  loadExistingReview: function() {
    if (!this.data.user_id || !this.data.barId) return;
    
    request.get(`/api/reviews/bar/${this.data.barId}/user?user_id=${this.data.user_id}`).then(res => {
      if (res.code === 0 && res.data) {
        const review = res.data;
        this.setData({
          selectedRating: review.rating,
          content: review.content || '',
          images: review.images || [],
          isEditing: true,
          existingReview: review
        });
      }
    }).catch(err => {
      console.log('暂无历史评价，创建新评价');
    });
  },

  selectRating: function(e) {
    const rating = e.currentTarget.dataset.rating;
    const ratingText = rating > 0 ? rating + '.0分' : '请选择评分';
    this.setData({ 
      selectedRating: rating,
      ratingText: ratingText
    });
  },

  onContentInput: function(e) {
    this.setData({ content: e.detail.value });
  },

  uploadImage: function(filePath) {
    return new Promise((resolve, reject) => {
      const token = wx.getStorageSync(config.CACHE_KEYS.TOKEN) || '';
      
      wx.uploadFile({
        url: `${config.API_BASE_URL}/api/upload/image`,
        filePath: filePath,
        name: 'image',
        header: token ? { 'Authorization': 'Bearer ' + token } : {},
        success: (res) => {
          try {
            const data = JSON.parse(res.data);
            if (data.code === 0) {
              // 拼接完整URL
              let url = data.data.url;
              if (url.startsWith('/uploads/')) {
                url = config.API_BASE_URL + url;
              }
              resolve(url);
            } else {
              reject(data.message || '上传失败');
            }
          } catch (e) {
            reject('上传响应解析失败');
          }
        },
        fail: (err) => {
          reject('上传失败');
        }
      });
    });
  },

  chooseImage: async function() {
    if (this.data.uploading) return;
    
    const remaining = 9 - this.data.images.length;
    if (remaining <= 0) {
      wx.showToast({ title: '最多上传9张图片', icon: 'none' });
      return;
    }

    wx.chooseImage({
      count: remaining,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const tempFiles = res.tempFilePaths;
        this.setData({ uploading: true });
        
        wx.showLoading({ title: '上传中...', mask: true });
        
        const uploadedUrls = [];
        for (let i = 0; i < tempFiles.length; i++) {
          try {
            const url = await this.uploadImage(tempFiles[i]);
            uploadedUrls.push(url);
          } catch (err) {
            console.error('上传图片失败:', err);
          }
        }
        
        wx.hideLoading();
        this.setData({ uploading: false });
        
        if (uploadedUrls.length > 0) {
          this.setData({
            images: [...this.data.images, ...uploadedUrls]
          });
          wx.showToast({ title: `已上传${uploadedUrls.length}张`, icon: 'success' });
        }
      }
    });
  },

  deleteImage: function(e) {
    const index = e.currentTarget.dataset.index;
    const images = this.data.images.slice();
    images.splice(index, 1);
    this.setData({ images });
  },

  previewImage: function(e) {
    const index = e.currentTarget.dataset.index;
    wx.previewImage({
      current: this.data.images[index],
      urls: this.data.images
    });
  },

  submitReview: function() {
    if (this.data.selectedRating === 0) {
      wx.showToast({ title: '请选择评分', icon: 'none' });
      return;
    }

    if (!this.data.user_id) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    wx.showLoading({ title: this.data.isEditing ? '更新中...' : '提交中...' });

    request.createReview({
      user_id: this.data.user_id,
      bar_id: this.data.barId,
      rating: this.data.selectedRating,
      content: this.data.content,
      images: this.data.images
    }).then(res => {
      wx.hideLoading();
      if (res.code === 0) {
        wx.showToast({ 
          title: this.data.isEditing ? '评价已更新' : '评价成功', 
          icon: 'success' 
        });
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      } else {
        wx.showToast({ title: res.message || '提交失败', icon: 'none' });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('提交评价失败:', err);
      wx.showToast({ title: '提交失败', icon: 'none' });
    });
  }
});
