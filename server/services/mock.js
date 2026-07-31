const mockBars = [
  {
    id: 'mock_001',
    name: '醉梦酒馆',
    address: '市中心商业街88号',
    lat: 30.5728,
    lng: 104.0668,
    phone: '028-88886666',
    hours: '18:00-02:00',
    avg_rating: 4.8,
    tags: '精酿吧',
    photos: [],
    distance: 500,
    source: 'mock'
  },
  {
    id: 'mock_002',
    name: '夜猫子酒吧',
    address: '酒吧街12号',
    lat: 30.5735,
    lng: 104.0675,
    phone: '028-88887777',
    hours: '19:00-04:00',
    avg_rating: 4.6,
    tags: '鸡尾酒吧',
    photos: [],
    distance: 800,
    source: 'mock'
  },
  {
    id: 'mock_003',
    name: '静谧小馆',
    address: '文艺路25号',
    lat: 30.5715,
    lng: 104.0655,
    phone: '028-88889999',
    hours: '17:00-01:00',
    avg_rating: 4.9,
    tags: '清吧',
    photos: [],
    distance: 1200,
    source: 'mock'
  },
  {
    id: 'mock_004',
    name: '微醺时光',
    address: '滨江大道66号',
    lat: 30.5740,
    lng: 104.0680,
    phone: '028-88885555',
    hours: '18:30-03:00',
    avg_rating: 4.7,
    tags: '精酿吧',
    photos: [],
    distance: 1500,
    source: 'mock'
  },
  {
    id: 'mock_005',
    name: '星空酒吧',
    address: '观景台路18号',
    lat: 30.5700,
    lng: 104.0640,
    phone: '028-88884444',
    hours: '20:00-05:00',
    avg_rating: 4.5,
    tags: '鸡尾酒吧',
    photos: [],
    distance: 2000,
    source: 'mock'
  }
];

class MockService {
  getMockBars(lat, lng) {
    return mockBars.map(bar => ({
      ...bar,
      lat: bar.lat + (Math.random() - 0.5) * 0.01,
      lng: bar.lng + (Math.random() - 0.5) * 0.01,
      distance: Math.floor(500 + Math.random() * 3000)
    }));
  }

  getMockBarById(id) {
    const bar = mockBars.find(b => b.id === id);
    if (!bar) return null;
    
    return {
      ...bar,
      photos: []
    };
  }
}

module.exports = new MockService();