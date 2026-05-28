/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

async function main() {
  const [, , sourceArg, outDirArg] = process.argv;
  const source = path.resolve(sourceArg || '../assets/branding/app-logo-source.png');
  const outDir = path.resolve(outDirArg || path.join(__dirname, '../assets/images'));

  if (!fs.existsSync(source)) {
    console.error(`Source not found: ${source}`);
    process.exit(2);
  }

  const sharp = require('sharp');
  fs.mkdirSync(outDir, { recursive: true });

  const size = 1024;
  const safe = Math.round(size * 0.82);

  const base = sharp(source).ensureAlpha();

  await base
    .clone()
    .resize(size, size, { fit: 'contain', background: WHITE })
    .png()
    .toFile(path.join(outDir, 'icon.png'));

  await base
    .clone()
    .resize(safe, safe, { fit: 'contain', background: WHITE })
    .extend({
      top: Math.floor((size - safe) / 2),
      bottom: Math.ceil((size - safe) / 2),
      left: Math.floor((size - safe) / 2),
      right: Math.ceil((size - safe) / 2),
      background: WHITE,
    })
    .png()
    .toFile(path.join(outDir, 'android-icon-foreground.png'));

  await sharp({
    create: { width: size, height: size, channels: 3, background: WHITE },
  })
    .png()
    .toFile(path.join(outDir, 'android-icon-background.png'));

  await base
    .clone()
    .resize(safe, safe, { fit: 'contain', background: TRANSPARENT })
    .extend({
      top: Math.floor((size - safe) / 2),
      bottom: Math.ceil((size - safe) / 2),
      left: Math.floor((size - safe) / 2),
      right: Math.ceil((size - safe) / 2),
      background: TRANSPARENT,
    })
    .greyscale()
    .normalize()
    .png()
    .toFile(path.join(outDir, 'android-icon-monochrome.png'));

  await base
    .clone()
    .resize(512, 512, { fit: 'contain', background: WHITE })
    .png()
    .toFile(path.join(outDir, 'splash-icon.png'));

  await base
    .clone()
    .resize(192, 192, { fit: 'contain', background: WHITE })
    .png()
    .toFile(path.join(outDir, 'favicon.png'));

  console.log(`Icons written to ${outDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
