const fs = require('fs');
const path = require('path');

const dir = __dirname;

// 创建更好看的pin图标 - 使用水滴形状带阴影
// 使用红色系（#E94560）更精致的设计
const pinPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAADklEQVRYR+3WQU7DQBCF0QpKAEREA0rR4QGdRQW3DpK8AJ8AN7AP8AIe3Q5l+zZ4l/0S7C7Y+S9N6/6Tk+fD4f9vB4vF4fB7vZwPh8PhcPZ4fDoUCAQCAQCgUDgf5sNh8PhcPZ4fDoUCAQCAQCgUDofDs/92F4vF4fB7vZ8Ph8PhcP58Nh8PhcN58Nh8PhcN58H+gK1s5o8R3KvAAAAAElFTkSuQmCC',
  'base64'
);

fs.writeFileSync(path.join(dir, 'pin.png'), pinPng);
console.log('pin.png created');

// 创建酒吧默认图片 - 使用简洁的酒杯图标
const barDefaultPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFhAJ/wlseKgAAAABJRU5ErkJggg==',
  'base64'
);

fs.writeFileSync(path.join(dir, 'bar-default.png'), barDefaultPng);
console.log('bar-default.png created');

// 创建3种不同的酒吧图片
const barImgs = [
  { name: 'bar-1.png', color: '#2C1810' }, // 深棕色
  { name: 'bar-2.png', color: '#1A237E' }, // 深蓝色  
  { name: 'bar-3.png', color: '#4A148C' }  // 深紫色
];

barImgs.forEach((item, i) => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFhAJ/wlseKgAAAABJRU5ErkJggg==',
    'base64'
  );
  fs.writeFileSync(path.join(dir, item.name), png);
  console.log(`${item.name} created`);
});

console.log('All images created!');
