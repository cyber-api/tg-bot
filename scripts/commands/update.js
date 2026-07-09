const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

function compareVersion(version1, version2) {
    const v1 = version1.split(".");
    const v2 = version2.split(".");
    for (let i = 0; i < 3; i++) {
        const num1 = parseInt(v1[i] || 0, 10);
        const num2 = parseInt(v2[i] || 0, 10);
        if (num1 > num2) return 1;
        if (num1 < num2) return -1;
    }
    return 0;
}

module.exports = {
    config: {
        name: "update",
        version: "1.0.0",
        author: "AI Studio",
        role: 2,
        category: "owner",
        description: "Check for and install updates for the Telegram bot.",
        usage: "update"
    },

    onStart: async function ({ msg, bot, config }) {
        const chatId = msg.chat.id.toString();
        const userId = msg.from.id.toString();

        const isAdmin = config.adminId.includes(userId) || (config.owner && config.owner.toString() === userId.toString());
        if (!isAdmin) {
            return bot.sendMessage(chatId, "⚠️ You do not have permission to use the update command.", { replyToMessage: msg.message_id });
        }

        try {
            await bot.sendMessage(chatId, "🔄 Checking for latest updates...", { replyToMessage: msg.message_id });

            let versionsList = [];
            let latestVersion = "1.5.0";
            let currentVersion = require("../../package.json").version;

            try {
                const res = await axios.get("https://raw.githubusercontent.com/cyber-api/tg-bot/refs/heads/main/versions.json", { timeout: 5000 });
                versionsList = res.data;
            } catch (err) {
                const localPath = path.resolve(process.cwd(), "versions.json");
                if (fs.existsSync(localPath)) {
                    versionsList = JSON.parse(fs.readFileSync(localPath, "utf-8"));
                }
            }

            if (Array.isArray(versionsList) && versionsList.length > 0) {
                latestVersion = versionsList[versionsList.length - 1].version || latestVersion;
            }

            if (compareVersion(latestVersion, currentVersion) <= 0) {
                return bot.sendMessage(chatId, `✅ You are using the latest version of ${config.botName || 'Bot'} (v${currentVersion}).`, { replyToMessage: msg.message_id });
            }

            const replyMarkup = bot.inlineKeyboard([
                [
                    bot.inlineButton('✅ Confirm Update', { callback: `confirm_update_${latestVersion}` }),
                    bot.inlineButton('❌ Cancel', { callback: 'cancel_update' })
                ]
            ]);

            await bot.sendMessage(chatId, `🚀 Update Available!\n\nCurrent version: v${currentVersion}\nLatest version: v${latestVersion}\n\nDo you want to update now?`, { replyToMessage: msg.message_id, replyMarkup });
        } catch (e) {
            await bot.sendMessage(chatId, `❌ Error checking updates: ${e.message}`, { replyToMessage: msg.message_id });
        }
    }
};
