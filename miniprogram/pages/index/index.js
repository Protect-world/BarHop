const app = getApp();
const api = require('../../utils/request');
const imageUtil = require('../../utils/image');
const searchHistory = require('../../utils/searchHistory');

Page({
  data: {
    showAgeModal: true,
    userLocation: null,
    userLocationLatitude: 30.5728,
    userLocationLongitude: 104.0668,
    bars: [],
    allBars: [],
    displayBars: [],
    displayedCount: 0,
    isLoadingMore: false,
    markers: [],
    userMarker: null,
    searchKeyword: '',
    selectedCategory: '',
    sortType: 'distance',
    loading: false,
    refreshing: false,
    userInfo: null,
    isLoggingIn: true,
    pageVisible: true,
    searchHistory: [],
    filteredHistory: [],
    showHistory: false,
    activeBarIndex: -1,
    scrollToBarId: '',
    popupBar: null,
    showBarPopup: false,
    mapCollapsed: false
  },

  toggleMap: function () {
    this.setData({ mapCollapsed: !this.data.mapCollapsed });
  },

  onLoad: function () {
    this.initUserInfo();
    this.checkAgeConfirmation();
    this.loadSearchHistory();
    
    // 创建地图上下文
    this.mapContext = wx.createMapContext('map', this);
    
    app.onLoginComplete((userInfo) => {
      this.setData({ 
        userInfo, 
        isLoggingIn: false 
      });
    });
  },

  onShow: function () {
    this.setData({ pageVisible: true });
    this.initUserInfo();
  },

  onHide: function () {
    this.setData({ pageVisible: false });
  },

  initUserInfo: function () {
    const userInfo = app.getUserInfo();
    if (userInfo) {
      this.setData({ 
        userInfo, 
        isLoggingIn: false 
      });
    }
  },

  checkAgeConfirmation: function () {
    const hasConfirmed = app.globalData.hasConfirmedAge;
    if (hasConfirmed) {
      this.setData({ showAgeModal: false });
      this.getUserLocation();
    }
  },

  handleAgeConfirm: function () {
    app.setAgeConfirmed();
    this.setData({ showAgeModal: false });
    this.getUserLocation();
  },

  handleAgeReject: function () {
    wx.showModal({
      title: '温馨提示',
      content: '未满18岁禁止饮酒，感谢您的理解',
      showCancel: false,
      confirmText: '我知道了',
      success: () => {
        wx.exitMiniProgram();
      }
    });
  },

  getUserLocation: function () {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        app.setUserLocation({
          latitude: res.latitude,
          longitude: res.longitude
        });
        const userMarker = {
          id: 9999,
          latitude: res.latitude,
          longitude: res.longitude,
          iconPath: '/images/user-location.png',
          width: 28,
          height: 28,
          callout: {
            content: '我的位置',
            color: '#FFFFFF',
            fontSize: 12,
            borderRadius: 8,
            padding: 6,
            display: 'BYCLICK',
            bgColor: 'rgba(30, 144, 255, 0.9)',
            textAlign: 'center'
          }
        };
        this.setData({
          userLocationLatitude: res.latitude,
          userLocationLongitude: res.longitude,
          userLocation: {
            latitude: res.latitude,
            longitude: res.longitude
          },
          userMarker
        }, () => {
          // setData 完成后，地图组件会自动移动到新的经纬度
          // 延迟一小会儿后刷新酒吧数据
          setTimeout(() => {
            this.fetchBars();
          }, 300);
        });
      },
      fail: () => {
        wx.showModal({
          title: '位置授权',
          content: '需要获取您的位置来推荐附近酒吧，是否手动选择位置？',
          success: (modalRes) => {
            if (modalRes.confirm) {
              this.chooseLocationManually();
            } else {
              this.fetchBars();
            }
          }
        });
      }
    });
  },

  chooseLocationManually: function () {
    wx.chooseLocation({
      success: (res) => {
        app.setUserLocation({
          latitude: res.latitude,
          longitude: res.longitude
        });
        const userMarker = {
          id: 9999,
          latitude: res.latitude,
          longitude: res.longitude,
          iconPath: '/images/user-location.png',
          width: 28,
          height: 28,
          callout: {
            content: res.name || '选中位置',
            color: '#FFFFFF',
            fontSize: 12,
            borderRadius: 8,
            padding: 6,
            display: 'BYCLICK',
            bgColor: 'rgba(30, 144, 255, 0.9)',
            textAlign: 'center'
          }
        };
        this.setData({
          userLocationLatitude: res.latitude,
          userLocationLongitude: res.longitude,
          userLocation: {
            latitude: res.latitude,
            longitude: res.longitude
          },
          userMarker
        }, () => {
          // setData 完成后，地图组件会自动移动到新的经纬度
          setTimeout(() => {
            this.fetchBars();
          }, 300);
        });
      },
      fail: () => {
        this.fetchBars();
      }
    });
  },

  fetchBars: function () {
    const { userLocationLatitude, userLocationLongitude, searchKeyword, selectedCategory, sortType, userMarker } = this.data;
    
    this.setData({ loading: true });

    api.getNearbyBars({
      lat: userLocationLatitude,
      lng: userLocationLongitude,
      radius: 10000,
      keyword: searchKeyword,
      type: selectedCategory
    }).then(res => {
      let allBars = imageUtil.ensureBarListPhotos(res.data || []);
      // 处理评分显示：高德 > 用户评分 > 暂无
      allBars = allBars.map(bar => {
        const amapRating = parseFloat(bar.avg_rating) || 0;
        const userRating = parseFloat(bar.user_rating) || 0;
        const userReviewCount = parseInt(bar.user_review_count) || 0;
        if (amapRating > 0) {
          bar.display_rating = amapRating.toFixed(1);
        } else if (userReviewCount > 0 && userRating > 0) {
          bar.display_rating = userRating.toFixed(1);
        } else {
          bar.display_rating = '';
        }
        return bar;
      });
      const sortedBars = this.sortBars(allBars, sortType);
      const barMarkers = this.createMarkers(sortedBars);

      // 合并用户位置marker和酒吧marker
      const markers = userMarker ? [...barMarkers, userMarker] : barMarkers;

      // 默认只展示前10条
      const displayCount = Math.min(10, sortedBars.length);
      const displayBars = sortedBars.slice(0, displayCount);

      this.setData({
        bars: sortedBars,
        allBars: sortedBars,
        displayBars,
        displayedCount: displayCount,
        markers,
        loading: false,
        refreshing: false
      });
    }).catch(err => {
      console.error('获取酒吧失败:', err);
      this.setData({ loading: false, refreshing: false });
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    });
  },

  loadMoreBars: function () {
    const { allBars, displayedCount, isLoadingMore } = this.data;
    
    if (isLoadingMore) return;
    if (displayedCount >= allBars.length) return;
    if (displayedCount >= 20) return;
    
    this.setData({ isLoadingMore: true });
    
    // 每次加载10条，最多20条
    setTimeout(() => {
      const newCount = Math.min(displayedCount + 10, Math.min(allBars.length, 20));
      const displayBars = allBars.slice(0, newCount);
      
      this.setData({
        displayBars,
        displayedCount: newCount,
        isLoadingMore: false
      });
    }, 300);
  },

  sortBars: function (bars, sortType) {
    const sorted = [...bars];
    switch (sortType) {
      case 'rating':
        sorted.sort((a, b) => (b.avg_rating || 0) - (a.avg_rating || 0));
        break;
      case 'name':
        sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        break;
      case 'distance':
      default:
        sorted.sort((a, b) => (a.distance || 99999) - (b.distance || 99999));
        break;
    }
    return sorted;
  },

  createMarkers: function (bars) {
    if (!bars || bars.length === 0) {
      return [];
    }

    // 记录已使用的经纬度，用于检测重叠
    const usedCoords = new Set();

    return bars.map((bar, index) => {
      // 确保经纬度是数字类型
      const lat = parseFloat(bar.lat);
      const lng = parseFloat(bar.lng);
      if (isNaN(lat) || isNaN(lng)) return null;

      // 检测重叠：如果同一位置有多个酒吧，添加微小偏移
      const coordKey = `${lat.toFixed(6)}_${lng.toFixed(6)}`;
      let finalLat = lat;
      let finalLng = lng;
      if (usedCoords.has(coordKey)) {
        // 添加微小偏移（约10-20米），避免标记完全重叠
        const offset = 0.00015 * (Math.floor(Math.random() * 3) + 1);
        finalLat = lat + offset;
        finalLng = lng + offset;
      }
      usedCoords.add(coordKey);

      return {
        id: index + 1,
        barId: bar.id,
        barIndex: index,
        latitude: finalLat,
        longitude: finalLng,
        iconPath: '/images/pin.png',
        width: 32,
        height: 40,
        callout: {
          content: bar.name,
          color: '#FFFFFF',
          fontSize: 13,
          borderRadius: 12,
          padding: 8,
          display: 'BYCLICK',
          bgColor: 'rgba(233, 69, 96, 0.95)',
          textAlign: 'center',
          borderWidth: 0,
          borderColor: 'rgba(233, 69, 96, 0.95)'
        }
      };
    }).filter(marker => marker !== null);
  },

  onSearchInput: function (e) {
    const keyword = e.detail.value;
    const filtered = this._filterHistory(keyword, this.data.searchHistory);
    
    this.setData({ 
      searchKeyword: keyword,
      filteredHistory: filtered,
      showHistory: true
    });
  },

  onSearch: function () {
    const { searchKeyword } = this.data;
    if (searchKeyword.trim()) {
      searchHistory.addHistory(searchKeyword);
      this.loadSearchHistory();
    }
    this.setData({ showHistory: false });
    this.fetchBars();
  },

  onSearchClear: function () {
    this.setData({ 
      searchKeyword: '',
      filteredHistory: this.data.searchHistory,
      showHistory: this.data.searchHistory.length > 0
    });
    this.fetchBars();
  },

  loadSearchHistory: function () {
    const history = searchHistory.getHistory();
    const formattedHistory = history.map(item => ({
      ...item,
      timeText: searchHistory.formatDate(item.timestamp)
    }));
    
    const filtered = this._filterHistory(this.data.searchKeyword, formattedHistory);
    
    this.setData({ 
      searchHistory: formattedHistory,
      filteredHistory: filtered
    });
  },

  onHistoryTap: function (e) {
    const keyword = e.currentTarget.dataset.keyword;
    this.setData({ 
      searchKeyword: keyword,
      showHistory: false
    });
    searchHistory.addHistory(keyword);
    this.loadSearchHistory();
    this.fetchBars();
  },

  onHistoryDelete: function (e) {
    const keyword = e.currentTarget.dataset.keyword;
    wx.showModal({
      title: '删除历史',
      content: `确定要删除"${keyword}"吗？`,
      success: (res) => {
        if (res.confirm) {
          searchHistory.removeHistory(keyword);
          this.loadSearchHistory();
          wx.showToast({ title: '已删除', icon: 'none' });
        }
      }
    });
  },

  onHistoryClear: function () {
    wx.showModal({
      title: '清空历史',
      content: '确定要清空所有搜索历史吗？',
      success: (res) => {
        if (res.confirm) {
          searchHistory.clearHistory();
          this.setData({ 
            searchHistory: [],
            filteredHistory: [],
            showHistory: false 
          });
          wx.showToast({ title: '已清空', icon: 'none' });
        }
      }
    });
  },

  onSearchBlur: function () {
    setTimeout(() => {
      this.setData({ showHistory: false });
    }, 300);
  },

  onSearchFocus: function () {
    const { searchHistory: history, searchKeyword } = this.data;
    const filtered = this._filterHistory(searchKeyword, history);
    this.setData({ 
      showHistory: true,
      filteredHistory: filtered
    });
  },

  onCategoryChange: function (e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ selectedCategory: type });
    this.fetchBars();
  },

  onSortChange: function (e) {
    const sortType = e.currentTarget.dataset.type;
    this.setData({ sortType });
    const sortedBars = this.sortBars(this.data.allBars, sortType);
    const displayCount = Math.min(10, sortedBars.length);
    const displayBars = sortedBars.slice(0, displayCount);
    this.setData({ 
      allBars: sortedBars,
      displayBars,
      displayedCount: displayCount
    });
  },

  goToDetail: function (e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/detail/detail?id=${id}`
    });
  },

  goToProfile: function () {
    wx.navigateTo({ url: '/pages/profile/profile' });
  },

  onChooseAvatar: function (e) {
    if (!e.detail.avatarUrl) return;
    const avatar = e.detail.avatarUrl;
    const userInfo = { ...this.data.userInfo, avatar };
    this.setData({ userInfo });
    app.updateUserInfo({ avatar });
    this.syncUserToBackend();
    wx.showToast({ title: '头像已更新', icon: 'none' });
  },

  onNicknameChange: function (e) {
    const nickname = e.detail.value;
    if (!nickname) return;
    const userInfo = { ...this.data.userInfo, nickname };
    this.setData({ userInfo });
    app.updateUserInfo({ nickname });
    this.syncUserToBackend();
  },

  async syncUserToBackend() {
    const { userInfo } = this.data;
    try {
      await api.put(`/api/users/${userInfo.id}`, {
        nickname: userInfo.nickname,
        avatar: userInfo.avatar,
        signature: userInfo.signature
      });
      console.log('[Index] 用户信息已同步');
    } catch (err) {
      console.error('[Index] 同步用户信息失败:', err);
    }
  },

  onMarkerClick: function (e) {
    const markerId = e.markerId;
    // 用户位置标记（id=9999）不需要跳转
    if (markerId === 9999) {
      return;
    }
    // 点击marker时，微信小程序会自动显示callout
    const marker = this.data.markers.find(m => m.id === markerId);
    if (!marker || marker.barIndex === undefined) return;

    const { barIndex } = marker;
    const { displayedCount, allBars } = this.data;

    if (barIndex < displayedCount) {
      // 场景A：在已展示列表中 → 直接滚动 + 高亮
      this.scrollToBar(barIndex);
    } else if (barIndex < 20) {
      // 场景B：在 20 条内但未加载 → 扩展 displayBars 后滚动 + 高亮
      const newCount = barIndex + 1;
      this.setData({
        displayBars: allBars.slice(0, newCount),
        displayedCount: newCount
      }, () => this.scrollToBar(barIndex));
    } else {
      // 场景C：超出 20 条上限 → 显示底部弹窗
      const bar = allBars[barIndex];
      if (bar) {
        this.setData({ popupBar: bar, showBarPopup: true });
      }
    }
  },

  scrollToBar: function (barIndex) {
    this.setData({
      activeBarIndex: barIndex,
      scrollToBarId: `bar-${barIndex}`
    });
    // 2 秒后取消高亮
    if (this._highlightTimer) clearTimeout(this._highlightTimer);
    this._highlightTimer = setTimeout(() => {
      if (this.data.activeBarIndex === barIndex) {
        this.setData({ activeBarIndex: -1 });
      }
    }, 2000);
  },

  hideBarPopup: function () {
    this.setData({ showBarPopup: false });
  },

  goToDetailFromPopup: function () {
    const bar = this.data.popupBar;
    if (bar) {
      this.setData({ showBarPopup: false });
      wx.navigateTo({ url: `/pages/detail/detail?id=${bar.id}` });
    }
  },

  onCalloutTap: function (e) {
    const markerId = e.markerId;
    // 用户位置标记（id=9999）不需要跳转
    if (markerId === 9999) {
      return;
    }
    // 通过markerId找到对应的marker，再获取barId
    const marker = this.data.markers.find(m => m.id === markerId);
    if (marker && marker.barId) {
      wx.navigateTo({
        url: `/pages/detail/detail?id=${marker.barId}`
      });
    } else {
      // 兼容处理：通过bars数组查找
      const bar = this.data.bars[markerId - 1];
      if (bar) {
        wx.navigateTo({
          url: `/pages/detail/detail?id=${bar.id}`
        });
      }
    }
  },

  onRegionChange: function () {
    // Map region change handler
  },

  onImageError: function (e) {
    const { index } = e.currentTarget.dataset;
    const { allBars } = this.data;
    const DEFAULT_IMG = '/images/默认图.png';
    
    if (index !== undefined && allBars[index]) {
      const bar = allBars[index];
      if (!bar._imgErrorHandled) {
        // 替换失败的图片为默认图
        allBars[index].photos = [DEFAULT_IMG];
        allBars[index]._imgErrorHandled = true;
        
        // 同时更新 displayBars
        const { displayBars } = this.data;
        if (displayBars[index]) {
          displayBars[index].photos = [DEFAULT_IMG];
        }
        
        this.setData({
          allBars,
          displayBars
        });
      }
    }
  },

  onRefresh: function () {
    this.setData({ refreshing: true });
    this.fetchBars();
  },

  onPullDownRefresh: function () {
    // 已改为scroll-view下拉刷新，此处保留兼容
  },

  formatDistance: function (distance) {
    if (distance < 1000) {
      return `${distance}m`;
    }
    return `${(distance / 1000).toFixed(1)}km`;
  },

  _filterHistory: function (keyword, history) {
    if (!keyword || !keyword.trim()) {
      return history;
    }
    const lowerKeyword = keyword.toLowerCase();
    return history.filter(item =>
      item.keyword.toLowerCase().includes(lowerKeyword)
    ).slice(0, 5);
  }
});