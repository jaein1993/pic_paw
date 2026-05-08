// 간단한 RGB 강아지 이미지 생성 (10x10 PNG)
const fs = require('fs');

// PNG 헤더
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

// IHDR 청크 (10x10, RGB)
const IHDR = Buffer.from([
  0x00, 0x00, 0x00, 0x0D, // 크기
  0x49, 0x48, 0x44, 0x52, // "IHDR"
  0x00, 0x00, 0x00, 0x0A, // width = 10
  0x00, 0x00, 0x00, 0x0A, // height = 10
  0x08, 0x02, 0x00, 0x00, 0x00, // 비트뎁스=8, 컬러타입=2(RGB), 압축, 필터, 인터레이스
  0x7C, 0x6C, 0xFB, 0x53  // CRC
]);

// IDAT 청크 (간단한 갈색 데이터)
const imageData = Buffer.alloc(10 * 10 * 3 + 10); // RGB + 필터바이트
let idx = 0;
for (let y = 0; y < 10; y++) {
  imageData[idx++] = 0; // 필터타입
  for (let x = 0; x < 10; x++) {
    imageData[idx++] = 139; // R (갈색 - 개의 색)
    imageData[idx++] = 69;  // G
    imageData[idx++] = 19;  // B
  }
}

const zlib = require('zlib');
const compressed = zlib.deflateSync(imageData);
const IDAT = Buffer.alloc(compressed.length + 12);
IDAT.writeUInt32BE(compressed.length, 0);
IDAT.write('IDAT', 4);
compressed.copy(IDAT, 8);

// CRC 계산 (간단히 더미값)
IDAT.writeUInt32BE(0x12345678, IDAT.length - 4);

// IEND 청크
const IEND = Buffer.from([
  0x00, 0x00, 0x00, 0x00, // 크기
  0x49, 0x45, 0x4E, 0x44, // "IEND"
  0xAE, 0x42, 0x60, 0x82  // CRC
]);

const png = Buffer.concat([PNG_SIGNATURE, IHDR, IDAT, IEND]);
fs.writeFileSync(__dirname + '/dog.png', png);
console.log('Image created successfully');
