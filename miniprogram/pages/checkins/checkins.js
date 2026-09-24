const api = require('../../utils/request');
const app = getApp();

const PAGE_SIZE = 20;

// 格式化时间：2026-09-24T13:22:00.000Z -> 2026-09-24 21:22
function formatTime(str) {
  if (!str) return '';
  const d = new Date(str);
  if (isNaN(d.getTime())) return str;
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

Page({
  data: {
    list: [],
    total: 0,
    page: 1,
    loading: true,
    loadingMore: false,
    noMore: false,
    user_id: ''
  },

  onLoad: function () {
    const userInfo = app.getUserInfo();
    this.setData({ user_id: userInfo ? userInfo.id : '' });
    this.loadFirst();
  },

  onShow: function () {
    // 从详情页打卡返回后刷新
    if (this.data.list.length > 0) {
      this.refresh();
    }
  },

  loadFirst: function () {
    this.setData({ page: 1, list: [], noMore: false, loading: true });
    this.fetchList(true);
  },

  refresh: function () {
    this.setData({ page: 1, list: [], noMore: false });
    this.fetchList(true);
  },

  fetchList: function (isFirst) {
    const { user_id, page } = this.data;
    if (!user_id) {
      this.setData({ loading: false });
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    api.getUserCheckins(user_id, { page, pageSize: PAGE_SIZE }).then(res => {
      if (res.code === 0) {
        const incoming = (res.data.list || []).map(item => ({
          ...item,
          last_checkin_at: formatTime(item.last_checkin_at),
          first_checkin_at: formatTime(item.first_checkin_at)
        }));
        const list = isFirst ? incoming : this.data.list.concat(incoming);
        this.setData({
          list,
          total: res.data.total || 0,
          loading: false,
          loadingMore: false,
          noMore: list.length >= (res.data.total || 0)
        });
      } else {
        this.setData({ loading: false, loadingMore: false });
        wx.showToast({ title: res.message || '加载失败', icon: 'none' });
      }
    }).catch(err => {
      console.error('[Checkins] 加载失败:', err);
      this.setData({ loading: false, loadingMore: false });
    });
  },

  onPullDownRefresh: function () {
    this.refresh();
    setTimeout(() => wx.stopPullDownRefresh(), 800);
  },

  onReachBottom: function () {
    if (this.data.noMore || this.data.loadingMore || this.data.loading) return;
    this.setData({ loadingMore: true, page: this.data.page + 1 });
    this.fetchList(false);
  },

  goBarDetail: function (e) {
    const barId = e.currentTarget.dataset.barid;
    if (barId) {
      wx.navigateTo({ url: `/pages/detail/detail?id=${barId}` });
    }
  },

  goDiscover: function () {
    wx.switchTab({ url: '/pages/index/index' });
  },

  previewImage: function (e) {
    const { urls, current } = e.currentTarget.dataset;
    if (urls && urls.length) {
      wx.previewImage({ current, urls });
    }
  }
});
