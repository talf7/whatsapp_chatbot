console.log("Starting WhatsApp bot...");

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

console.log("Loaded WhatsApp module...");
console.log("Loaded QR code module...");

// Configure WhatsApp Client with Puppeteer
const client = new Client({
    authStrategy: new LocalAuth({ dataPath: "./session" } ),
});

client.on('qr', qr => {
    console.log("📌 Scan this QR Code (only the first time):");
    qrcode.generate(qr, { small: true });
});
// Define working hours
const workingHours = {
    0: null, // Sunday (closed)
    1: { start: "07:30", end: "16:15" }, // Monday
    2: { start: "07:30", end: "13:45" }, // Tuesday
    3: { start: "07:30", end: "16:15" }, // Wednesday
    4: { start: "07:30", end: "16:15" }, // Thursday
    5: { start: "07:30", end: "11:45" }, // Friday
    6: null // Saturday (closed)
};

// Store user states
const userStates = new Map();

// Function to check if it's within working hours
function isWithinWorkingHours() {
    const now = new Date();
    const day = now.getDay();
    const hours = now.getHours();
    const minutes = now.getMinutes();

    const todayHours = workingHours[day];
    if (!todayHours) return false;

    const [startH, startM] = todayHours.start.split(":").map(Number);
    const [endH, endM] = todayHours.end.split(":").map(Number);

    const nowMinutes = hours * 60 + minutes;
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    return nowMinutes >= startMinutes && nowMinutes <= endMinutes;
}

// Function to send the main menu
function sendMainMenu(chatId) {
    client.sendMessage(chatId, `תודה שפניתם לדינמומטר ישראל, נא להקיש את המספר המתאים:

‏‎1️⃣ - בדיקה לפני קנייה
‏‎2️⃣ - טסט (בדיקת רישוי שנתית)
‏‎3️⃣ - פרונט
‏‎4️⃣ - אחר`);
    userStates.delete(chatId);
}

// Generate QR Code for authentication
client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ WhatsApp bot is ready!');
});

// Handle incoming messages
client.on('message', async message => {
    const chatId = message.from;
    const text = message.body.trim();

    // Return to main menu if "0" is pressed
    if (text === '0') {
        sendMainMenu(chatId);
        return;
    }

    // Handle 'אחר' (option 4 in main menu) with working hours check
    if (text === '4') {
        if (isWithinWorkingHours()) {
            client.sendMessage(chatId, `✅ *אנחנו זמינים כעת!*
נציג מטעמנו ייצור איתך קשר בהקדם.`);
        } else {
            client.sendMessage(chatId, `🕒 *שעות פעילות:*
- יום א', ב', ד', ה': 7:30-16:15
- יום ג': 7:30-13:45
- יום ו': 7:30-11:45
🚫 שבת - סגור
⏳ ניתן לנסות שוב בשעות הפעילות שלנו.`);
        }
        return;
    }

    // Handle 'בדיקת קנייה' submenu
    if (userStates.get(chatId) === "pre_purchase_check_menu") {
        if (text === '1') {
            client.sendMessage(chatId, `🕒 זמני קבלה לבדיקה:
- יום א', ב', ד', ה': 7:30-15:00
- יום ג': 7:30-12:30
- יום ו': 7:30-10:30
📌 הגעה אחרי השעות שצוינו פה צריך אישור מיוחד מהבודק.`);
        } else if (text === '2') {
            client.sendMessage(chatId, `💰 מחיר הבדיקה:
אנא בחר את סוג הרכב:
1️⃣ - סוג הנעה 4x2
2️⃣ - סוג הנעה 4x4
3️⃣ - מיני וואן
4️⃣ - מסחרי קטן
5️⃣ - מסחרי גדול
6️⃣ - משאיות עד 15 טון`);
            userStates.set(chatId, "vehicle_selection");
        } else if (text === '3') {
            client.sendMessage(chatId, `✅ *אחריות לבדיקה:*
קיימת אחריות לבדיקה עצמה של 3 חודשים על המנוע ושלדה.
על הגיר לא קיימת אחריות.`);
        } else if (text === '4') {
            client.sendMessage(chatId, `📋 *מה הבדיקה כוללת?*
בודקים את כל המערכות כולל מנוע, תיבת הילוכים, תאונות ושלדה.`);
        }
        return;
    }

    // Main Menu Options
    if (text === '1') {
        client.sendMessage(chatId, `🚗 נא לבחור אפשרות:
‏‎1️⃣ - זמני קבלה לבדיקה
‏‎2️⃣ - מחיר הבדיקה
‏‎3️⃣ - אחריות לבדיקה
‏‎4️⃣ - מה הבדיקה כוללת`);
        userStates.set(chatId, "pre_purchase_check_menu");
    } else if (text === '2') {
        client.sendMessage(chatId, `📌 בחר אפשרות:
1️⃣ - 📑 מה צריך להביא לטסט
2️⃣ - 🕒 שעות פעילות לטסטים
3️⃣ - 📲 וואטסאפ לשליחת טפסים עבור כל סניף`);
        userStates.set(chatId, "test_menu");
    } else if (text === '3') {
        client.sendMessage(chatId, `📞 לקביעת פרונט יש להתקשר לארקדי - 0522787076`);
    } else {
        sendMainMenu(chatId);
    }
});

// Start the bot
client.initialize();
