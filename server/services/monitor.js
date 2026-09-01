/**
 * API 额度监控服务（纯内存计数，不影响任何业务逻辑）
 *
 * 功能：
 * 1. 统计腾讯 LBS / 高德 每日调用量与失败量
 * 2. 每天 0 点自动重置计数（与 API 商额度重置周期一致）
 * 3. 用量达 70% / 90% 时在日志中告警，提醒额度即将耗尽
 * 4. 每小时输出一次汇总日志，便于 pm2 logs 回溯排查
 *
 * 说明：计数存在内存中，进程重启后清零；额度本身按天重置，
 *       重启导致的计数丢失不会造成额度超用，只影响当日统计精度。
 */

// 免费额度（次/日）
const FREE_QUOTA = {
  lbs: 10000, // 腾讯位置服务 WebService API 个人开发者
  amap: 5000  // 高德 Web服务 API 个人开发者（USER_DAILY_QUERY_OVER_LIMIT 为日额度超限）
};

// 阈值告警线
const WARN_LEVELS = [0.7, 0.9];

class ApiMonitor {
  constructor() {
    this.startedAt = new Date();
    this.date = this._today();
    // 每日计数：调用次数 + 失败次数
    this.counters = {
      lbs: { total: 0, fail: 0 },
      amap: { total: 0, fail: 0 }
    };
    // 已触发的告警（每天重置后清空，避免重复告警）
    this.warned = { lbs: {}, amap: {} };

    // 每小时汇总一次
    this.reportTimer = setInterval(() => {
      this._rollDate();
      const s = this.getStats();
      console.log(`[Monitor] 今日额度汇总 → LBS: ${s.lbs.total}/${s.quotas.lbs} (失败${s.lbs.fail}) | Amap: ${s.amap.total}/${s.quotas.amap} (失败${s.amap.fail})`);
    }, 60 * 60 * 1000);
    if (this.reportTimer.unref) this.reportTimer.unref();
  }

  /**
   * 记录一次 API 调用（在请求发出后调用）
   * @param {'lbs'|'amap'} api 服务名
   * @param {boolean} isError 该次调用是否失败（API 返回错误码/异常）
   */
  track(api, isError = false) {
    if (!this.counters[api]) return;
    this._rollDate();
    this.counters[api].total++;
    if (isError) this.counters[api].fail++;
    this._maybeWarn(api);
  }

  /**
   * 获取统计快照（供 /health 输出）
   */
  getStats() {
    this._rollDate();
    const make = (name) => {
      const c = this.counters[name];
      const quota = FREE_QUOTA[name];
      return {
        total: c.total,
        fail: c.fail,
        quota,
        usedPercent: quota > 0 ? Math.min(100, Math.round((c.total / quota) * 100)) : 0
      };
    };
    return {
      date: this.date,
      uptimeHours: Math.round((Date.now() - this.startedAt.getTime()) / 360000) / 10,
      quotas: FREE_QUOTA,
      lbs: make('lbs'),
      amap: make('amap')
    };
  }

  _today() {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD（UTC，与腾讯/高德额度日切接近）
  }

  // 跨天自动重置
  _rollDate() {
    const today = this._today();
    if (today !== this.date) {
      console.log(`[Monitor] 新的一天(${today})，额度计数已重置`);
      this.date = today;
      this.counters = {
        lbs: { total: 0, fail: 0 },
        amap: { total: 0, fail: 0 }
      };
      this.warned = { lbs: {}, amap: {} };
    }
  }

  // 阈值告警：只告警一次/每档/每天
  _maybeWarn(api) {
    const c = this.counters[api];
    const quota = FREE_QUOTA[api];
    if (!quota || c.total === 0) return;
    const ratio = c.total / quota;
    for (const level of WARN_LEVELS) {
      const key = String(level);
      if (ratio >= level && !this.warned[api][key]) {
        this.warned[api][key] = true;
        console.warn(`[Monitor] ⚠️ ${api.toUpperCase()} 额度已达 ${Math.round(level * 100)}%：今日已调用 ${c.total}/${quota} 次（失败 ${c.fail} 次），请留意！`);
      }
    }
  }
}

module.exports = new ApiMonitor();
