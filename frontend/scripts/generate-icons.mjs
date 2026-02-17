import sharp from 'sharp'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const svgPath = join(__dirname, '../public/logo.svg')
const svgBuffer = readFileSync(svgPath)

const icons = [
  { output: '../public/icon-192.png', size: 192 },
  { output: '../public/icon-512.png', size: 512 },
  { output: '../public/apple-touch-icon.png', size: 180 },
]

for (const { output, size } of icons) {
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(join(__dirname, output))
  console.log(`Generated ${size}x${size}: ${output}`)
}

console.log('Done!')
