const app = getApp();

Component({
  data: {
    isConnected: true
  },

  lifetimes: {
    attached() {
      // 初始同步当前网络状态
      this.setData({ isConnected: app.globalData.isConnected });

      // 注册网络状态变化监听
      this._networkCallback = (res) => {
        this.setData({ isConnected: res.isConnected });
      };
      app.onNetworkChange(this._networkCallback);
    },

    detached() {
      // 组件销毁时移除监听，避免内存泄漏
      app.offNetworkChange(this._networkCallback);
    }
  }
});
