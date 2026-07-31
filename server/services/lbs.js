const axios = require('axios');
const config = require('../config');

const TENCENT_LBS_BASE_URL = 'https://apis.map.qq.com/ws/place/v1';

class LbsService {
  constructor() {
    this.key = config.tencent.lbsKey;
  }

  async searchNearby(lat, lng, radius = 10000, keyword = '', type = '') {
    if (!this.key) {
      console.warn('[LBS] 未配置腾讯LBS Key，将返回空结果');
      return [];
    }

    try {
      // 策略：默认使用多个关键词搜索，然后本地去重和过滤
      if (keyword) {
        // 用户指定了关键词，直接搜索
        const params = {
          key: this.key,
          keyword: keyword,
          boundary: `nearby(${lat},${lng},${radius})`,
          output: 'json',
          page_size: 20,
          page_index: 1,
          orderby: '_distance'
        };

        const response = await axios.get(`${TENCENT_LBS_BASE_URL}/search`, { params });
        
        if (response.data.status !== 0) {
          console.error('[LBS] 腾讯LBS返回错误:', response.data.message);
          return [];
        }

        let results = this.transformResults(response.data.data);
        results = this.filterBarResults(results, type);
        
        return results;
      } else {
        // 无关键词时，使用多个搜索词组合搜索，确保覆盖更多酒吧
        const searchTerms = ['酒吧', '精酿', '酒馆', 'pub', '清吧'];
        
        // 如果指定了类型，使用更精准的关键词
        if (type === '精酿吧') {
          return await this.multiKeywordSearch(lat, lng, radius, ['精酿', '精酿酒吧', 'brew', 'craft'], type);
        } else if (type === '鸡尾酒吧') {
          return await this.multiKeywordSearch(lat, lng, radius, ['鸡尾酒吧', 'cocktail', '调酒', 'whiskey'], type);
        } else if (type === '清吧') {
          return await this.multiKeywordSearch(lat, lng, radius, ['清吧', 'pub', '酒馆', 'lounge', '酒廊'], type);
        }
        
        // "全部"类型：使用多关键词搜索，获取更多结果
        return await this.multiKeywordSearch(lat, lng, radius, searchTerms, type);
      }
    } catch (error) {
      console.error('[LBS] 请求失败:', error.message);
      return [];
    }
  }
  
  // 多关键词搜索，合并去重后本地过滤
  async multiKeywordSearch(lat, lng, radius, keywords, type) {
    const allResults = [];
    const seenIds = new Set();
    
    for (const kw of keywords) {
      try {
        const params = {
          key: this.key,
          keyword: kw,
          boundary: `nearby(${lat},${lng},${radius})`,
          output: 'json',
          page_size: 20,
          page_index: 1,
          orderby: '_distance'
        };

        const response = await axios.get(`${TENCENT_LBS_BASE_URL}/search`, { params });
        
        if (response.data.status === 0 && response.data.data) {
          for (const item of response.data.data) {
            // 去重：使用id或title+location组合
            const uniqueKey = item.id || `${item.title}_${item.location.lat}_${item.location.lng}`;
            if (!seenIds.has(uniqueKey)) {
              seenIds.add(uniqueKey);
              allResults.push(item);
            }
          }
        }
      } catch (err) {
        // 单个关键词失败不影响其他
        console.warn(`[LBS] 关键词 "${kw}" 搜索失败:`, err.message);
      }
    }
    
    console.log(`[LBS] 多关键词搜索：共获取 ${allResults.length} 条原始结果`);
    
    let results = this.transformResults(allResults);
    results = this.filterBarResults(results, type);
    
    return results;
  }

  filterBarResults(results, type) {
    // 核心酒吧特征词 - 名称中包含则优先保留
    const barNameKeywords = ['酒吧', '清吧', '精酿吧', '鸡尾酒吧', '酒馆', '小酒馆', '居酒屋', '酒廊', '精酿', '鸡尾', '鸡尾酒', '啤酒吧', '啤酒屋', '小酒馆', '餐吧', '餐酒'];
    
    // 英文酒吧关键词
    const barEnglishKeywords = ['pub', 'bar', 'beer', 'craft', 'cocktail', 'bistro', 'lounge', 'speakeasy', 'taproom', 'brewpub', 'brew', 'tavern', 'inn', 'wine', 'whiskey', 'vodka', 'gin', 'rum', 'ale', 'stout', 'lager', 'weiss'];
    
    // 严格排除的关键词 - 这些明显不是酒吧
    const strictExcludeKeywords = [
      // 宠物/动物相关
      '猫咖', '猫咪', '宠物店', '撸狗', '撸猫', '吸猫', '羊驼', '浣熊', '龙猫',
      // 餐饮相关（不含酒吧的纯餐饮）
      '咖啡馆', '咖啡厅', '西餐厅', '日料店', '韩餐店', '火锅店', '烧烤店', '烤肉店', '串串店', '麻辣烫店', '牛排店', '寿司店', '快餐店', '小吃店',
      '酒店', '宾馆', '旅店', '客栈', '度假村', '旅馆', '旅社', '民宿', '青旅',
      // 生活服务
      '美容院', '美发厅', '美甲店', '手机维修', '电脑维修', '维修店',
      '购物中心', '购物广场', '百货大楼', '商场', '超市', '便利店',
      '洗衣店', '干洗店', '家政公司',
      // 医疗/教育/金融
      '医院', '诊所', '药店', '卫生室',
      '幼儿园', '小学', '中学', '大学', '培训机构',
      '银行', 'ATM机', '储蓄所', '信用社',
      // 运动/娱乐（非酒吧类）
      '健身房', '体育馆', '瑜伽馆', '体育中心',
      '电影院', '影院', '剧院', '游乐场', '电玩城', '游戏厅',
      // 其他
      '律师事务所', '会计事务所', '咨询公司',
      '装修公司', '装饰公司', '家居广场', '建材市场',
      '房产中介', '物业公司', '房地产',
      '网吧', '网咖', '电竞馆',
      '手机店', '数码城', '家电城',
      '眼镜店', '配镜中心',
      '花店', '花艺店',
      '书店', '图书馆',
      '琴行', '乐器店',
      '画廊', '画展',
      '婚纱摄影', '婚庆公司',
      '汽车维修', '洗车店', '二手车'
    ];
    
    const filtered = results.filter(item => {
      const nameLower = (item.name || '').toLowerCase();
      const tagsLower = (item.tags || '').toLowerCase();
      const categoryLower = (item.category || '').toLowerCase();
      
      // 1. 检查是否包含严格排除关键词
      const hasStrictExclude = strictExcludeKeywords.some(kw => 
        nameLower.includes(kw.toLowerCase())
      );
      
      // 2. 检查名称中是否有酒吧特征词（正向匹配）
      const hasBarNameKeyword = barNameKeywords.some(kw => 
        nameLower.includes(kw.toLowerCase())
      );
      
      // 3. 检查名称中是否有英文酒吧关键词
      const hasBarEnglishKeyword = barEnglishKeywords.some(kw => 
        nameLower.includes(kw.toLowerCase())
      );
      
      // ===== 过滤逻辑（放宽版） =====
      
      // 如果有严格排除词（猫咖、餐厅等），排除
      if (hasStrictExclude && !hasBarNameKeyword && !hasBarEnglishKeyword) {
        return false;
      }
      
      // 如果category明确是非酒吧类型，且名称没有酒吧特征，排除
      const nonBarCategory = ['餐饮服务', '中式餐厅', '西式餐厅', '咖啡厅', '茶馆', '购物服务', '生活服务', '医疗服务', '教育培训', '金融服务', '运动健身', '酒店住宿', '房地产', '家居家装', '婚纱摄影', '汽车服务', '手机通讯', '钟表眼镜', '鲜花绿植', '图书音像', '乐器行', '美术画廊', '网吧网咖'];
      const isNonBarCategory = nonBarCategory.some(kw => categoryLower.includes(kw.toLowerCase()));
      if (isNonBarCategory && !hasBarNameKeyword && !hasBarEnglishKeyword) {
        return false;
      }
      
      // 如果指定了类型，按类型进一步过滤
      if (type && type !== '全部') {
        // 先通过tag精确匹配
        if (item.tags === type) {
          return true;
        }
        // 如果tag没匹配，尝试通过关键词判断
        const typeKeywords = {
          '精酿吧': ['精酿', 'craft', 'beer', 'brew', 'taproom', 'brewpub', '鲜啤', 'IPA', '黑啤', '白啤'],
          '鸡尾酒吧': ['鸡尾', 'cocktail', '调酒', 'whiskey', '调酒师', 'martini', 'gin', '伏特加'],
          '清吧': ['清吧', 'pub', '酒馆', '酒廊', 'lounge', '居酒屋', 'tavern', '餐吧']
        };
        const keywords = typeKeywords[type] || [];
        if (keywords.some(k => nameLower.includes(k.toLowerCase()) || tagsLower.includes(k.toLowerCase()))) {
          return true;
        }
        return false;
      }
      
      // "全部"类型：只要没有严格排除词，就保留（因为是通过多关键词搜索获取的）
      return true;
    });
    
    console.log(`[LBS] 过滤完成: ${results.length} 条 → ${filtered.length} 条 (排除 ${results.length - filtered.length} 条)`);
    
    return filtered;
  }

  transformResults(lbsData) {
    if (!lbsData) return [];
    
    return lbsData.map(item => ({
      id: item.id || `lbs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: item.title,
      address: item.address || (item.address_components ? item.address_components.join('') : '暂无地址'),
      lat: parseFloat(item.location.lat),
      lng: parseFloat(item.location.lng),
      phone: item.tel || item.telephone || '',
      hours: (item.detail_info && item.detail_info.hours) || item.opening_hours || '',
      avg_rating: parseFloat((item.detail_info && (item.detail_info.rating || item.detail_info.overall_rating)) || item.score || 0),
      tags: this.classifyBar(item.title, (item.detail_info && item.detail_info.tag) || item.category || ''),
      photos: (item.detail_info && item.detail_info.photo && item.detail_info.photo.map(p => typeof p === 'string' ? p : p.url)) || 
              item.photos || [],
      distance: parseInt(item._distance) || 0,
      source: 'lbs',
      category: item.category || '',
      comment_count: parseInt((item.detail_info && (item.detail_info.comment_count || item.detail_info.review_count)) || 0)
    }));
  }

  classifyBar(name, tag) {
    const nameLower = name.toLowerCase();
    
    // 严格排除：如果名称包含这些词，直接返回空（不是酒吧）
    const strictExclude = ['猫咖', '猫咪', '宠物店', '撸狗', '撸猫', '吸猫', '羊驼', '宠物',
      '咖啡馆', '咖啡厅', '西餐厅', '日料店', '韩餐店', '火锅店', '烧烤店', '烤肉店',
      '酒店', '宾馆', '旅店', '客栈', '度假村', '旅馆', '青旅',
      '美容院', '美发厅', '美甲店', '手机维修', '电脑维修', '维修店',
      '购物中心', '购物广场', '百货大楼', '商场', '超市', '便利店',
      '洗衣店', '干洗店', '家政公司',
      '医院', '诊所', '药店', '卫生室',
      '幼儿园', '小学', '中学', '培训机构',
      '银行', 'ATM机', '储蓄所',
      '健身房', '体育馆', '瑜伽馆',
      '电影院', '影院', '剧院', '游乐场', '电玩城',
      '律师事务所', '会计事务所', '咨询公司',
      '装修公司', '装饰公司', '家居广场', '建材市场',
      '房产中介', '物业公司',
      '网吧', '网咖', '电竞馆',
      '手机店', '数码城', '家电城',
      '眼镜店', '配镜中心',
      '花店', '花艺店',
      '书店', '图书馆',
      '琴行', '乐器店',
      '画廊', '画展',
      '婚纱摄影', '婚庆公司',
      '汽车维修', '洗车店', '二手车'];
    
    const hasStrictExclude = strictExclude.some(kw => nameLower.includes(kw.toLowerCase()));
    
    // 如果名称中有严格排除词，不应该分类为酒吧类型
    if (hasStrictExclude) {
      return '';
    }
    
    // 精酿吧关键词
    const craftKeywords = ['精酿', 'craft', 'beer', 'brew', '酿造', '鲜啤', 'IPA', '黑啤', '白啤', '艾尔', '世涛', '拉格', 'weiss', 'stout', 'lager', 'ale'];
    // 鸡尾酒吧关键词
    const cocktailKeywords = ['鸡尾', 'cocktail', '调酒', 'whiskey', '威士忌', 'gin', '伏特加', '朗姆', 'martini', '调酒师'];
    // 清吧关键词
    const pubKeywords = ['清吧', 'pub', '酒馆', '小酒馆', '居酒屋', '酒廊', '酒吧', '餐吧', 'bistro', 'lounge', 'tavern'];
    
    // 按优先级匹配（精酿 > 鸡尾 > 清吧）
    if (craftKeywords.some(k => nameLower.includes(k.toLowerCase()))) {
      return '精酿吧';
    }
    if (cocktailKeywords.some(k => nameLower.includes(k.toLowerCase()))) {
      return '鸡尾酒吧';
    }
    if (pubKeywords.some(k => nameLower.includes(k.toLowerCase()))) {
      return '清吧';
    }
    
    // 如果名称没有明显的类型关键词，检查tag
    if (tag) {
      const tagLower = tag.toLowerCase();
      if (tagLower.includes('精酿') || tagLower.includes('啤酒') || tagLower.includes('brew') || tagLower.includes('beer')) {
        return '精酿吧';
      }
      if (tagLower.includes('鸡尾') || tagLower.includes('调酒') || tagLower.includes('cocktail')) {
        return '鸡尾酒吧';
      }
      if (tagLower.includes('清吧') || tagLower.includes('酒吧') || tagLower.includes('pub')) {
        return '清吧';
      }
    }
    
    // 对于特色酒吧（如"玄水屋"、"撞墙"等），默认返回"清吧"
    // 这是合理的默认值，因为大多数特色酒吧都是清吧类型
    return '清吧';
  }
}

module.exports = new LbsService();