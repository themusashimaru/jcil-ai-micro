/**
 * Generate Android app icons from JCIL logo
 * Run with: node scripts/generate-android-icons.mjs
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import https from 'https';

const LOGO_URL = 'https://kxsaxrnnhjmhtrzarjgh.supabase.co/storage/v1/object/public/branding/favicon_1765259929366_jx6zab.jpeg';

// Android icon sizes (mipmap directories)
const ANDROID_SIZES = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

// Adaptive icon foreground sizes (with padding for safe zone)
const ADAPTIVE_SIZES = {
  'mipmap-mdpi': 108,
  'mipmap-hdpi': 162,
  'mipmap-xhdpi': 216,
  'mipmap-xxhdpi': 324,
  'mipmap-xxxhdpi': 432,
};

const ANDROID_RES_PATH = './android/app/src/main/res';

async function downloadImage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    }).on('error', reject);
  });
}

async function generateIcons() {
  console.log('Downloading logo from:', LOGO_URL);
  const logoBuffer = await downloadImage(LOGO_URL);
  console.log('Logo downloaded, size:', logoBuffer.length, 'bytes');

  // Generate standard launcher icons
  for (const [folder, size] of Object.entries(ANDROID_SIZES)) {
    const outputPath = path.join(ANDROID_RES_PATH, folder, 'ic_launcher.png');

    await sharp(logoBuffer)
      .resize(size, size, { fit: 'cover' })
      .png()
      .toFile(outputPath);

    console.log(`Generated: ${outputPath} (${size}x${size})`);

    // Also generate round icon
    const roundPath = path.join(ANDROID_RES_PATH, folder, 'ic_launcher_round.png');

    // Create circular mask
    const circleSize = size;
    const circle = Buffer.from(
      `<svg width="${circleSize}" height="${circleSize}">
        <circle cx="${circleSize/2}" cy="${circleSize/2}" r="${circleSize/2}" fill="white"/>
      </svg>`
    );

    await sharp(logoBuffer)
      .resize(size, size, { fit: 'cover' })
      .composite([{
        input: circle,
        blend: 'dest-in'
      }])
      .png()
      .toFile(roundPath);

    console.log(`Generated: ${roundPath} (${size}x${size} round)`);
  }

  // Generate adaptive icon foregrounds
  for (const [folder, size] of Object.entries(ADAPTIVE_SIZES)) {
    const foregroundPath = path.join(ANDROID_RES_PATH, folder, 'ic_launcher_foreground.png');

    // Foreground should be centered with padding (icon takes ~66% of canvas)
    const iconSize = Math.round(size * 0.66);
    const padding = Math.round((size - iconSize) / 2);

    // Create the foreground with transparent background and centered icon
    const resizedIcon = await sharp(logoBuffer)
      .resize(iconSize, iconSize, { fit: 'cover' })
      .toBuffer();

    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
      .composite([{
        input: resizedIcon,
        left: padding,
        top: padding
      }])
      .png()
      .toFile(foregroundPath);

    console.log(`Generated: ${foregroundPath} (${size}x${size} adaptive foreground)`);
  }

  // Generate Play Store icon (512x512)
  const playStoreIcon = './android/app/src/main/ic_launcher-playstore.png';
  await sharp(logoBuffer)
    .resize(512, 512, { fit: 'cover' })
    .png()
    .toFile(playStoreIcon);
  console.log(`Generated: ${playStoreIcon} (512x512 Play Store)`);

  console.log('\nAll icons generated successfully!');
}

generateIcons().catch(console.error);
