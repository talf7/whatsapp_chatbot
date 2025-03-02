const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
    authStrategy: new LocalAuth()

});

// Store user states
const userStates = new Map()
// Define vehicle types
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
    console.log('WhatsApp bot is ready!');
});

// Handle incoming messages
client.on('message', async message => {
    const chatId = message.from;
    const text = message.body.trim();
    // Return to main menu if "0" is pressed


    // Handle "בדיקה לפני קנייה" submenu selection
    if (userStates.get(chatId) === "pre_purchase_check_menu") {
        if (text === '1') {
            client.sendMessage(chatId, `🕒 זמני קבלה לבדיקה:
- יום א', ב', ד', ה': 7:30-15:00
- יום ג': 7:30-12:30
- יום ו': 7:30-10:30
📌 הגעה אחרי השעות שצוינו פה צריך אישור מיוחד מהבודק.

🔄 להקיש 0 לחזרה לתפריט הראשי`);
        } else if (text === '2') {
            client.sendMessage(chatId, `💰 מחיר הבדיקה:
אנא בחר את סוג הרכב:
1️⃣ - סוג הנעה 4x2
2️⃣ - סוג הנעה 4x4
3️⃣ - מיני וואן
4️⃣ - מסחרי קטן
5️⃣ - מסחרי גדול
6️⃣ - משאיות עד 15 טון

🔄 להקיש 0 לחזרה לתפריט הראשי`);
            userStates.set(chatId, "vehicle_selection");
        }
        else if (text === '3') {
            client.sendMessage(chatId,`קיימת אחריות לבדיקה עצמה של 3 חודשים על המנוע ושלדה.`)
        }
        else if (text === '4') {
            client.sendMessage(chatId,`בודקים את כל המערכות כולל מנוע,תיבת הילוכים תאונות ושילדה.`)
        }
        else if (text === '0') {
            sendMainMenu(chatId);
        }
        return;
    }

    // Handle vehicle selection (for מחיר הבדיקה)
    if (userStates.get(chatId) === "vehicle_selection") {
        if (["1", "2", "3"].includes(text)) {
            const selectedVehicle = vehicleTypes[text];
            userStates.set(chatId, { step: "license_group", vehicle: selectedVehicle });

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
        }
        else if (text === '0') {
            sendMainMenu(chatId);
        }
        return;

    }

    // Handle license group selection
    if (userStates.get(chatId)?.step === "license_group") {
        if (["1", "2", "3", "4", "5", "6", "7"].includes(text)) {
            const selectedVehicle = userStates.get(chatId).vehicle;
            const price = priceTable[selectedVehicle][text];

            client.sendMessage(chatId, `💰 מחיר הבדיקה עבור **${selectedVehicle}** בקבוצת רישוי **${text}**: ${price} ש"ח 
            
            🔄 להקיש 0 לחזרה לתפריט הראשי`);
        }
        else if (text === '0') {
            sendMainMenu(chatId);
        }
        return;
    }

    // Handle טסטים (בדיקת רישוי שנתית) submenu selection
    if (userStates.get(chatId) === "test_menu" && userStates.size !== 0) {
        if (text === '1') {
            client.sendMessage(chatId, `📑 מה צריך להביא לטסט:
- רישיון רכב חדש
- ביטוח חובה בתוקף
- תעודה מזהה של בעל הרכב

🔄 להקיש 0 לחזרה לתפריט הראשי`);
        } else if (text === '2') {
            client.sendMessage(chatId, `🕒 שעות פעילות לטסטים:
- יום א', ב', ד', ה': 7:30-16:15
- יום ג': 7:30-13:45
- יום ו': 7:30-11:45

🔄 להקיש 0 לחזרה לתפריט הראשי`);
        } else if (text === '3') {
            client.sendMessage(chatId, `📲 וואטסאפ לשליחת טפסים עבור כל סניף:
תל-אביב: https://wa.me/message/QEDFYEZ5IXCJO1
רעננה: https://wa.me/message/VTEGWQ2IJMMYB1
ירושלים: https://wa.me/qr/J6LDI4VOOI3JO1

🔄 להקיש 0 לחזרה לתפריט הראשי`);
        }
        else if (text === '0') {
            sendMainMenu(chatId);
        }
        return;
    }

    if (text === '0') {
        sendMainMenu(chatId);
    }

    // Main Menu Options
    if (userStates.size === 0){
        if (text === '1') {
            client.sendMessage(chatId, `🚗 נא לבחור אפשרות:
‏‎1️⃣ - זמני קבלה לבדיקה
‏‎2️⃣ - מחיר הבדיקה
‏‎3️⃣ - אחריות לבדיקה
‏‎4️⃣ - מה הבדיקה כוללת

🔄 להקיש 0 לחזרה לתפריט הראשי`);
            userStates.set(chatId, "pre_purchase_check_menu");
        } else if (text === '2') {
            client.sendMessage(chatId, `📌 בחר אפשרות:
1️⃣ - 📑 מה צריך להביא לטסט
2️⃣ - 🕒 שעות פעילות לטסטים
3️⃣ - 📲 וואטסאפ לשליחת טפסים עבור כל סניף

🔄 להקיש 0 לחזרה לתפריט הראשי`);
            userStates.set(chatId, "test_menu");
        } else if (text === '3') {
            client.sendMessage(chatId, `📞 לקביעת פרונט יש להתקשר לארקדי - 0522787076
            
🔄 להקיש 0 לחזרה לתפריט הראשי`);
        }
        else if (text === '4') {
            client.sendMessage(chatId,`נציג יתפנה אליכם בשעות הפעילות`);
        }
        else{
            sendMainMenu(chatId);
        }
    }
});
console.log("Loaded WhatsApp module...");
process.on("SIGINT", async () => {
    console.log("(SIGINT) Shutting down...");
    await client.destroy();
    process.exit(0);
})
// Start the bot
client.initialize();
