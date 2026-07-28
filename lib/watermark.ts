import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const LOGO_VALUE = 255.0; // Assume white logo
const ALPHA_THRESHOLD = 0.002;
const MAX_ALPHA = 0.99;

const TEMPLATES_DIR = path.join(process.cwd(), 'lib', 'templates');

interface AlphaMapData {
    alphaMap: Float32Array;
    width: number;
    height: number;
}

async function loadAlphaMap(templateFile: string): Promise<AlphaMapData> {
    const templatePath = path.join(TEMPLATES_DIR, templateFile);
    if (!fs.existsSync(templatePath)) {
        throw new Error(`Template not found: ${templatePath}`);
    }
    
    const { data, info } = await sharp(templatePath).raw().toBuffer({ resolveWithObject: true });
    const alphaMap = new Float32Array(info.width * info.height);
    
    for (let i = 0; i < info.width * info.height; i++) {
        const offset = i * info.channels;
        const maxVal = Math.max(data[offset], data[offset + 1], data[offset + 2]);
        alphaMap[i] = maxVal / 255.0;
    }
    
    return {
        alphaMap,
        width: info.width,
        height: info.height
    };
}

let templates: { small?: AlphaMapData, large?: AlphaMapData } = {};
let templatesLoadedV1 = false;
let templatesLoadedV2 = false;

async function initTemplates(isV1: boolean) {
    if (isV1 && templatesLoadedV1) return;
    if (!isV1 && templatesLoadedV2) return;

    if (isV1) {
        templates.small = await loadAlphaMap('bg_48_png.png');
        templates.large = await loadAlphaMap('bg_96_png.png');
        templatesLoadedV1 = true;
    } else {
        templates.small = await loadAlphaMap('bg_b_36_png.png');
        templates.large = await loadAlphaMap('bg_b_96_png.png');
        templatesLoadedV2 = true;
    }
}

function getWatermarkConfig(width: number, height: number, isV1: boolean) {
    const is_large = (width > 1024 && height > 1024);
    
    if (isV1) {
        if (is_large) return { margin_right: 64, margin_bottom: 64, logo_size: 96, is_large: true };
        return { margin_right: 32, margin_bottom: 32, logo_size: 48, is_large: false };
    }
    
    if (is_large) return { margin_right: 192, margin_bottom: 192, logo_size: 96, is_large: true };
    
    const long_side = Math.max(width, height);
    const short_side = Math.min(width, height);
    
    let source_long_dim;
    if (short_side >= 566) source_long_dim = 2752.0;
    else if (short_side >= 550) source_long_dim = 2816.0;
    else source_long_dim = 2848.0;
    
    const scale = long_side / source_long_dim;
    const margin = Math.round(192.0 * scale);
    
    return { margin_right: margin, margin_bottom: margin, logo_size: 36, is_large: false };
}

function computeNCC(data: Buffer, info: sharp.OutputInfo, alphaMapData: AlphaMapData, startX: number, startY: number) {
    const { alphaMap, width: w, height: h } = alphaMapData;
    
    let meanImg = 0;
    let meanAlpha = 0;
    let n = 0;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let imgX = startX + x;
            let imgY = startY + y;
            if (imgX >= 0 && imgX < info.width && imgY >= 0 && imgY < info.height) {
                let idx = (imgY * info.width + imgX) * info.channels;
                let gray = 0.299 * data[idx] + 0.587 * data[idx+1] + 0.114 * data[idx+2];
                meanImg += gray;
                meanAlpha += alphaMap[y * w + x];
                n++;
            }
        }
    }

    if (n === 0) return -1;
    meanImg /= n;
    meanAlpha /= n;

    let numerator = 0;
    let varImg = 0;
    let varAlpha = 0;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let imgX = startX + x;
            let imgY = startY + y;
            if (imgX >= 0 && imgX < info.width && imgY >= 0 && imgY < info.height) {
                let idx = (imgY * info.width + imgX) * info.channels;
                let gray = 0.299 * data[idx] + 0.587 * data[idx+1] + 0.114 * data[idx+2];
                let valImg = gray - meanImg;
                let valAlpha = alphaMap[y * w + x] - meanAlpha;
                numerator += valImg * valAlpha;
                varImg += valImg * valImg;
                varAlpha += valAlpha * valAlpha;
            }
        }
    }

    if (varImg === 0 || varAlpha === 0) return 0;
    return numerator / Math.sqrt(varImg * varAlpha);
}

function removeWatermarkAlphaBlend(data: Buffer, info: sharp.OutputInfo, alphaMapData: AlphaMapData, position: {x: number, y: number}) {
    const { alphaMap, width: w, height: h } = alphaMapData;
    const { x, y } = position;
    
    const x1 = Math.max(0, x);
    const y1 = Math.max(0, y);
    const x2 = Math.min(info.width, x + w);
    const y2 = Math.min(info.height, y + h);
    
    if (x1 >= x2 || y1 >= y2) return;
    
    for (let row = y1; row < y2; row++) {
        for (let col = x1; col < x2; col++) {
            const alphaX = col - x;
            const alphaY = row - y;
            let alpha = alphaMap[alphaY * w + alphaX];
            
            if (alpha < ALPHA_THRESHOLD) continue;
            
            alpha = Math.min(alpha, MAX_ALPHA);
            const one_minus_alpha = 1.0 - alpha;
            
            const idx = (row * info.width + col) * info.channels;
            
            for (let c = 0; c < Math.min(3, info.channels); c++) {
                const watermarked = data[idx + c];
                const original = (watermarked - alpha * LOGO_VALUE) / one_minus_alpha;
                data[idx + c] = Math.max(0, Math.min(255, Math.round(original)));
            }
        }
    }
}

export async function removeWatermark(imageBuffer: Buffer, isV1: boolean = false): Promise<Buffer> {
    await initTemplates(isV1);
    
    const { data, info } = await sharp(imageBuffer).raw().toBuffer({ resolveWithObject: true });
    
    const config = getWatermarkConfig(info.width, info.height, isV1);
    const startX = info.width - config.margin_right - config.logo_size;
    const startY = info.height - config.margin_bottom - config.logo_size;
    
    const alphaMapData = config.is_large ? templates.large! : templates.small!;
    
    const SEARCH_RADIUS = 4;
    let bestX = startX;
    let bestY = startY;
    let bestScore = -1;
    
    for (let dy = -SEARCH_RADIUS; dy <= SEARCH_RADIUS; dy++) {
        for (let dx = -SEARCH_RADIUS; dx <= SEARCH_RADIUS; dx++) {
            let score = computeNCC(data, info, alphaMapData, startX + dx, startY + dy);
            if (score > bestScore) {
                bestScore = score;
                bestX = startX + dx;
                bestY = startY + dy;
            }
        }
    }
    
    console.log(`[Watermark] Best NCC score: ${bestScore.toFixed(3)} at (${bestX}, ${bestY})`);
    
    // Only apply removal if we actually found a strong match for the watermark template
    if (bestScore > 0.4) {
        removeWatermarkAlphaBlend(data, info, alphaMapData, { x: bestX, y: bestY });
    } else {
        console.log(`[Watermark] Score too low (< 0.4), assuming no watermark present. Skipping removal.`);
    }
    
    return await sharp(data, {
        raw: {
            width: info.width,
            height: info.height,
            channels: info.channels
        }
    }).jpeg({ quality: 90 }).toBuffer();
}
