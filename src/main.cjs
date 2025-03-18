const { app, BrowserWindow, ipcMain } = require('electron');
const { exec } = require('child_process');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

let mainWindow;
let botProcess = null;
let wsServer;
let checkTabInterval;
let isBotRunning = false; // ✅ CHANGE: Added flag to track bot status


// ✅ Enable app launch on startup
app.setLoginItemSettings({
  openAtLogin: true, // Automatically start on login
  path: process.execPath, // Use the built .exe file path
});


app.whenReady().then(() => {
  const { exec } = require('child_process');

// ✅ Add app to Windows startup registry
  exec(`reg add HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run /v "WhatsAppBot" /t REG_SZ /d "${process.execPath}" /f`, (err) => {
    if (err) {
      console.error("❌ Error adding to startup:", err);
    } else {
      console.log("✅ App added to Windows startup.");
    }
  });
  const fs = require('fs');
  const os = require('os');
  const startupFolder = path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
  const shortcutPath = path.join(startupFolder, 'WhatsAppBot.lnk');

  fs.writeFileSync(shortcutPath, `[InternetShortcut]
URL=file://${process.execPath}`);
  console.log("✅ Shortcut created in Startup folder.");

  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true
    }
  });

  mainWindow.loadFile('index.html');

  // Start WebSocket server for logs
  wsServer = new WebSocket.Server({ port: 3000 });

  wsServer.on('connection', ws => {
    console.log('Client connected to WebSocket');

    ws.on('message', (message) => {
      const msg = JSON.parse(message);
      if (msg.type === "start-bot") {
        startBot();
      } else if (msg.type === "stop-bot") {
        stopBot();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      stopBot();
      app.quit();
    }
  });
});

// Function to get correct bot.cjs path
function getBotPath() {
  let botPath;

  if (fs.existsSync(path.join(__dirname, '../bot.cjs'))) {
    botPath = path.join(__dirname, '../bot.cjs'); // Development mode
  } else if (fs.existsSync(path.join(process.resourcesPath, 'app/bot.cjs'))) {
    botPath = path.join(process.resourcesPath, 'app/bot.cjs'); // Inside built .exe
  } else if (fs.existsSync(path.join(process.resourcesPath, 'bot.cjs'))) {
    botPath = path.join(process.resourcesPath, 'bot.cjs'); // Alternate path
  } else {
    console.error("❌ ERROR: bot.cjs not found!");
    sendToUI({ type: "log", data: "Error: bot.cjs not found! Make sure it's in the correct location." });
    return null;
  }

  console.log(`✅ Bot Path: ${botPath}`);
  return botPath;
}

// ✅ CHANGE: Function to check if WhatsApp Web tab is open
function checkIfTabIsOpen() {
  exec('tasklist', (err, stdout, stderr) => {
    if (err || stderr) {
      console.error(`❌ Error checking tasks: ${err || stderr}`);
      return;
    }

    const isChromeRunning = stdout.includes("chrome.exe");

    // ✅ CHANGE: If WhatsApp Web is closed while bot is running, stop it
    if (!isChromeRunning && isBotRunning) {
      console.log("❌ WhatsApp Web tab closed! Stopping bot...");
      sendToUI({ type: "log", data: "❌ WhatsApp Web tab closed! Stopping bot..." });
      stopBot();
    }
  });
}


// Function to start the bot
function startBot() {
  if (isBotRunning) {
    console.log("⚠️ Bot is already running!");
    sendToUI({ type: "log", data: "⚠️ Bot is already running!" });
    return; // Prevent multiple bot instances
  }

  const botPath = getBotPath();
  if (!botPath) return;

  // Set NODE_PATH so it finds modules
  const nodePath = process.resourcesPath
      ? path.join(process.resourcesPath, 'node_modules')
      : path.join(__dirname, '../node_modules');

  botProcess = exec(`set NODE_PATH="${nodePath}" && node "${botPath}"`, { shell: true });

  botProcess.stdout.on('data', (data) => {
    console.log(`[BOT]: ${data}`);
    sendToUI({ type: "log", data });
  });

  botProcess.stderr.on('data', (data) => {
    console.error(`[ERROR]: ${data}`);
    sendToUI({ type: "log", data: `Error: ${data}` });
  });

  botProcess.on('close', (code) => {
    console.log(`❌ Bot process exited with code ${code}`);
    sendToUI({ type: "log", data: `Bot stopped with exit code ${code}` });
    botProcess = null; // Reset the botProcess variable when it stops
    isBotRunning = false;
    clearInterval(checkTabInterval); // Stop checking WhatsApp tab when bot stops
  });

  console.log("✅ Bot started successfully!");
  sendToUI({ type: "log", data: "✅ Bot started successfully!" });
  isBotRunning = true;
  sendToUI({ type: "status", data: "running" }); // ✅ Notify UI


  // Check if the WhatsApp Web tab is still open every 5 seconds
  checkTabInterval = setInterval(checkIfTabIsOpen, 3000);
}


// Function to stop the bot and close WhatsApp Web tab
function stopBot() {
  if (!isBotRunning) {
    console.log("⚠️ No bot is currently running.");
    sendToUI({ type: "log", data: "⚠️ No bot is currently running." });
    return;
  }
  console.log("🛑 Stopping bot...");
  botProcess.kill();
  botProcess = null;
  isBotRunning = false;
  clearInterval(checkTabInterval); // Stop checking WhatsApp Web tab

  // Close WhatsApp Web tab
  exec('taskkill /IM chrome.exe /F', (err, stdout, stderr) => {
    if (err || stderr) {
      console.error(`❌ Error closing WhatsApp Web: ${err || stderr}`);
      sendToUI({ type: "log", data: `❌ Error closing WhatsApp Web: ${err || stderr}` });
    } else {
      console.log("✅ WhatsApp Web tab closed successfully.");
      sendToUI({ type: "log", data: "✅ WhatsApp Web tab closed successfully." });
    }
  });

  sendToUI({ type: "log", data: "🛑 Bot stopped successfully!" });
}

// Send messages to UI via WebSocket
function sendToUI(message) {
  wsServer.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

// Listen for start/stop commands from UI
ipcMain.on('start-bot', () => {
  startBot();
});

ipcMain.on('stop-bot', () => {
  stopBot();
});
