const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
const qrcode = require('qrcode-terminal');
const express = require("express");
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:3000'); // Connect to WebSocket server

let qrCode = "";
const app = express();

app.get('/qr',async (req, res) => {
    if (!qrCode) return res.send("No QR Code yet, please wait...");
    const qrImage = await qrcode.toDataURL(qrCode);
    res.send(`<img src="${qrImage}" alt="Scan QR Code to Connect">`);
})

function sendLog(message) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "log", data: message }));
    }
}

ws.on('open', () => {
    sendLog("Connected to WebSocket server from bot.js");
});

ws.on('error', (err) => {
    console.error("WebSocket Error:", err);
});

// Send logs to UI
console.log = (message) => {
    sendLog(message);
    process.stdout.write(message + '\n'); // Keep normal logging behavior
};
process.env.CHROME_PATH = "/usr/bin/google-chrome-stable";

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        executablePath: process.env.CHROME_PATH,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// Send QR Code to UI
client.on('qr', qr => {
    console.log("QR Code Generated");
    ws.send(JSON.stringify({ type: "qr", data: qr }));
});


const vehicleTypes = {
    "1": "4x2",
    "2": "4x4",
    "3": "מיני וואן",
    "4": "מסחרי קטן",
    "5": "מסחרי גדול",
    "6": "משאיות עד 15 טון"
};

// Define license group prices
const priceTable = {
    "4x2": { "1": 600, "2": 600, "3": 600, "4": 690, "5": 690, "6": 860, "7": 1250 },
    "4x4": { "1": 860, "2": 860, "3": 860, "4": 1000, "5": 1000, "6": 1300, "7": 1500 },
    "מיני וואן": { "1": 860, "2": 860, "3": 860, "4": 1000, "5": 1000, "6": 1300, "7": 1500 },
    "מסחרי קטן": 860,
    "מסחרי גדול": 1550,
    "משאיות עד 15 טון": 2100
};

const userStates = new Map(); // Track each user's state separately
const userLastMessageTime = new Map(); // Track last message times

const USERS_FILE = 'users.json';
let knownUsers = new Set();
const TIMEOUT_THRESHOLD = 30 * 60 * 1000; // 30 minutes in milliseconds


// Load existing users from the file
if (fs.existsSync(USERS_FILE)) {
    try {
        const rawData = fs.readFileSync(USERS_FILE);
        knownUsers = new Set(JSON.parse(rawData));
    } catch (error) {
        console.error("Error parsing users file:", error);
    }
}

function sendFirstTimeMainMenu(chatId){
    client.sendMessage(chatId, `תודה שפניתם לדינמומטר ישראל`)
}

// Function to send the main menu
function sendMainMenu(chatId) {
    client.sendMessage(chatId, ` נא להקיש את המספר המתאים:

‏‎1️⃣ - בדיקה לפני קנייה
‏‎2️⃣ - טסט (בדיקת רישוי שנתית)
‏‎3️⃣ - פרונט
‏‎4️⃣ - אביזרים
‏‎5️⃣ - פרטים על סניפינו
‏‎6️⃣ - אחר`);

    userStates.set(chatId, { step: "main_menu" }); // Reset user state to main menu
}



client.on('ready', () => {
    console.log('WhatsApp bot is ready!');

    // Keep session alive without sending messages
    setInterval(async () => {
        try {
            await client.getChats(); // Prevent session timeout
            console.log("✅ Session refreshed, bot is still active.");
        } catch (error) {
            console.error("⚠️ Error keeping the bot active:", error);
        }
    }, 1800000); // Every 30 minutes
});

client.on('message', async message => {
    const chatId = message.from;
    const text = message.body.trim();
    const currentTime = Date.now(); // Get current timestamp
    let userState = userStates.get(chatId) || { step: "main_menu" };

    // Delay state reset to avoid immediate duplicate menus
    if (!knownUsers.has(chatId)) {
        console.log("this is a new user with ID:", chatId);
        knownUsers.add(chatId);
        fs.writeFileSync(USERS_FILE, JSON.stringify([...knownUsers]));
        sendFirstTimeMainMenu(chatId);
    }
    setTimeout(() => {}, 3000);  // 3-second delay before allowing another menu
    if (userLastMessageTime.has(chatId) && (currentTime - userLastMessageTime.get(chatId)) > TIMEOUT_THRESHOLD) {
        console.log("this user sent a message now after 1 hour", chatId);
        if (userState.step !== "waiting_for_support") {
            userState = {step: "first_timer"};
            sendMainMenu(chatId);
        }
    }

// Update last message time after checking
    userLastMessageTime.set(chatId, currentTime);




    // Handle different menu selections based on user's current state
    switch (userState.step) {
        case "main_menu":
            if (text === '1') {
                client.sendMessage(chatId, `🚗 נא לבחור אפשרות:
‏‎1️⃣ - זמני קבלה לבדיקה
‏‎2️⃣ - מחיר הבדיקה
‏‎3️⃣ - אחריות לבדיקה
‏‎4️⃣ - מה הבדיקה כוללת

🔄 להקיש 0 לחזרה לתפריט הראשי`);
                userStates.set(chatId, {step: "pre_purchase_check_menu"});
            } else if (text === '2') {
                client.sendMessage(chatId, `📌 בחר אפשרות:
1️⃣ - 📑 מה צריך להביא לטסט
2️⃣ - 🕒 שעות פעילות לטסטים
3️⃣ - 📲 וואטסאפ לשליחת טפסים
4️⃣ - מידע על אישור בלמים/מיושן


🔄 להקיש 0 לחזרה לתפריט הראשי`);
                userStates.set(chatId, {step: "test_menu"});
            } else if (text === '3') {
                client.sendMessage(chatId, `📞 לקביעת פרונט יש להתקשר לארקדי - 0522787076`);
            } else if (text === '4') {
                client.sendMessage(chatId, `📌 בחר אפשרות:
1️⃣ - 🚗 לוחית רישוי לרכב
2️⃣ - 🚲 לוחית רישוי לאופניים/קורקינט חשמלי
3️⃣ - 🛒 מידע על כל שאר האביזרים שקיימים אצלנו לרכישה בסניף

🔄 להקיש 0 לחזרה לתפריט הראשי.`);
                userStates.set(chatId, {step: "product_menu"});
            }else if (text === '5') {
                client.sendMessage(chatId,
                    `📍 *כתובות הסניפים שלנו:*  
    📌 *תל אביב* - חרוץ 2  
    🔗 [פתח במפות Google](https://maps.google.com/?q=חרוץ+2,+תל+אביב)  

    📌 *רעננה* - התעשייה 14  
    🔗 [פתח במפות Google](https://maps.google.com/?q=התעשייה+14,+רעננה)  
    `
                );

            } else if (text === '6') {
                client.sendMessage(chatId, `נציג יתפנה אליכם בשעות הפעילות, אנא כתבו בפירוט את מה שאתם צריכים:`);
                console.log("waiting for support replay",userState.step);
                userStates.set(chatId, {step: "waiting_for_support"});
            } else{
                console.log("Someone sent an invalid message during the main menu.");

                if (userState.step !== "just_sent_main_menu") {
                    sendMainMenu(chatId);
                    userStates.set(chatId, {step: "just_sent_main_menu"}); // Prevent duplication

                    // Reset back to main menu state after 3 seconds
                    setTimeout(() => {
                        userStates.set(chatId, {step: "main_menu"});
                    }, 1000);

                }            }
            break;

        case "pre_purchase_check_menu":
            if (text === '1') {
                client.sendMessage(chatId, `🕒 זמני קבלה לבדיקה:
- יום א', ב', ד', ה': 7:30-15:30
- יום ג': 7:30-13:00
- יום ו': 7:30-11:00

לא ניתן לקבוע תור לבדיקה, הגעה היא בשעות הקבלה הרשומות.

🔄 להקיש 0 לחזרה לתפריט הראשי`);
            } else if (text === '2') {
                client.sendMessage(chatId, `💰 מחיר הבדיקה:
אנא בחר את סוג הרכב:
1️⃣ - סוג הנעה 4x2
2️⃣ - סוג הנעה 4x4
3️⃣ - מיני וואן
4️⃣ - מסחרי קטן
6️⃣ - משאיות עד 15 טון

🔄 להקיש 0 לחזרה לתפריט הראשי`);
                userStates.set(chatId, {step: "vehicle_selection"});
            } else if (text === '3') {
                client.sendMessage(chatId, `הבדיקה כוללת אחריות למשך 3 חודשים על המנוע (במידה ונמצא תקין) ועל שלדת הרכב. האחריות אינה חלה על מערכות חשמל ואלקטרוניקה, מנוע חשמלי ומערכות היברידיות.`);
            } else if (text === '4') {
                client.sendMessage(chatId, `בודקים את כל המערכות כולל מנוע, תיבת הילוכים, תאונות ושלדה.`);
            } else if (text === '0') {
                sendMainMenu(chatId);
            }
            break;

        case "test_menu":
            if (text === '1') {
                client.sendMessage(chatId, `📑 מה צריך להביא לטסט:
- רישיון רכב חדש + אגרה משולמת
- ביטוח חובה בתוקף
- תעודה מזהה של בעל הרכב
- ייפוי כוח בכתב יד של בעל הרכב במידה ובעל הרכב לא מגיע
- כאשר רכבכם נמצא על הכביש במשך 15 שנים, הוא מחויב באישור בלמים. אם חלפו 19 שנים, נדרש אישור רכב מיושן במקום.

🔄 להקיש 0 לחזרה לתפריט הראשי`);
            } else if (text === '2') {
                client.sendMessage(chatId, `🕒 שעות פעילות לטסטים:
- יום א', ב', ד', ה': 7:30-16:15
- יום ג': 7:30-13:45
- יום ו': 7:30-11:45

*לא ניתן לקבוע תור לטסט, הגעה היא בשעות פעילות הרשומות.*


🔄 להקיש 0 לחזרה לתפריט הראשי`);
            } else if (text === '3') {
                client.sendMessage(chatId, `📲 וואטסאפ לשליחת טפסים:
- תל-אביב: https://wa.me/message/QEDFYEZ5IXCJO1
- רעננה: https://wa.me/message/VTEGWQ2IJMMYB1
- ירושלים: https://wa.me/qr/J6LDI4VOOI3JO1

🔄 להקיש 0 לחזרה לתפריט הראשי`);
            }else if (text === '4') {
                client.sendMessage(chatId,`כאשר רכבכם נמצא על הכביש במשך 15 שנים, הוא מחויב באישור בלמים. אם חלפו 19 שנים, נדרש אישור רכב מיושן במקום.
במידה ורכבכם זקוק לאישור בלמים או אישור מיושן לצורך ביצוע הטסט, יש לבצע את הבדיקה במוסך מורשה. לאחר קבלת האישור המקורי, ניתן להגיע אלינו לסניף לצורך ביצוע הטסט.
לתשומת ליבכם, תוקף האישור הוא ל-3 חודשים בלבד.
                
🔄 להקיש 0 לחזרה לתפריט הראשי`);
            }
            else if (text === '0') {
                sendMainMenu(chatId);
            }
            break;
        case "vehicle_selection":
            if (["1", "2", "3"].includes(text)) {
                const selectedVehicle = vehicleTypes[text];
                userStates.set(chatId, {step: "license_group", vehicle: selectedVehicle});

                client.sendMessage(chatId, `🚗 מהי קבוצת הרישוי?
1️⃣ - 1
2️⃣ - 2
3️⃣ - 3
4️⃣ - 4
5️⃣ - 5
6️⃣ - 6
7️⃣ - 7

🔄 להקיש 0 לחזרה לתפריט הראשי`);
            } else if (["4", "5", "6"].includes(text)) {
                const selectedVehicle = vehicleTypes[text];
                const price = priceTable[selectedVehicle];

                client.sendMessage(chatId, `💰 מחיר הבדיקה עבור **${selectedVehicle}**: ${price} ש"ח 
            
            🔄 להקיש 0 לחזרה לתפריט הראשי`);
            } else if (text === '0') {
                sendMainMenu(chatId);
            }
            break;
        case "license_group":
            if (["1", "2", "3", "4", "5", "6", "7"].includes(text)) {
                const selectedVehicle = userStates.get(chatId).vehicle;
                const price = priceTable[selectedVehicle][text];

                client.sendMessage(chatId, `💰 מחיר הבדיקה עבור **${selectedVehicle}** בקבוצת רישוי **${text}**: ${price} ש"ח 
            
            🔄 להקיש 0 לחזרה לתפריט הראשי`);
            }
            else if (text === '0') {
                sendMainMenu(chatId);
            }
            break;
        case "product_menu":
            switch (text) {
                case "1":
                    client.sendMessage(chatId, `ניתן לרכוש לוחית רישוי לרכב בכל אחד מסניפינו.
במקרה של אובדן או גניבה, יש להוציא אישור אבידה/גניבה מהמשטרה, ולאחר מכן להגיע עם האישור לאחד מסניפינו במהלך שעות הפעילות לצורך ייצור והתקנת לוחית חדשה על הרכב.
 
🔄 להקיש 0 לחזרה לתפריט הראשי`);
                    break;
                case "2":
                    client.sendMessage(chatId, `*רישום הכלי במשרד התחבורה*  
לפני רכישת לוחית רישוי, יש לבצע רישום של הכלי באתר משרד התחבורה:

https://www.gov.il/he/service/bicycle-and-scooter-registration  

*קבלת מספר רישוי ורכישה באתר*  
לאחר הרישום, תקבלו מספר רישוי שאיתו ניתן לבצע רכישה באתר שלנו:

 https://www.dynamometer-shop.com  

*איסוף הלוחית מהסניף*  
לאחר ביצוע ההזמנה באתר, הלוחית תהיה מוכנה לאיסוף בסניף שבחרתם בתוך *יום עסקים אחד*.  
האיסוף אפשרי בהתאם לשעות הפעילות הבאות:  

📅 *שעות פעילות הסניפים:*  
🔹 *יום א', ב', ד', ה'* – 07:30-16:15  
🔹 *יום ג'* – 07:30-13:45  
🔹 *יום ו'* – 07:30-11:45  

📍 *יש להגיע לסניף שבחרתם במהלך ההזמנה.*  

🔄 להקיש 0 לחזרה לתפריט הראשי`);

                    break;
                case "3":
                    client.sendMessage(chatId,`אצלנו תוכלו למצוא מגוון אביזרים נוספים לרכישה ישירות בסניף הכוללים:
💡 מנורות
🚗 מגבים
✨ פסים זוהרים
⚖️ רישום משקולות ועוד...

📍 מוזמנים להגיע ולרכוש בסניף!

🔄 להקיש 0 לחזרה לתפריט הראשי`);
                    break;
                case "0":
                    sendMainMenu(chatId);
                    break;
            }

    }
});

console.log("Loaded WhatsApp module...");

// Handle WhatsApp Web disconnection
client.on('disconnected', (reason) => {
    console.log(`⚠️ WhatsApp bot disconnected: ${reason}`);
    console.log('🔄 Restarting the bot...');

    // Instead of exiting, reinitialize the bot
    setTimeout(() => {
        client.initialize();
        console.log("♻️ Bot reconnected successfully!");
    }, 5000); // Wait 5 seconds before reconnecting
});


process.on("SIGINT", async () => {
    console.log("(SIGINT) Shutting down...");
    await client.destroy();
    process.exit(0);
});

// Start the bot
client.initialize();



// Start Express server to show QR code
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 QR code available at http://localhost:${PORT}/qr`));