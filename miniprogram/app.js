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
  },

  globalData: {
    hasConfirmedAge: false,
    userLocation: null,
    token: '',
    userInfo: null,
    loginListeners: []
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