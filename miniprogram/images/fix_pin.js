const fs = require('fs');
const path = require('path');

// 使用Node.js生成一个精美的水滴形pin图标
// 红色系 #E94560，带有白色边框和阴影效果
// 尺寸：32x40像素

const { createCanvas } = (() => {
  try {
    return require('canvas');
  } catch (e) {
    return { createCanvas: null };
  }
})();

// 如果没有canvas模块，手动创建PNG
function createPinPNG() {
  // 使用zlib和fs手动构造一个PNG文件
  const zlib = require('zlib');
  
  // PNG文件结构
  // 1. PNG签名
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  // 2. IHDR块 (图像头)
  const width = 32;
  const height = 40;
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0); // 长度
  ihdr.write('IHDR', 4);
  ihdr.writeUInt32BE(width, 8);
  ihdr.writeUInt32BE(height, 12);
  ihdr.writeUInt8(8, 16); // 位深度
  ihdr.writeUInt8(6, 17); // 颜色类型 (RGBA)
  ihdr.writeUInt8(0, 18); // 压缩方法
  ihdr.writeUInt8(0, 19); // 过滤方法
  ihdr.writeUInt8(0, 20); // 交错方法
  
  // 计算IHDR CRC
  const crc32 = require('zlib').createCRC32 ? null : null;
  let crc = 0xffffffff;
  const crcTable = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[i] = c;
  }
  function calcCRC(data) {
    let c = 0xffffffff;
    for (let i = 0; i < data.length; i++) {
      c = crcTable[(c ^ data[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  }
  const ihdrData = ihdr.slice(4, 21);
  ihdr.writeUInt32BE(calcCRC(ihdrData), 21);
  
  // 3. IDAT块 (图像数据)
  // 创建像素数据：水滴形pin
  const rawData = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0); // 过滤器字节
    
    for (let x = 0; x < width; x++) {
      // 水滴形计算
      const cx = width / 2;
      const cy = height / 2 - 4;
      const dx = x - cx;
      const dy = y - cy;
      
      // 判断点是否在pin内
      let r, g, b, a = 0;
      
      // 圆形头部 (上半部分)
      const headCy = 14;
      const headDy = y - headCy;
      const headDx = x - cx;
      const headDist = Math.sqrt(headDx * headDx + headDy * headDy);
      
      // 尖底部 (下半部分)
      const tipCy = height - 2;
      const tipDx = x - cx;
      const tipDy = y - tipCy;
      
      if (y < 28) {
        // 圆形头部区域
        if (headDist <= 12) {
          // 白色边框
          if (headDist > 10) {
            r = 255; g = 255; b = 255; a = 255;
          } 
          // 内部主体 - 红色渐变
          else {
            const shade = 1 - headDist / 12;
            r = Math.floor(233 + (255 - 233) * shade);
            g = Math.floor(69 + (100 - 69) * shade);
            b = Math.floor(96 + (130 - 96) * shade);
            a = 255;
          }
        }
      } else {
        // 尖底部区域
        const tipDist = Math.sqrt(tipDx * tipDx + tipDy * tipDy);
        if (tipDist <= 14 - (y - 28) * 0.5) {
          if (tipDist > 12 - (y - 28) * 0.5) {
            // 白色边框
            r = 255; g = 255; b = 255; a = 255;
          } else {
            // 红色主体
            const shade = 1 - tipDist / 14;
            r = Math.floor(233 + (255 - 233) * shade);
            g = 69;
            b = 96;
            a = 255;
          }
        }
      }
      
      // 高光效果
      if (y < 22 && x > 10 && x < 18 && headDist < 8) {
        const highlight = Math.max(0, 1 - Math.abs(x - 14) / 4) * 0.6;
        r = Math.min(255, r + highlight * 100);
        g = Math.min(255, g + highlight * 100);
        b = Math.min(255, b + highlight * 100);
        a = 255;
      }
      
      rawData.push(r, g, b, a);
    }
  }
  
  const compressed = zlib.deflateSync(Buffer.from(rawData));
  
  const idat = Buffer.alloc(compressed.length + 12);
  idat.writeUInt32BE(compressed.length, 0);
  idat.write('IDAT', 4);
  compressed.copy(idat, 8);
  const idatData = Buffer.concat([Buffer.from('IDAT'), compressed]);
  idat.writeUInt32BE(calcCRC(idatData), compressed.length + 8);
  
  // 4. IEND块 (图像结束)
  const iend = Buffer.from([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);
  
  // 合并所有块
  return Buffer.concat([pngSignature, ihdr, idat, iend]);
}

try {
  const pinPNG = createPinPNG();
  fs.writeFileSync(path.join(__dirname, 'pin.png'), pinPNG);
  console.log('✅ pin.png created successfully!');
  console.log('Size:', pinPNG.length, 'bytes');
} catch (err) {
  console.error('Error creating pin.png:', err.message);
}
