const api = require('./utils/request');

App({
  onLaunch: function () {
    const hasConfirmedAge = wx.getStorageSync('hasConfirmedAge');
    this.globalData.hasConfirmedAge = !!hasConfirmedAge;

    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');
    if (token && userInfo) {
      this.globalData.token = token;
      this.globalData.userInfo = userInfo;
    }

    this.login().then(() => {
      this.notifyLoginListeners();
    });

    this.initNetworkMonitor();
  },

  onError: function (err) {
    console.error('[App] 全局错误:', err);
  },

  onUnhandledRejection: function (res) {
    console.error('[App] 未处理的 Promise 拒绝:', res.reason);
  },

  onPageNotFound: function () {
    wx.switchTab({ url: '/pages/index/index' });
  },

  initNetworkMonitor: function () {
    wx.getNetworkType({
      success: (res) => {
        this.globalData.networkType = res.networkType;
        this.globalData.isConnected = res.networkType !== 'none';
      }
    });
    wx.onNetworkStatusChange((res) => {
      this.globalData.networkType = res.networkType;
      this.globalData.isConnected = res.isConnected;
      this.networkListeners.forEach(cb => {
        try {
          cb(res);
        } catch (e) {
          console.error('[App] 网络监听器错误:', e);
        }
      });
    });
  },

  onNetworkChange: function (callback) {
    this.networkListeners.push(callback);
    // 立即返回当前状态
    callback({
      isConnected: this.globalData.isConnected,
      networkType: this.globalData.networkType
    });
  },

  offNetworkChange: function (callback) {
    const idx = this.networkListeners.indexOf(callback);
    if (idx > -1) this.networkListeners.splice(idx, 1);
  },

  networkListeners: [],

  globalData: {
    hasConfirmedAge: false,
    userLocation: null,
    token: '',
    userInfo: null,
    loginListeners: [],
    networkType: 'unknown',
    isConnected: true
  },

  onLoginComplete: function(callback) {
    if (this.globalData.userInfo && this.globalData.token) {
      callback(this.globalData.userInfo);
    } else {
      this.globalData.loginListeners.push(callback);
    }
  },

  notifyLoginListeners: function() {
    const listeners = this.globalData.loginListeners;
    this.globalData.loginListeners = [];
    listeners.forEach(cb => {
      try {
        cb(this.globalData.userInfo);
      } catch (e) {
        console.error('[Login] listener error:', e);
      }
    });
  },

  login: function () {
    return new Promise((resolve) => {
      wx.login({
        success: (res) => {
          if (res.code) {
            console.log('[Login] wx.login 成功, code:', res.code);
            this.sendCodeToBackend(res.code).then(resolve).catch((err) => {
              console.error('[Login] 后端登录失败:', err);
              this.initMockUser();
              resolve();
            });
          } else {
            console.error('[Login] wx.login 失败:', res);
            this.initMockUser();
            resolve();
          }
        },
        fail: (err) => {
          console.error('[Login] wx.login 调用失败:', err);
          this.initMockUser();
          resolve();
        }
      });
    });
  },

  sendCodeToBackend: function (code) {
    return new Promise((resolve, reject) => {
      api.login(code).then(res => {
        if (res.data) {
          const { token, user } = res.data;
          if (token && user) {
            this.globalData.token = token;
            this.globalData.userInfo = user;
            wx.setStorageSync('token', token);
            wx.setStorageSync('userInfo', user);
            console.log('[Login] 登录成功, 用户:', user.nickname);
            resolve(user);
          } else if (res.data.mock) {
            // 后端返回模拟用户
            const mockUser = res.data.user;
            this.globalData.userInfo = mockUser;
            wx.setStorageSync('userInfo', mockUser);
            console.log('[Login] 模拟登录成功, 用户:', mockUser.nickname);
            resolve(mockUser);
          } else {
            reject(res);
          }
        } else {
          reject(res);
        }
      }).catch(err => {
        reject(err);
      });
    });
  },

  initMockUser: function () {
    const existingUser = wx.getStorageSync('userInfo');
    if (existingUser) {
      this.globalData.userInfo = existingUser;
      return;
    }
    const mockUser = {
      id: 'mock_user_' + Date.now(),
      openid: 'mock_openid_' + Math.random().toString(36).substr(2, 8),
      nickname: '酒吧爱好者',
      avatar: '',
      signature: ''
    };
    this.globalData.userInfo = mockUser;
    wx.setStorageSync('userInfo', mockUser);
    console.log('[Login] 使用模拟用户:', mockUser.id);
  },

  isLoggedIn: function () {
    return !!(this.globalData.userInfo && this.globalData.userInfo.id);
  },

  getUserInfo: function () {
    return this.globalData.userInfo;
  },

  updateUserInfo: function (partialInfo) {
    const updatedUser = { ...this.globalData.userInfo, ...partialInfo };
    this.globalData.userInfo = updatedUser;
    wx.setStorageSync('userInfo', updatedUser);
    return updatedUser;
  },

  setAgeConfirmed: function () {
    this.globalData.hasConfirmedAge = true;
    wx.setStorageSync('hasConfirmedAge', 'true');
  },

  setUserLocation: function (location) {
    this.globalData.userLocation = location;
  }
});