const db = require('../utils/db');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const config = require('../config');

class UsersController {
  async login(req, res) {
    try {
      const { code } = req.body;
      
      if (!code) {
        return res.json({ code: -1, message: '缺少登录凭证' });
      }

      if (!config.wechat.appId || config.wechat.appId === 'your_wechat_appid') {
        return res.json({ 
          code: -1, 
          message: '微信登录未配置',
          data: { 
            mock: true, 
            user: {
              id: 'mock_user_' + Date.now(),
              openid: 'mock_openid_' + Math.random().toString(36).substr(2, 8),
              nickname: '酒吧爱好者',
              avatar: ''
            }
          }
        });
      }

      const wechatUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${config.wechat.appId}&secret=${config.wechat.secret}&js_code=${code}&grant_type=authorization_code`;
      
      console.log('[WeChat] 调用 jscode2session API:', wechatUrl.replace(config.wechat.secret, '***'));
      
      const wechatRes = await axios.get(wechatUrl, {
        timeout: 10000
      });

      const { openid, session_key, unionid, errcode, errmsg } = wechatRes.data;

      if (errcode) {
        console.error('[WeChat] 登录失败:', errcode, errmsg);
        return res.json({ code: -1, message: '微信登录失败: ' + (errmsg || '未知错误') });
      }

      console.log('[WeChat] 获取 openid 成功:', openid);

      const users = await db.query('SELECT * FROM users WHERE openid = ?', [openid]);
      
      let user;
      if (users.length === 0) {
        const id = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        await db.query(
          'INSERT INTO users (id, openid, nickname, avatar) VALUES (?, ?, ?, ?)',
          [id, openid, '酒吧爱好者', '']
        );
        user = { id, openid, nickname: '酒吧爱好者', avatar: '' };
        console.log('[Users] 新用户注册:', id);
      } else {
        user = users[0];
        console.log('[Users] 老用户登录:', user.id);
      }

      const token = jwt.sign(
        { userId: user.id, openid: user.openid },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
      );

      res.json({ 
        code: 0, 
        data: { 
          token,
          user: {
            id: user.id,
            openid: user.openid,
            nickname: user.nickname,
            avatar: user.avatar,
            signature: user.signature || ''
          }
        }
      });
    } catch (error) {
      console.error('[Users] 微信登录异常:', error.message);
      res.json({ code: -1, message: '登录失败，请重试' });
    }
  }

  async getUser(req, res) {
    try {
      const { openid } = req.params;
      const users = await db.query('SELECT * FROM users WHERE openid = ?', [openid]);
      
      if (users.length === 0) {
        return res.json({ code: -1, message: '用户不存在' });
      }
      
      res.json({ code: 0, data: users[0] });
    } catch (error) {
      console.error('[Users] 获取用户失败:', error);
      res.json({ code: -1, message: '获取用户失败' });
    }
  }

  async createUser(req, res) {
    try {
      const { openid, nickname, avatar } = req.body;
      const id = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      
      await db.query(
        'INSERT INTO users (id, openid, nickname, avatar) VALUES (?, ?, ?, ?)',
        [id, openid, nickname || '酒吧爱好者', avatar || '']
      );
      
      res.json({ code: 0, data: { id, openid, nickname, avatar } });
    } catch (error) {
      console.error('[Users] 创建用户失败:', error);
      res.json({ code: -1, message: '创建用户失败' });
    }
  }

  async updateUser(req, res) {
    try {
      const { id } = req.params;
      const { nickname, avatar, signature } = req.body;
      
      await db.query(
        'UPDATE users SET nickname = COALESCE(?, nickname), avatar = COALESCE(?, avatar), signature = COALESCE(?, signature) WHERE id = ?',
        [nickname || null, avatar || null, signature || null, id]
      );
      
      const users = await db.query('SELECT * FROM users WHERE id = ?', [id]);
      
      res.json({ 
        code: 0, 
        message: '更新成功',
        data: users[0] || null
      });
    } catch (error) {
      console.error('[Users] 更新用户失败:', error);
      res.json({ code: -1, message: '更新用户失败' });
    }
  }
}

module.exports = new UsersController();