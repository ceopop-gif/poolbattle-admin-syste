const VERSION = 8;
const SIZE = VERSION * 4 + 17;
const DATA_CODEWORDS = 154;
const ECC_CODEWORDS_PER_BLOCK = 22;
const BLOCK_DATA_LENGTHS = [38, 38, 39, 39] as const;
const ALIGNMENT_POSITIONS = [6, 24, 42] as const;

type Matrix = boolean[][];

function appendBits(value: number, length: number, bits: number[]) {
  for (let index = length - 1; index >= 0; index -= 1) bits.push(((value >>> index) & 1) !== 0 ? 1 : 0);
}

function multiply(x: number, y: number) {
  let result = 0;
  for (let index = 7; index >= 0; index -= 1) {
    result = (result << 1) ^ (((result >>> 7) & 1) * 0x11d);
    if (((y >>> index) & 1) !== 0) result ^= x;
  }
  return result & 0xff;
}

function reedSolomonDivisor(degree: number) {
  const result = Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let index = 0; index < degree; index += 1) {
    for (let term = 0; term < degree; term += 1) {
      result[term] = multiply(result[term], root);
      if (term + 1 < degree) result[term] ^= result[term + 1];
    }
    root = multiply(root, 2);
  }
  return result;
}

function reedSolomonRemainder(data: number[], divisor: number[]) {
  const result = Array<number>(divisor.length).fill(0);
  for (const value of data) {
    const factor = value ^ result[0];
    result.shift();
    result.push(0);
    divisor.forEach((coefficient, index) => {
      result[index] ^= multiply(coefficient, factor);
    });
  }
  return result;
}

function createCodewords(value: string) {
  const bytes = Array.from(new TextEncoder().encode(value));
  if (bytes.length > 152) throw new Error("ข้อมูล QR ยาวเกินไป");

  const bits: number[] = [];
  appendBits(0b0100, 4, bits);
  appendBits(bytes.length, 8, bits);
  bytes.forEach((byte) => appendBits(byte, 8, bits));
  appendBits(0, Math.min(4, DATA_CODEWORDS * 8 - bits.length), bits);
  while (bits.length % 8 !== 0) bits.push(0);

  const dataCodewords: number[] = [];
  for (let index = 0; index < bits.length; index += 8) {
    let byte = 0;
    for (let bit = 0; bit < 8; bit += 1) byte = (byte << 1) | bits[index + bit];
    dataCodewords.push(byte);
  }
  for (let pad = 0; dataCodewords.length < DATA_CODEWORDS; pad += 1) dataCodewords.push(pad % 2 === 0 ? 0xec : 0x11);

  const divisor = reedSolomonDivisor(ECC_CODEWORDS_PER_BLOCK);
  const blocks: number[][] = [];
  const eccBlocks: number[][] = [];
  let offset = 0;
  for (const length of BLOCK_DATA_LENGTHS) {
    const block = dataCodewords.slice(offset, offset + length);
    blocks.push(block);
    eccBlocks.push(reedSolomonRemainder(block, divisor));
    offset += length;
  }

  const codewords: number[] = [];
  for (let index = 0; index < Math.max(...BLOCK_DATA_LENGTHS); index += 1) {
    blocks.forEach((block) => {
      if (index < block.length) codewords.push(block[index]);
    });
  }
  for (let index = 0; index < ECC_CODEWORDS_PER_BLOCK; index += 1) eccBlocks.forEach((block) => codewords.push(block[index]));
  return codewords;
}

function maskApplies(mask: number, x: number, y: number) {
  switch (mask) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
    case 5: return (x * y) % 2 + (x * y) % 3 === 0;
    case 6: return ((x * y) % 2 + (x * y) % 3) % 2 === 0;
    case 7: return ((x + y) % 2 + (x * y) % 3) % 2 === 0;
    default: return false;
  }
}

function penaltyScore(matrix: Matrix) {
  let penalty = 0;
  const scoreLine = (line: boolean[]) => {
    let score = 0;
    let runColor = line[0];
    let runLength = 1;
    for (let index = 1; index <= line.length; index += 1) {
      if (index < line.length && line[index] === runColor) runLength += 1;
      else {
        if (runLength >= 5) score += 3 + runLength - 5;
        if (index < line.length) {
          runColor = line[index];
          runLength = 1;
        }
      }
    }
    const pattern = line.map((cell) => cell ? "1" : "0").join("");
    for (let index = 0; index <= pattern.length - 11; index += 1) {
      const section = pattern.slice(index, index + 11);
      if (section === "10111010000" || section === "00001011101") score += 40;
    }
    return score;
  };

  for (let index = 0; index < SIZE; index += 1) {
    penalty += scoreLine(matrix[index]);
    penalty += scoreLine(matrix.map((row) => row[index]));
  }
  for (let y = 0; y < SIZE - 1; y += 1) {
    for (let x = 0; x < SIZE - 1; x += 1) {
      const color = matrix[y][x];
      if (matrix[y][x + 1] === color && matrix[y + 1][x] === color && matrix[y + 1][x + 1] === color) penalty += 3;
    }
  }
  const dark = matrix.reduce((total, row) => total + row.filter(Boolean).length, 0);
  penalty += Math.floor(Math.abs(dark * 20 - SIZE * SIZE * 10) / (SIZE * SIZE)) * 10;
  return penalty;
}

export function createQrMatrix(value: string): Matrix {
  const codewords = createCodewords(value);
  const base = Array.from({ length: SIZE }, () => Array<boolean>(SIZE).fill(false));
  const isFunction = Array.from({ length: SIZE }, () => Array<boolean>(SIZE).fill(false));
  const setFunction = (x: number, y: number, dark: boolean) => {
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
    base[y][x] = dark;
    isFunction[y][x] = true;
  };

  const drawFinder = (centerX: number, centerY: number) => {
    for (let dy = -4; dy <= 4; dy += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        setFunction(centerX + dx, centerY + dy, distance !== 2 && distance !== 4);
      }
    }
  };
  drawFinder(3, 3);
  drawFinder(SIZE - 4, 3);
  drawFinder(3, SIZE - 4);

  for (let index = 8; index < SIZE - 8; index += 1) {
    setFunction(index, 6, index % 2 === 0);
    setFunction(6, index, index % 2 === 0);
  }
  for (const centerY of ALIGNMENT_POSITIONS) {
    for (const centerX of ALIGNMENT_POSITIONS) {
      const overlapsFinder = (centerX === 6 && centerY === 6) || (centerX === 6 && centerY === SIZE - 7) || (centerX === SIZE - 7 && centerY === 6);
      if (overlapsFinder) continue;
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) setFunction(centerX + dx, centerY + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  }

  const drawVersion = (matrix: Matrix) => {
    let remainder = VERSION;
    for (let index = 0; index < 12; index += 1) remainder = (remainder << 1) ^ (((remainder >>> 11) & 1) * 0x1f25);
    const bits = (VERSION << 12) | remainder;
    for (let index = 0; index < 18; index += 1) {
      const dark = ((bits >>> index) & 1) !== 0;
      const a = SIZE - 11 + index % 3;
      const b = Math.floor(index / 3);
      matrix[b][a] = dark;
      matrix[a][b] = dark;
      isFunction[b][a] = true;
      isFunction[a][b] = true;
    }
  };
  drawVersion(base);

  const drawFormat = (matrix: Matrix, mask: number) => {
    const data = mask;
    let remainder = data;
    for (let index = 0; index < 10; index += 1) remainder = (remainder << 1) ^ (((remainder >>> 9) & 1) * 0x537);
    const bits = ((data << 10) | remainder) ^ 0x5412;
    const bit = (index: number) => ((bits >>> index) & 1) !== 0;
    for (let index = 0; index <= 5; index += 1) setFunction(8, index, bit(index));
    setFunction(8, 7, bit(6));
    setFunction(8, 8, bit(7));
    setFunction(7, 8, bit(8));
    for (let index = 9; index < 15; index += 1) setFunction(14 - index, 8, bit(index));
    for (let index = 0; index < 8; index += 1) setFunction(SIZE - 1 - index, 8, bit(index));
    for (let index = 8; index < 15; index += 1) setFunction(8, SIZE - 15 + index, bit(index));
    setFunction(8, SIZE - 8, true);
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) if (isFunction[y][x]) matrix[y][x] = base[y][x];
    }
  };
  drawFormat(base, 0);

  let bestMatrix: Matrix | null = null;
  let bestPenalty = Number.POSITIVE_INFINITY;
  for (let mask = 0; mask < 8; mask += 1) {
    const matrix = base.map((row) => [...row]);
    let bitIndex = 0;
    for (let right = SIZE - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vertical = 0; vertical < SIZE; vertical += 1) {
        for (let column = 0; column < 2; column += 1) {
          const x = right - column;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? SIZE - 1 - vertical : vertical;
          if (isFunction[y][x]) continue;
          const raw = bitIndex < codewords.length * 8 && ((codewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1) !== 0;
          matrix[y][x] = raw !== maskApplies(mask, x, y);
          bitIndex += 1;
        }
      }
    }
    if (bitIndex !== codewords.length * 8) throw new Error(`โครงสร้าง QR ไม่สมบูรณ์ (${bitIndex}/${codewords.length * 8})`);
    drawFormat(matrix, mask);
    const penalty = penaltyScore(matrix);
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestMatrix = matrix;
    }
  }
  if (!bestMatrix) throw new Error("ไม่สามารถสร้าง QR ได้");
  return bestMatrix;
}
