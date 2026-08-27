const config = {
  API_BASE_URL: 'https://barhop.asia',
  
  TIMEOUT: 60000,
  
  PAGE_SIZE: 20,
  
  CACHE_KEYS: {
    TOKEN: 'token',
    USER_INFO: 'userInfo',
    AGE_CONFIRMED: 'hasConfirmedAge',
    SEARCH_HISTORY: 'searchHistory',
    USER_LOCATION: 'userLocation'
  },
  
  DEFAULT_AVATAR: '/images/home.png',
  
  MAX_UPLOAD_SIZE: 10 * 1024 * 1024,
  
  SEARCH_HISTORY_MAX: 10,
  
  MAP: {
    DEFAULT_CITY: '西安',
    SEARCH_RADIUS: 100000,
    MARKER_ICON: '/images/pin.png'
  },
  
  ANIMATION: {
    DURATION: 300,
    EASING: 'ease-out'
  }
};

module.exports = config;