import { crc32, deflateSync } from "node:zlib"
import fs from "node:fs"
import path from "node:path"

const size = 1024
const rgba = Buffer.alloc(size * size * 4)

const navyTop = [22, 68, 122]
const navyBot = [9, 38, 82]
const ivory = [245, 242, 235]
const amber = [220, 126, 34]
const amberEdge = [255, 216, 164]

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ]
}

function cover(x, y, color) {
  if (x < 0 || y < 0 || x >= size || y >= size) return
  const i = (y * size + x) * 4
  rgba[i] = color[0]
  rgba[i + 1] = color[1]
  rgba[i + 2] = color[2]
  rgba[i + 3] = 255
}

function set(x, y, color, alpha = 255) {
  if (x < 0 || y < 0 || x >= size || y >= size) return
  const i = (y * size + x) * 4
  const a = alpha / 255
  rgba[i] = Math.round(rgba[i] * (1 - a) + color[0] * a)
  rgba[i + 1] = Math.round(rgba[i + 1] * (1 - a) + color[1] * a)
  rgba[i + 2] = Math.round(rgba[i + 2] * (1 - a) + color[2] * a)
  rgba[i + 3] = 255
}

function capsule(x1, y1, x2, y2, radius, color, paint = set) {
  const minX = Math.max(0, Math.floor(Math.min(x1, x2) - radius - 1))
  const maxX = Math.min(size - 1, Math.ceil(Math.max(x1, x2) + radius + 1))
  const minY = Math.max(0, Math.floor(Math.min(y1, y2) - radius - 1))
  const maxY = Math.min(size - 1, Math.ceil(Math.max(y1, y2) + radius + 1))
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy || 1
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len2))
      const px = x1 + t * dx
      const py = y1 + t * dy
      const dist = Math.hypot(x - px, y - py)
      if (dist <= radius) paint(x, y, color)
      else if (dist <= radius + 1.25) paint(x, y, color, Math.round(170 * (1 - (dist - radius) / 1.25)))
    }
  }
}

function chevron(cx, cy, arm, thickness, color) {
  capsule(cx - arm * 0.1, cy - arm, cx + arm * 0.9, cy, thickness, color)
  capsule(cx - arm * 0.1, cy + arm, cx + arm * 0.9, cy, thickness, color)
}

for (let y = 0; y < size; y++) {
  const row = mix(navyTop, navyBot, y / (size - 1))
  for (let x = 0; x < size; x++) cover(x, y, row)
}

const markY = size * 0.5
const barW = size * 0.3
const barGap = size * 0.092
const barThick = size * 0.042
const promptX = size * 0.3
const promptArm = size * 0.1

chevron(promptX, markY, promptArm, barThick, ivory)
for (let i = -1; i <= 1; i++) {
  const y = markY + i * barGap
  capsule(size * 0.46, y, size * 0.46 + barW, y, barThick, ivory)
}

const slashCore = size * 0.04
const slashHalo = size * 0.07
const sx1 = size * 0.26
const sy1 = size * 0.72
const sx2 = size * 0.74
const sy2 = size * 0.28

capsule(sx1, sy1, sx2, sy2, slashHalo, navyBot, cover)
capsule(sx1, sy1, sx2, sy2, slashCore + size * 0.014, amberEdge, cover)
capsule(sx1, sy1, sx2, sy2, slashCore, amber, cover)

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const sum = Buffer.alloc(4)
  sum.writeUInt32BE(crc32(body) >>> 0)
  return Buffer.concat([length, body, sum])
}

const header = Buffer.alloc(13)
header.writeUInt32BE(size, 0)
header.writeUInt32BE(size, 4)
header[8] = 8
header[9] = 6
const raw = Buffer.alloc((size * 4 + 1) * size)
for (let y = 0; y < size; y++) {
  raw[y * (size * 4 + 1)] = 0
  rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
}

fs.mkdirSync("build", { recursive: true })
const file = path.join("build", "icon.png")
fs.writeFileSync(
  file,
  Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]),
)
console.log(file)
