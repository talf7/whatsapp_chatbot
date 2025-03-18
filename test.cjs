const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({
        headless: false,
        executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" // Correctly formatted
    });
    const page = await browser.newPage();
    await page.goto('https://google.com');
    console.log('Puppeteer launched successfully');
    await browser.close();
})();
