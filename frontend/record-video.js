const puppeteer = require('puppeteer');
const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder');
const path = require('path');

const Config = {
  followNewTab: false,
  fps: 60,
  videoFrame: {
    width: 1920,
    height: 1080,
  },
  videoCrf: 15,
  videoCodec: 'libx264',
  videoPreset: 'slow',
  videoBitrate: 8000,
  aspectRatio: '16:9',
};

async function recordVideo() {
  console.log('Launching browser...');

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: {
      width: 1920,
      height: 1080,
    },
    args: ['--start-maximized'],
  });

  const page = await browser.newPage();

  // Set viewport
  await page.setViewport({ width: 1920, height: 1080 });

  // Navigate to the video HTML
  const htmlPath = path.join(__dirname, 'case-study-video.html');
  console.log('Opening:', htmlPath);
  await page.goto(`file://${htmlPath}`);

  // Wait for page to load
  await page.waitForSelector('#controls');
  console.log('Page loaded');

  // Initialize recorder
  const recorder = new PuppeteerScreenRecorder(page, Config);

  // Output file
  const outputPath = path.join(__dirname, 'veritas-video.mp4');
  console.log('Recording to:', outputPath);

  // Hide UI first
  await page.click('.hide-btn');
  console.log('UI hidden');

  // Wait a moment
  await new Promise(r => setTimeout(r, 500));

  // Start recording
  await recorder.start(outputPath);
  console.log('Recording started...');

  // Click play using JavaScript (since button might be hidden now)
  await page.evaluate(() => {
    playVideo();
  });
  console.log('Video playing...');

  // Wait for the video duration (45 seconds + buffer)
  console.log('Recording for 47 seconds...');
  await new Promise(r => setTimeout(r, 47000));

  // Stop recording
  await recorder.stop();
  console.log('Recording stopped');

  // Close browser
  await browser.close();
  console.log('Done! Video saved to:', outputPath);
}

recordVideo().catch(console.error);
