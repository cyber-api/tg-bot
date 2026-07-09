import express from "express";
import path from "path";
import fs from "fs";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import TeleBot from "telebot";
import axios from "axios";
import { createRequire } from "module";
import { setupDashboardRoutes } from "./dashboard.js";

const require = createRequire(import.meta.url);
const connectDB = require("./database/connectDB.js");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Bot state management
let botInstance = null;
let botStartTime = Date.now();
let botStatus = "stopped";
let recentLogs = [];
let dbInstance = null;

function logMessage(msg) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${msg}`;
  console.log(line);
  recentLogs.unshift(line);
  if (recentLogs.length > 200) recentLogs.pop();
}

async function sendAdminNotification(bot, config, messageText) {
  const admins = new Set();
  if (Array.isArray(config.adminId)) {
    config.adminId.forEach(id => admins.add(id.toString()));
  }
  if (config.owner) {
    admins.add(config.owner.toString());
  }
  for (const adminId of admins) {
    try {
      await bot.sendMessage(adminId, messageText);
    } catch (err) {
      logMessage(`Failed to send notification to admin ${adminId}: ${err.message}`);
    }
  }
  logMessage(`[ADMIN NOTIFICATION SENT]\n${messageText}`);
}

function getBotState() {
  return {
    botInstance,
    botStartTime,
    botStatus,
    recentLogs,
    dbInstance
  };
}

async function startBot() {
  try {
    const configRaw = fs.readFileSync(path.resolve(process.cwd(), "config.json"), "utf-8");
    const config = JSON.parse(configRaw);

    if (!config.botToken || config.botToken === "Bot_Token") {
      logMessage("⚠️ Bot Token is not set in config.json. Bot will not connect to Telegram until a valid token is provided.");
      botStatus = "waiting_for_token";
      return;
    }

    logMessage(`Initializing database (Type: ${config.databaseType || 'sqlite'})...`);
    dbInstance = await connectDB(config);
    const { threadModel, userModel } = dbInstance;

    logMessage(`Starting Telegram bot (${config.botName || 'Yukai Bot'})...`);
    botInstance = new TeleBot(config.botToken);

    // --- Advanced Version & Outdated Check System ---
    let versionsList = [];
    let latestVersion = "1.5.0";
    let currentVersion = require("./package.json").version;
    try {
      try {
        const res = await axios.get("https://raw.githubusercontent.com/cyber-ullash/cyber-ullash/main/versions.json", { timeout: 5000 });
        versionsList = res.data;
      } catch (err) {
        logMessage(`GitHub version fetch failed (${err.message}). Using local versions.json fallback.`);
        const localPath = path.resolve(process.cwd(), "versions.json");
        if (fs.existsSync(localPath)) {
          versionsList = JSON.parse(fs.readFileSync(localPath, "utf-8"));
        }
      }

      if (Array.isArray(versionsList) && versionsList.length > 0) {
        latestVersion = versionsList[versionsList.length - 1].version || latestVersion;
        const currentIndex = versionsList.findIndex(v => v.version === currentVersion);
        const latestIndex = versionsList.findIndex(v => v.version === latestVersion);

        if (currentIndex !== -1 && latestIndex !== -1) {
          const versionsBehind = latestIndex - currentIndex;

          logMessage(`[VERSION CHECK]\nCurrent: ${currentVersion}\nLatest: ${latestVersion}\nStatus: ${versionsBehind === 0 ? "Up to date" : `${versionsBehind} version(s) behind`}`);

          if (versionsBehind >= 4) {
            const errorBlockMsg = `====================================\nBOT UPDATE REQUIRED\n\nYour bot version is too old.\n\nCurrent version:\n${currentVersion}\n\nRequired minimum / Latest version:\n${latestVersion}\n\nPlease update using update command\nor manually update your files.\n====================================`;
            console.error(errorBlockMsg);
            logMessage("[BLOCKED] Bot requires update. Startup stopped.");

            const blockAdminMsg = `🚫 Bot Disabled\n\nYour bot is too outdated.\n\nCurrent version:\n${currentVersion}\n\nLatest version:\n${latestVersion}\n\nYou must update the bot before running it again.\n\nUse:\n /update\n\nor manually update from repository.`;
            await sendAdminNotification(botInstance, config, blockAdminMsg);

            botStatus = "blocked_outdated";
            return;
          } else if (versionsBehind >= 1 && versionsBehind <= 3) {
            const warningMsg = `⚠️ Update Warning\n\nYour bot version: ${currentVersion}\nLatest version: ${latestVersion}\n\nYour bot is now ${versionsBehind} version(s) behind.\n\nPlease update your bot soon.\nIf you do not update, the bot may stop working after the next version release.`;
            logMessage(`[WARNING] Bot is ${versionsBehind} version(s) behind.`);
            await sendAdminNotification(botInstance, config, warningMsg);
          }
        }
      }
    } catch (vErr) {
      logMessage(`Version check error: ${vErr.message}`);
    }

    // Load commands
    const commands = new Map();
    const aliases = new Map();
    const loadCommands = (dir) => {
      if (!fs.existsSync(dir)) return;
      fs.readdirSync(dir).forEach(file => {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
          loadCommands(filePath);
        } else if (file.endsWith('.js')) {
          try {
            delete require.cache[require.resolve(filePath)];
            const command = require(filePath);
            if (command.config) {
              commands.set(command.config.name.toLowerCase(), command);
              if (command.config.aliases) {
                command.config.aliases.forEach(alias => aliases.set(alias.toLowerCase(), command.config.name.toLowerCase()));
              }
            }
          } catch (e) {
            logMessage(`Error loading command ${file}: ${e.message}`);
          }
        }
      });
    };
    loadCommands(path.resolve(process.cwd(), 'scripts/commands'));

    // Load events
    const loadEvents = async () => {
      const eventsDir = path.resolve(process.cwd(), 'scripts', 'events');
      if (!fs.existsSync(eventsDir)) return;
      fs.readdirSync(eventsDir).forEach(file => {
        if (file.endsWith('.js')) {
          try {
            delete require.cache[require.resolve(path.join(eventsDir, file))];
            const event = require(path.join(eventsDir, file));
            if (event.config && event.onEvent) {
              botInstance.on(event.config.name, (msg) => event.onEvent({ bot: botInstance, threadModel, userModel, msg, config }));
            }
          } catch (e) {
            logMessage(`Error loading event ${file}: ${e.message}`);
          }
        }
      });
      logMessage('Events loaded and bound successfully.');
    };
    await loadEvents();

    const isAdmin = (userId, chatAdmins) => {
      return chatAdmins.some(admin => admin.user.id.toString() === userId.toString());
    };

    const isGloballyBanned = async (userId) => {
      try {
        const response = await axios.get('https://raw.githubusercontent.com/notsopreety/Uselessrepo/main/gban.json');
        const bannedUsers = response.data;
        return bannedUsers.find(user => user.userId.toString() === userId.toString()) || null;
      } catch (error) {
        return null;
      }
    };

    const cooldowns = new Map();

    const hasPermission = async (userId, chatId, commandConfig) => {
      const chatAdmins = chatId ? await botInstance.getChatAdministrators(chatId).catch(() => []) : [];
      if (commandConfig.onlyAdmin) {
        return config.adminId.includes(userId.toString());
      } else {
        const userIsAdmin = isAdmin(userId, chatAdmins);
        if (commandConfig.role === 1) {
          return userIsAdmin;
        }
        return config.adminId.includes(userId.toString());
      }
    };

    // Callback query handler for inline keyboards
    botInstance.on('callbackQuery', async (msg) => {
      const data = msg.data;
      const chatId = msg.message.chat.id.toString();
      const messageId = msg.message.message_id;

      try {
        if (data.startsWith('help_page_')) {
          const page = parseInt(data.replace('help_page_', ''), 10);
          const commandsDir = path.resolve(process.cwd(), 'scripts', 'commands');
          const commandFiles = fs.existsSync(commandsDir) ? fs.readdirSync(commandsDir).filter(file => file.endsWith('.js') && file !== 'test.js') : [];
          const cmdsArr = commandFiles.map(file => require(path.join(commandsDir, file)));
          const totalPages = Math.max(1, Math.ceil(cmdsArr.length / 15));
          const validPage = Math.max(1, Math.min(page, totalPages));
          const start = (validPage - 1) * 15;
          const end = Math.min(start + 15, cmdsArr.length);
          const commandList = cmdsArr.slice(start, end);

          let helpMessage = `Hello!\nHere's My Command List\n\n━━━━━━━━━━━━━━━━━━━━━━`;
          commandList.forEach((cmd, index) => {
            helpMessage += `\n[${start + index + 1}]. ${cmd.config.name} - ${cmd.config.description || ''}\n`;
          });
          helpMessage += `\n━━━━━━━━━━━━━━━━━━━━━━\nPage [ ${validPage}/${totalPages} ]\n`;
          helpMessage += `Currently, the bot has ${cmdsArr.length} commands that can be used\n`;
          helpMessage += `» Click buttons below to navigate or view categories\n`;
          helpMessage += `━━━━━━━━━━━━━━━━━━━━━━\n${config.copyrightMark}`;

          const keyboardButtons = [];
          let navRow = [];
          if (validPage > 1) {
            navRow.push(botInstance.inlineButton('⬅️ Prev', { callback: `help_page_${validPage - 1}` }));
          }
          navRow.push(botInstance.inlineButton(`📄 ${validPage}/${totalPages}`, { callback: `help_page_${validPage}` }));
          if (validPage < totalPages) {
            navRow.push(botInstance.inlineButton('Next ➡️', { callback: `help_page_${validPage + 1}` }));
          }
          keyboardButtons.push(navRow);
          keyboardButtons.push([
            botInstance.inlineButton('📑 Categories View', { callback: 'help_categories' }),
            botInstance.inlineButton('🔄 Refresh', { callback: `help_page_${validPage}` })
          ]);
          const replyMarkup = botInstance.inlineKeyboard(keyboardButtons);

          await botInstance.editMessageText(
            { chat_id: chatId, message_id: messageId },
            helpMessage,
            { replyMarkup, parseMode: 'markdown' }
          );
          await botInstance.answerCallbackQuery(msg.id, { text: `Page ${validPage} loaded` });
        } else if (data === 'help_categories') {
          const commandsDir = path.resolve(process.cwd(), 'scripts', 'commands');
          const commandFiles = fs.existsSync(commandsDir) ? fs.readdirSync(commandsDir).filter(file => file.endsWith('.js') && file !== 'test.js') : [];
          const cmdsArr = commandFiles.map(file => require(path.join(commandsDir, file)));

          let helpMessage = `Hello!\nHere's My Commands by Category\n\n`;
          const commandsByCategory = {};
          cmdsArr.forEach(cmd => {
            const { name, category = 'general' } = cmd.config;
            if (!commandsByCategory[category]) {
              commandsByCategory[category] = [];
            }
            commandsByCategory[category].push(name);
          });

          Object.entries(commandsByCategory).forEach(([category, cmds]) => {
            helpMessage += `╭──────❨ ${category} ❩\n`;
            cmds.forEach(cmd => {
              helpMessage += `├ ${cmd}\n`;
            });
            helpMessage += `╰──────────────●\n`;
          });

          helpMessage += `Total Commands: ${cmdsArr.length}\n${config.copyrightMark}`;
          const replyMarkup = botInstance.inlineKeyboard([
            [botInstance.inlineButton('🔙 Back to Pagination', { callback: 'help_page_1' })]
          ]);

          await botInstance.editMessageText(
            { chat_id: chatId, message_id: messageId },
            helpMessage,
            { replyMarkup, parseMode: 'markdown' }
          );
          await botInstance.answerCallbackQuery(msg.id, { text: 'Categories loaded' });
        } else if (data.startsWith('confirm_update_')) {
          const targetVersion = data.replace('confirm_update_', '');
          const userId = msg.from.id.toString();
          const isAdmin = config.adminId.includes(userId) || (config.owner && config.owner.toString() === userId.toString());
          if (!isAdmin) {
            await botInstance.answerCallbackQuery(msg.id, { text: 'Unauthorized!', show_alert: true });
            return;
          }

          await botInstance.editMessageText(
            { chat_id: chatId, message_id: messageId },
            `✅ Update confirmed to v${targetVersion}. Updating local package.json & restarting bot...`,
            { parseMode: 'markdown' }
          );

          try {
            const pkgPath = path.resolve(process.cwd(), 'package.json');
            const pkgData = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            pkgData.version = targetVersion;
            fs.writeFileSync(pkgPath, JSON.stringify(pkgData, null, 2), 'utf-8');

            logMessage(`[UPDATE] Bot successfully updated to version ${targetVersion}. Restarting...`);
            await botInstance.sendMessage(chatId, `🎉 Update complete! Bot is restarting to apply v${targetVersion}.`);

            setTimeout(() => {
              process.exit(2);
            }, 1000);
          } catch (upErr) {
            await botInstance.sendMessage(chatId, `❌ Update failed: ${upErr.message}`);
          }
          await botInstance.answerCallbackQuery(msg.id, { text: 'Update initiated' });
        } else if (data === 'cancel_update') {
          await botInstance.editMessageText(
            { chat_id: chatId, message_id: messageId },
            `❌ Update cancelled.`,
            { parseMode: 'markdown' }
          );
          await botInstance.answerCallbackQuery(msg.id, { text: 'Update cancelled' });
        }
      } catch (err) {
        logMessage(`Error handling callbackQuery: ${err.message}`);
      }
    });

    // Anti-React feature handler
    botInstance.on('update', async (update) => {
      try {
        const reactionUpdate = update.message_reaction || update.messageReaction;
        if (!reactionUpdate) return;

        if (!config.antiReact || !config.antiReact.enable) return;

        const chatId = reactionUpdate.chat?.id?.toString();
        const messageId = reactionUpdate.message_id;
        const userObj = reactionUpdate.user || reactionUpdate.actor_user;
        const userId = userObj?.id?.toString();

        if (!chatId || !messageId || !userId) return;

        const newReactions = reactionUpdate.new_reaction || [];
        const emojis = newReactions.map(r => r.emoji || r.type).filter(Boolean);
        if (emojis.length === 0) return;

        const isBotAdmin = config.adminId.includes(userId) || (config.owner && config.owner.toString() === userId.toString());

        if (config.antiReact.onlyAdminBot && !isBotAdmin) return;

        // 1. Unsend message via reaction
        if (config.antiReact.reactByUnsend && config.antiReact.reactByUnsend.enable) {
          const targetEmojis = config.antiReact.reactByUnsend.emojis || ["❌", "🗑️"];
          const hasMatch = emojis.some(e => targetEmojis.includes(e));
          if (hasMatch) {
            try {
              await botInstance.deleteMessage(chatId, messageId);
              logMessage(`[ANTI-REACT] Message ${messageId} in chat ${chatId} unsent due to reaction by user ${userId}`);
            } catch (err) {
              logMessage(`[ANTI-REACT] Failed to unsend message: ${err.message}`);
            }
          }
        }

        // 2. Remove user from group via reaction
        if (config.antiReact.reactByRemove && config.antiReact.reactByRemove.enable) {
          const targetEmoji = config.antiReact.reactByRemove.emoji || "🚫";
          const hasRemoveMatch = emojis.includes(targetEmoji);
          if (hasRemoveMatch) {
            if (!isBotAdmin) return;
            try {
              await botInstance.kickChatMember(chatId, userId);
              await botInstance.sendMessage(chatId, `🚫 User removed due to admin reaction (${targetEmoji}).`);
              logMessage(`[ANTI-REACT] User ${userId} removed from chat ${chatId} due to reaction ${targetEmoji}`);
            } catch (err) {
              logMessage(`[ANTI-REACT] Failed to kick user: ${err.message}`);
              await botInstance.sendMessage(chatId, `❌ Cannot kick this user. They might be an admin or I don't have permission.`);
            }
          }
        }
      } catch (err) {
        logMessage(`Error in antiReact handler: ${err.message}`);
      }
    });

    botInstance.on('text', async (msg) => {
      const chatId = msg.chat.id.toString();
      const userId = msg.from.id.toString();

      let thread = await threadModel.findOne({ chatId });
      if (!thread) {
        thread = new threadModel({ chatId });
        if (typeof thread.save === 'function') await thread.save();
      }

      let user = await userModel.findOne({ userID: userId });
      if (!user) {
        user = new userModel({
          userID: userId,
          username: msg.from.username || `user_${userId}`,
          first_name: msg.from.first_name || '',
          last_name: msg.from.last_name || ''
        });
        if (typeof user.save === 'function') await user.save();
      }

      const globalBanInfo = await isGloballyBanned(userId);
      if (globalBanInfo) {
        if (msg.text.startsWith(config.prefix)) {
          return botInstance.sendMessage(chatId, `You are globally banned from using ${config.botName}`, { replyToMessage: msg.message_id });
        }
        return;
      }

      if (user.banned) {
        if (msg.text.startsWith(config.prefix)) {
          return botInstance.sendMessage(chatId, 'You are banned from using this bot!', { replyToMessage: msg.message_id });
        }
        return;
      }

      if (msg.text.startsWith(config.prefix)) {
        const args = msg.text.slice(config.prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();
        const command = commands.get(commandName) || commands.get(aliases.get(commandName));

        if (!command) {
          return botInstance.sendMessage(chatId, 'Invalid command.', { replyToMessage: msg.message_id });
        }

        if (!(await hasPermission(userId, chatId, command.config))) {
          return botInstance.sendMessage(chatId, 'You do not have permission to use this command.', { replyToMessage: msg.message_id });
        }

        if (!cooldowns.has(commandName)) {
          cooldowns.set(commandName, new Map());
        }

        const now = Date.now();
        const timestamps = cooldowns.get(commandName);
        const cooldownAmount = (command.config.cooldown || 3) * 1000;

        if (timestamps.has(userId)) {
          const expirationTime = timestamps.get(userId) + cooldownAmount;
          if (now < expirationTime) {
            const timeLeft = (expirationTime - now) / 1000;
            return botInstance.sendMessage(chatId, `Please wait ${timeLeft.toFixed(1)} more seconds before reusing the ${commandName} command.`, { replyToMessage: msg.message_id });
          }
        }

        timestamps.set(userId, now);
        setTimeout(() => timestamps.delete(userId), cooldownAmount);

        try {
          await command.onStart({
            msg,
            bot: botInstance,
            args,
            chatId,
            userId,
            config,
            botName: config.botName,
            senderName: `${msg.from.first_name || ''} ${msg.from.last_name || ''}`.trim(),
            username: msg.from.username,
            copyrightMark: config.copyrightMark,
            threadModel,
            userModel,
            user,
            thread,
            api: config.globalapi
          });
          logMessage(`Command executed: /${commandName} by user ${userId} in chat ${chatId}`);
        } catch (error) {
          logMessage(`Error executing command ${commandName}: ${error.message}`);
          botInstance.sendMessage(chatId, 'There was an error executing the command.');
        }
      }
    });

    botInstance.start();
    botStartTime = Date.now();
    botStatus = "running";
    logMessage(`Telegram bot started successfully (DB: ${config.databaseType || 'sqlite'}).`);
  } catch (error) {
    logMessage(`Failed to start Telegram bot: ${error.message}`);
    botStatus = "error";
  }
}

async function stopBot() {
  if (botInstance) {
    try {
      botInstance.stop();
    } catch (e) {}
    botInstance = null;
  }
  botStatus = "stopped";
  logMessage("Telegram bot stopped.");
}

async function restartBot() {
  await stopBot();
  await startBot();
}

// Setup Dashboard API routes from dashboard.js
setupDashboardRoutes(app, getBotState, restartBot, stopBot, startBot);

async function startServer() {
  await startBot();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    logMessage(`Web Dashboard & Express server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
