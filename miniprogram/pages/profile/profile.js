const app = getApp();
const api = require('../../utils/request');
const config = require('../../utils/config');

Page({
  data: {
    userInfo: null,
    nickname: '',
    avatar: '',
    signature: '',
    loading: false,
    checkinCount: 0,
    originalData: null
  },

  onLoad() {
    const userInfo = app.getUserInfo();
    if (userInfo) {
      this.setData({
        userInfo,
        nickname: userInfo.nickname || '',
        avatar: userInfo.avatar || '',
        signature: userInfo.signature || '',
        originalData: {
          nickname: userInfo.nickname || '',
          avatar: userInfo.avatar || '',
          signature: userInfo.signature || ''
        }
      });
      console.log('[Profile] 用户信息加载成功:', userInfo);
      this.loadCheckinCount();
    } else {
      console.warn('[Profile] 未获取到用户信息');
      wx.showToast({ title: '请先登录', icon: 'none' });
    }
  },

  onChooseAvatar(e) {
    if (!e.detail.avatarUrl) return;
    const avatar = e.detail.avatarUrl;
    this.setData({ avatar });
  },

  // 头像是否为可长期使用的地址（服务器 URL 或站内相对路径）
  // chooseAvatar 返回的是临时路径（http://tmp/xxx 或 wxfile://tmp_xxx），
  // 重启小程序即失效，必须先上传换取服务器 URL 才能持久回显
  _isPersistentUrl(url) {
    if (!url) return false;
    if (url.startsWith('/uploads/')) return true;
    // 临时文件特征：tmp 路径 / wxfile 协议，一律视为需要重新上传
    if (url.indexOf('tmp') !== -1 || url.startsWith('wxfile://')) return false;
    return url.startsWith('http://') || url.startsWith('https://');
  },

  onNicknameInput(e) {
    const nickname = e.detail.value;
    this.setData({ nickname });
    console.log('[Profile] 昵称输入:', nickname);
  },

  onSignatureInput(e) {
    const signature = e.detail.value;
    this.setData({ signature });
    console.log('[Profile] 签名输入:', signature);
  },

  goCheckins() {
    wx.navigateTo({ url: '/pages/checkins/checkins' });
  },

  loadCheckinCount() {
    const { userInfo } = this.data;
    if (!userInfo || !userInfo.id) return;
    api.getUserCheckins(userInfo.id, { page: 1, pageSize: 1 }).then(res => {
      if (res.code === 0) {
        this.setData({ checkinCount: res.data.total || 0 });
      }
    }).catch(() => {});
  },

  async onSave() {
    const { nickname, avatar, signature, userInfo } = this.data;
    
    if (!userInfo || !userInfo.id) {
      wx.showToast({ title: '用户信息异常', icon: 'none' });
      return;
    }

    if (!nickname.trim()) {
      wx.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }

    this.setData({ loading: true });
    
    try {
      // ★ 临时头像必须先上传换成服务器永久 URL，否则存库的是 http://tmp/xxx，重启即失效
      let finalAvatar = avatar;
      if (finalAvatar && !this._isPersistentUrl(finalAvatar)) {
        console.log('[Profile] 检测到临时头像，上传中...', finalAvatar);
        const uploaded = await api.uploadImage(finalAvatar);
        finalAvatar = uploaded.url;
        this.setData({ avatar: finalAvatar });
        console.log('[Profile] 头像上传成功:', finalAvatar);
      }

      console.log('[Profile] 保存用户信息:', { nickname, avatar: finalAvatar, signature });
      const result = await api.put(`/api/users/${userInfo.id}`, {
        nickname: nickname.trim(),
        avatar: finalAvatar,
        signature: signature.trim()
      });
      console.log('[Profile] 保存结果:', result);

      const updatedUser = result.data || {
        ...userInfo,
        nickname: nickname.trim(),
        avatar: finalAvatar,
        signature: signature.trim()
      };

      app.globalData.userInfo = updatedUser;
      wx.setStorageSync('userInfo', updatedUser);
      app.updateUserInfo(updatedUser);

      wx.showToast({ title: '保存成功', icon: 'success' });
      
      setTimeout(() => {
        wx.navigateBack();
      }, 1000);
    } catch (err) {
      console.error('[Profile] 保存失败:', err);
      wx.showToast({ title: err.message || '保存失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onReset() {
    const { originalData } = this.data;
    if (originalData) {
      this.setData({
        nickname: originalData.nickname,
        avatar: originalData.avatar,
        signature: originalData.signature
      });
      wx.showToast({ title: '已重置', icon: 'none' });
      console.log('[Profile] 重置表单');
    }
  }
});