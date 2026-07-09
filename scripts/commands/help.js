const fs = require('fs');
const path = require('path');

module.exports = {
    config: {
        name: 'help',
        aliases: ['h'],
        category: 'utility',
        role: 0,
        cooldowns: 5,
        version: '1.1.0',
        author: 'Samir Thakuri',
        description: 'Get a list of all available commands or detailed information about a specific command with interactive inline buttons',
        usage: 'help [command|page]'
    },

    onStart: async function({ msg, bot, args, config, threadModel }) {
        const chatId = msg.chat.id.toString();

        let thread = await threadModel.findOne({ chatId });
        if (!thread) {
            thread = new threadModel({ chatId });
            await thread.save();
        }

        const commandsDir = path.resolve(__dirname, '..', 'commands');
        const commandFiles = fs.readdirSync(commandsDir).filter(file => file.endsWith('.js') && file !== 'test.js');
        const commands = commandFiles.map(file => require(path.join(commandsDir, file)));

        if (!commands || !commands.length) {
            return bot.sendMessage(chatId, 'There are no available commands at the moment.', { replyToMessage: msg.message_id });
        }

        const totalPages = Math.ceil(commands.length / 15);

        // Handle specific command detail
        if (args[0] && isNaN(args[0])) {
            const commandName = args[0].toLowerCase();
            const command = commands.find(cmd => cmd.config.name.toLowerCase() === commandName || (cmd.config.aliases && cmd.config.aliases.includes(commandName)));

            if (command) {
                const { name, description, aliases = [], category, version, role, cooldowns, author, usage } = command.config;
                const roleText = role === 0 ? 'All users' : role === 1 ? 'Group admin' : 'Bot admin';
                
                const replyMarkup = bot.inlineKeyboard([
                    [bot.inlineButton('🔙 Back to Help', { callback: 'help_page_1' })]
                ]);

                return bot.sendMessage(chatId, `
━━━━━━━━━━━━━━━━━━━━━━
Name: ${name}
━━━━━━━━━━━━━━━━━━━━━━
» Description: ${description || 'No description available.'}
» Other names: ${aliases.join(', ') || 'None'}
» Category: ${category}
» Version: ${version || '1.0.0'}
» Permission: ${roleText}
» Time per command: ${cooldowns || 3} seconds
» Author: ${author || 'Samir Thakuri'}
━━━━━━━━━━  ❖  ━━━━━━━━━━
» Usage guide:
${config.prefix}${usage || name}
━━━━━━━━━━  ❖  ━━━━━━━━━━
                `, { replyToMessage: msg.message_id, replyMarkup });
            } else {
                return bot.sendMessage(chatId, `Command not found. Use ${config.prefix}help to see available commands.`, { replyToMessage: msg.message_id });
            }
        }

        // Handle page number or default page 1
        let page = 1;
        if (args[0] && !isNaN(args[0])) {
            page = parseInt(args[0], 10);
            if (page < 1 || page > totalPages) {
                page = 1;
            }
        }

        const start = (page - 1) * 15;
        const end = Math.min(start + 15, commands.length);
        const commandList = commands.slice(start, end);

        let helpMessage = `Hello, ${msg.from.first_name}!\nHere's My Command List\n\n━━━━━━━━━━━━━━━━━━━━━━`;
        commandList.forEach((cmd, index) => {
            helpMessage += `\n[${start + index + 1}]. ${cmd.config.name} - ${cmd.config.description || ''}\n`;
        });
        helpMessage += `\n━━━━━━━━━━━━━━━━━━━━━━\nPage [ ${page}/${totalPages} ]\n`;
        helpMessage += `Currently, the bot has ${commands.length} commands that can be used\n`;
        helpMessage += `» Click buttons below to navigate or view categories\n`;
        helpMessage += `━━━━━━━━━━━━━━━━━━━━━━\n${config.copyrightMark}`;

        // Create interactive inline keyboard buttons
        const keyboardButtons = [];
        
        let navRow = [];
        if (page > 1) {
            navRow.push(bot.inlineButton('⬅️ Prev', { callback: `help_page_${page - 1}` }));
        }
        navRow.push(bot.inlineButton(`📄 ${page}/${totalPages}`, { callback: `help_page_${page}` }));
        if (page < totalPages) {
            navRow.push(bot.inlineButton('Next ➡️', { callback: `help_page_${page + 1}` }));
        }
        keyboardButtons.push(navRow);
        
        keyboardButtons.push([
            bot.inlineButton('📑 Categories View', { callback: 'help_categories' }),
            bot.inlineButton('🔄 Refresh', { callback: `help_page_${page}` })
        ]);

        const replyMarkup = bot.inlineKeyboard(keyboardButtons);

        return bot.sendMessage(chatId, helpMessage, { replyToMessage: msg.message_id, replyMarkup });
    }
};
