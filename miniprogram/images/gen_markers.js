/**
 * 生成小程序地图 marker 图标（高分辨率 + 超采样抗锯齿）
 *
 * 背景：旧 pin.png 是 32x32 源图，但 marker 按 32x40 显示 → 纵向拉伸 25% 导致变形模糊；
 *      且 3x 屏需要 96x120 源图才清晰。
 * 输出：
 *   pin.png          96x120  水滴形定位针（品牌色渐变 + 白描边 + 马天尼杯图案）
 *   user-location.png 84x84  圆润定位点（蓝色渐变 + 白环 + 双层光晕 + 高光）
 *
 * 用法：node gen_markers.js
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/* ---------- PNG 编码 ---------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // RGBA
  ihdr[10] = 0;  // deflate
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // no interlace

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

/* ---------- 绘图工具 ---------- */
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);

/** 水滴形定位针：圆头 + 两条切线收束到尖端（边缘与圆相切，无折角） */
function inPin(x, y, cx, cy, R, tipY) {
  if (Math.hypot(x - cx, y - cy) <= R) return true;
  const d = tipY - cy;
  if (d <= R || y < cy) return false;
  const sinT = R / d;
  const cosT = Math.sqrt(1 - sinT * sinT);
  const a = R * sinT;          // 切点横偏移
  const b = cy + R * cosT;     // 切点纵坐标
  if (y < b) return false;
  // 半平面：左切边 T1->tip，右切边 T2->tip
  const z1 = a * (y - b) - (tipY - b) * (x + a - cx);
  const z2 = -a * (y - b) - (tipY - b) * (x - a - cx);
  return z1 <= 0 && z2 >= 0;
}

/** 马天尼杯（鸡尾酒杯）图案：杯体倒三角 + 杯柄 + 底座 */
function inGlass(x, y, cx, cy) {
  const mouthY = cy - 13, halfW = 21, bowlBottom = cy + 9;
  // 杯体：倒三角
  if (y >= mouthY && y <= bowlBottom) {
    const t = (y - mouthY) / (bowlBottom - mouthY);
    if (Math.abs(x - cx) <= halfW * (1 - t)) return true;
  }
  // 杯口横梁（让杯口更清晰）
  if (y >= mouthY - 3 && y <= mouthY + 1 && Math.abs(x - cx) <= halfW + 2) return true;
  // 杯柄
  if (y > bowlBottom && y <= cy + 21 && Math.abs(x - cx) <= 2.4) return true;
  // 底座
  if (y > cy + 19 && y <= cy + 23 && Math.abs(x - cx) <= 13) return true;
  return false;
}

/** 酒签 + 樱桃（斜插在杯口，增加辨识度） */
function inPick(x, y, cx, cy) {
  const px = cx + 9, topY = cy - 26;
  // 细签：从杯口右上斜插到杯内
  if (y >= topY && y <= cy - 2) {
    const t = (y - topY) / (cy - 2 - topY);
    const lineX = lerp(px, cx + 2, t);
    if (Math.abs(x - lineX) <= 1.9) return true;
  }
  // 顶端樱桃
  return Math.hypot(x - px, y - (topY - 1)) <= 4.6;
}

/** 渲染定位针 */
function renderPin(W, H, SS) {
  const cx = W / 2, cy = H * 0.367, R = W * 0.396, tipY = H * 0.967;
  const stroke = W * 0.0625;
  const buf = Buffer.alloc(W * H * 4);

  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = px + (sx + 0.5) / SS;
          const y = py + (sy + 0.5) / SS;
          let c = null;

          if (inPin(x, y, cx, cy, R + stroke, tipY + stroke * 0.6)) {
            // 白色描边
            c = [255, 255, 255, 1];
            if (inPin(x, y, cx, cy, R, tipY)) {
              // 主体：品牌色纵向渐变（顶部亮、底部深）
              const t = clamp01((y - (cy - R)) / (R * 2 + (tipY - cy)));
              c = [lerp(255, 199, t), lerp(92, 34, t), lerp(119, 80, t), 1];
              // 左上高光，营造立体圆润感
              const hl = Math.hypot(x - (cx - R * 0.36), y - (cy - R * 0.4)) / (R * 0.85);
              if (hl < 1) {
                const k = (1 - hl) * 0.22;
                c = [Math.min(255, c[0] + 255 * k), Math.min(255, c[1] + 255 * k), Math.min(255, c[2] + 255 * k), 1];
              }
              if (inGlass(x, y, cx, cy) || inPick(x, y, cx, cy)) c = [255, 255, 255, 1];
            }
          }

          if (c) { r += c[0]; g += c[1]; b += c[2]; a += c[3]; }
        }
      }
      const n = SS * SS;
      const alpha = a / n;
      const i = (py * W + px) * 4;
      if (alpha > 0) {
        buf[i] = Math.round(r / a);
        buf[i + 1] = Math.round(g / a);
        buf[i + 2] = Math.round(b / a);
        buf[i + 3] = Math.round(alpha * 255);
      }
    }
  }
  return buf;
}

/** 渲染用户定位点 */
function renderUser(W, H, SS) {
  const cx = W / 2, cy = H / 2;
  const rGlow1 = W * 0.476, rGlow2 = W * 0.381, rWhite = W * 0.286, rCore = W * 0.226;
  const buf = Buffer.alloc(W * H * 4);

  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = px + (sx + 0.5) / SS;
          const y = py + (sy + 0.5) / SS;
          const d = Math.hypot(x - cx, y - cy);
          let c = null;

          if (d <= rGlow1) {
            // 外层光晕：边缘羽化
            const feather = clamp01((rGlow1 - d) / (rGlow1 * 0.45));
            c = [74, 158, 255, 0.16 * feather];
            if (d <= rGlow2) {
              const f2 = clamp01((rGlow2 - d) / (rGlow2 * 0.5));
              c = [74, 158, 255, Math.min(1, 0.16 * feather + 0.26 * f2)];
              if (d <= rWhite) {
                c = [255, 255, 255, 1];
                if (d <= rCore) {
                  const t = clamp01((y - (cy - rCore)) / (rCore * 2));
                  c = [lerp(96, 24, t), lerp(170, 118, t), lerp(255, 224, t), 1];
                  // 左上高光点
                  if (Math.hypot(x - (cx - rCore * 0.32), y - (cy - rCore * 0.36)) <= rCore * 0.34) {
                    c = [255, 255, 255, 0.85];
                  }
                }
              }
            }
          }

          if (c) { r += c[0] * c[3]; g += c[1] * c[3]; b += c[2] * c[3]; a += c[3]; }
        }
      }
      const n = SS * SS;
      const alpha = a / n;
      const i = (py * W + px) * 4;
      if (alpha > 0) {
        buf[i] = Math.round(r / a);
        buf[i + 1] = Math.round(g / a);
        buf[i + 2] = Math.round(b / a);
        buf[i + 3] = Math.round(alpha * 255);
      }
    }
  }
  return buf;
}

/* ---------- 生成 ---------- */
const dir = __dirname;
const SS = 4; // 4x4 超采样

const pin = encodePng(96, 120, renderPin(96, 120, SS));
fs.writeFileSync(path.join(dir, 'pin.png'), pin);
console.log(`pin.png  → 96x120, ${(pin.length / 1024).toFixed(1)}KB`);

const user = encodePng(84, 84, renderUser(84, 84, SS));
fs.writeFileSync(path.join(dir, 'user-location.png'), user);
console.log(`user-location.png → 84x84, ${(user.length / 1024).toFixed(1)}KB`);
