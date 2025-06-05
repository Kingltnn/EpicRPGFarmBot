const { logger } = require("../../utils/logger");
const CaptchaDetector = require("../../utils/captcha_detection");
const CaptchaSolver = require("../../utils/captcha_solver");
const { WebhookClient } = require('discord.js');

module.exports = async (client, message) => {
    if (!client.captchaDetector) {
        client.captchaDetector = new CaptchaDetector();
    }

    if (!client.captchaSolver) {
        client.captchaSolver = new CaptchaSolver(client);
    }

    /**
     * Client
     */

    if (message.channel.id !== client.config.channelid) return;

    let msgcontent = message.content.toLowerCase();
    if (message.author.id === "555955826880413696") {
        // Kiểm tra captcha với hệ thống mới
        if (client.captchaDetector.isCaptchaMessage(msgcontent)) {
            // Dừng hoàn toàn bot
            client.global.paused = true;
            client.global.captchadetected = true;
            client.global.totalcaptcha++;

            // Ghi nhận captcha
            client.captchaDetector.recordCaptcha();

            // Log thông báo
            logger.alert("Bot", "Captcha", `Captcha Detected! Bot stopped.`);
            
            // Gửi thông báo qua Discord webhook nếu được cấu hình
            if (client.config.settings.captcha_protection.notification.discord && 
                client.config.settings.captcha_protection.webhook_url) {
                try {
                    const webhook = new WebhookClient({ 
                        url: client.config.settings.captcha_protection.webhook_url 
                    });
                    
                    // Get message link
                    const messageLink = `https://discord.com/channels/${message.guild.id}/${message.channel.id}/${message.id}`;
                    
                    await webhook.send({
                        embeds: [{
                            title: '🚨 Captcha Detected',
                            description: 'Bot has been stopped due to captcha detection.',
                            fields: [
                                {
                                    name: 'Player',
                                    value: `${client.user.tag}`,
                                    inline: true
                                },
                                {
                                    name: 'Total Captchas',
                                    value: `${client.global.totalcaptcha}`,
                                    inline: true
                                },
                                {
                                    name: 'Status',
                                    value: 'Attempting auto-solve...',
                                    inline: true
                                },
                                {
                                    name: 'Location',
                                    value: `[Click to view captcha](${messageLink})`,
                                    inline: false
                                }
                            ],
                            color: 0xFF0000,
                            timestamp: new Date()
                        }]
                    });

                    // Thử giải captcha tự động
                    const solved = await client.captchaSolver.handleCaptcha(message);
                    if (solved) {
                        // Captcha đã được giải thành công, webhook sẽ được gửi bởi phần xử lý "correct"
                        logger.info("Bot", "Captcha", "Auto-solve successful");
                    } else {
                        // Cập nhật webhook nếu không giải được
                        await webhook.send({
                            embeds: [{
                                title: '⚠️ Auto-solve Failed',
                                description: 'Manual intervention required.',
                                fields: [
                                    {
                                        name: 'Player',
                                        value: `${client.user.tag}`,
                                        inline: true
                                    },
                                    {
                                        name: 'Status',
                                        value: 'Waiting for manual solution',
                                        inline: true
                                    }
                                ],
                                color: 0xFFA500,
                                timestamp: new Date()
                            }]
                        });
                    }

                } catch (error) {
                    logger.error("Bot", "Webhook", `Failed to send webhook: ${error.message}`);
                }
            }

            // Thông báo desktop nếu được cấu hình
            if (client.config.settings.captcha_protection.notification.desktop) {
                client.notifier.notify({
                    title: "Captcha Detected!",
                    message: `Bot stopped. Auto-solve ${client.captchaSolver.lastResult ? 'succeeded' : 'failed'}.\nTotal Captchas: ${client.global.totalcaptcha}`,
                    icon: "./assets/captcha.png",
                    sound: client.config.settings.captcha_protection.notification.sound,
                    wait: true,
                    appID: "EpicRPG Farm Bot"
                });
            }
        }

        // Kiểm tra captcha clear và tự động resume
        if (client.captchaDetector.isCaptchaClearMessage(msgcontent)) {
            client.global.captchadetected = false;
            client.global.paused = false;
            
            // Reset captcha detector và solver
            client.captchaDetector.reset();
            client.captchaSolver.clearCache();
            
            logger.info("Bot", "Captcha", `Captcha solved! Bot resuming automatically...`);

            // Gửi thông báo qua Discord webhook
            if (client.config.settings.captcha_protection.notification.discord && 
                client.config.settings.captcha_protection.webhook_url) {
                try {
                    const webhook = new WebhookClient({ 
                        url: client.config.settings.captcha_protection.webhook_url 
                    });
                    
                    await webhook.send({
                        embeds: [{
                            title: '✅ Captcha Solved',
                            description: 'Bot is resuming automatically.',
                            fields: [
                                {
                                    name: 'Player',
                                    value: `${client.user.tag}`,
                                    inline: true
                                },
                                {
                                    name: 'Total Captchas',
                                    value: `${client.global.totalcaptcha}`,
                                    inline: true
                                },
                                {
                                    name: 'Solution Method',
                                    value: client.captchaSolver.lastResult ? 'Auto-solved' : 'Manual',
                                    inline: true
                                }
                            ],
                            color: 0x00FF00,
                            timestamp: new Date()
                        }]
                    });
                } catch (error) {
                    logger.error("Bot", "Webhook", `Failed to send webhook: ${error.message}`);
                }
            }

            // Tự động resume bot
            if (client.config.settings.captcha_protection.auto_resume) {
                // Đợi 2 giây trước khi resume để đảm bảo an toàn
                setTimeout(() => {
                    require("../../utils/farm.js")(client, message);
                }, 2000);
            }
        }
        //*Training River
        if (
            msgcontent.includes("is training in the river!") &&
            client.config.commands.experience.training
        ) {
            client.global.paused = true;
            let fishnumber;

            if (msgcontent.includes("<:epicfish:543182761431793715>")) {
                fishnumber = "3";
            } else if (
                msgcontent.includes("<:goldenfish:697940429500317727>")
            ) {
                fishnumber = "2";
            } else if (
                msgcontent.includes("<:normiefish:697940429999439872>")
            ) {
                fishnumber = "1";
            }

            logger.info("Farm", "Training", `River Fish Number: ${fishnumber}`);
            try {
                if (fishnumber === "1") {
                    riveranswer = "normie fish";
                } else if (fishnumber === "2") {
                    riveranswer = "golden fish";
                } else if (fishnumber === "3") {
                    riveranswer = "EPIC fish";
                }
                let rivertrainingbutton = message.components[0].components.find(
                    (button) => button.label.toLowerCase() === `${riveranswer}`
                );
                if (rivertrainingbutton) {
                    await message.clickButton(rivertrainingbutton.customId);
                    logger.info(
                        "Farm",
                        "Training",
                        `River training completed with clicking button`
                    );
                } else {
                    logger.warn("Farm", "Training", `River Button Not Found`);
                }
            } catch (error) {
                await message.channel.send({
                    content: fishnumber,
                });
                logger.info(
                    "Farm",
                    "Training",
                    `River training completed with writing`
                );
            }

            client.global.paused = false;
        }

        //*Training Casino
        if (
            msgcontent.includes("is training in the... casino?") &&
            client.config.commands.experience.training
        ) {
            client.global.paused = true;
            let casinoanswer;

            const itemRegex = /is this a \*\*(.+?)\*\* \?/;
            const emojiRegex1 = /<:\w+:\d+>/;
            const emojiRegex2 = /:\w+:/;

            const itemMatch = msgcontent.match(itemRegex);
            const emojiMatch1 = msgcontent.match(emojiRegex1);
            const emojiMatch2 = msgcontent.match(emojiRegex2);

            if (itemMatch && (emojiMatch1 || emojiMatch2)) {
                const item = itemMatch[1];
                const emoji = emojiMatch1 ? emojiMatch1[0] : emojiMatch2[0];

                if (
                    (item === "four leaf clover" &&
                        emoji === ":four_leaf_clover:") ||
                    (item === "diamond" && emoji === ":gem:") ||
                    (item === "gold" && emoji === ":gold:") ||
                    (item === "gift" && emoji === ":gift:") ||
                    (item === "coin" &&
                        emoji === "<:coin:541384484201693185>") ||
                    (item === "dice" && emoji === ":game_die:")
                ) {
                    casinoanswer = "yes";
                } else {
                    casinoanswer = "no";
                }
            }

            logger.info("Farm", "Training", `Casino Answer: ${casinoanswer}`);
            try {
                let casinotrainingbutton =
                    message.components[0].components.find(
                        (button) =>
                            button.label.toLowerCase() === `${casinoanswer}`
                    );
                if (casinotrainingbutton) {
                    await message.clickButton(casinotrainingbutton.customId);
                    logger.info(
                        "Farm",
                        "Training",
                        `Casino training completed with clicking button`
                    );
                } else {
                    logger.warn("Farm", "Training", `Casino Button Not Found`);
                }
            } catch (error) {
                await message.channel.send({ content: casinoanswer });
                logger.info(
                    "Farm",
                    "Training",
                    `Casino training completed with writing`
                );
            }
            client.global.paused = false;
        }
        //*Training Forest
        if (
            msgcontent.includes("is training in the forest!") &&
            client.config.commands.experience.training
        ) {
            let forestcount;
            let foresttrainingbutton;
            const emojiRegex = /how many\s([^ ]+)\sdo you see\?/;
            const emojiMatch = msgcontent.match(emojiRegex);

            if (emojiMatch) {
                const emoji = emojiMatch[1].trim();

                const emojiCount = (
                    msgcontent.match(new RegExp(emoji, "g")) || []
                ).length;

                forestcount = emojiCount - 1;
            }
            foresttrainingbutton = message.components[0].components.find(
                (button) => button.label.toLowerCase() === `${forestcount}`
            );
            try {
                await message.clickButton(foresttrainingbutton.customId);
            } catch (error) {
                foresttrainingbutton = message.components[1].components.find(
                    (button) => button.label.toLowerCase() === `${forestcount}`
                );
                await message.clickButton(foresttrainingbutton.customId);
            }
            logger.info(
                "Farm",
                "Training",
                `Clicked ${forestcount} Forest Button`
            );
        }
        //*Training The Field
        if (
            msgcontent.includes("is training in the field!") &&
            client.config.commands.experience.training
        ) {
            let fieldanswer;
            let fieldtrainingbutton;
            const itemRegex = /what's the \*\*(.+?)\*\* letter of/;
            const emojiRegex = /<:(\w+):/;

            const itemMatch = msgcontent.match(itemRegex);
            const emojiMatch = msgcontent.match(emojiRegex);

            if (itemMatch && emojiMatch) {
                const item = itemMatch[1];
                let itemint;
                const emojiName = emojiMatch[1];

                switch (item) {
                    case "first":
                        itemint = 1;
                        break;
                    case "second":
                        itemint = 2;
                        break;
                    case "third":
                        itemint = 3;
                        break;
                    case "fourth":
                        itemint = 4;
                        break;
                    case "fifth":
                        itemint = 5;
                        break;
                    case "sixth":
                        itemint = 6;
                        break;
                    default:
                        break;
                }
                const letterIndex = parseInt(itemint) - 1;
                fieldanswer = emojiName[letterIndex];
            }
            let newfieldanswer;

            switch (fieldanswer) {
                case "a":
                    newfieldanswer = "training_a";
                    break;
                case "b":
                    newfieldanswer = "training_b";
                    break;
                case "e":
                    newfieldanswer = "training_e";
                    break;
                case "l":
                    newfieldanswer = "training_l";
                    break;
                case "n":
                    newfieldanswer = "training_n";
                    break;
                case "p":
                    newfieldanswer = "training_p";
                    break;
                default:
                    break;
            }

            fieldtrainingbutton = message.components[0].components.find(
                (button) =>
                    button.customId.toLowerCase() === `${newfieldanswer}`
            );

            try {
                await message.clickButton(fieldtrainingbutton.customId);
            } catch (error) {
                fieldtrainingbutton = message.components[1].components.find(
                    (button) =>
                        button.customId.toLowerCase() === `${newfieldanswer}`
                );
                await message.clickButton(fieldtrainingbutton.customId);
            }
            logger.info(
                "Farm",
                "Training",
                `Clicked ${fieldanswer} Field Button`
            );
        }
    }

    if (
        !message.content &&
        !message.interaction &&
        message.embeds &&
        message.embeds[0].type
    ) {
        if (client.config.settings.event.autojoin) {
            if (message.embeds[0].fields[0].name) {
                let event = message.embeds[0].fields[0].name;
                if (
                    event.toLowerCase().includes("an epic tree has just grown")
                ) {
                    await message.clickButton();
                    client.global.totalevent = client.global.totalevent + 1;
                    logger.info("Event", "Epic Tree", "Joined");
                }
                if (
                    event
                        .toLowerCase()
                        .includes("a megalodon has spawned in the river")
                ) {
                    await message.clickButton();
                    client.global.totalevent = client.global.totalevent + 1;
                    logger.info("Event", "Megalodon", "Joined");
                }
                if (event.toLowerCase().includes("it's raining coins")) {
                    await message.clickButton();
                    client.global.totalevent = client.global.totalevent + 1;
                    logger.info("Event", "Raining Coin", "Joined");
                }
                if (event.toLowerCase().includes("god accidentally dropped")) {
                    await message.clickButton();
                    client.global.totalevent = client.global.totalevent + 1;
                    logger.info("Event", "GOD Coin", "Joined");
                }
            }
        }
        if (client.config.settings.event.autospecialtrade) {
            if (message.embeds[0].fields[0].name) {
                let specialtrade = message.embeds[0].fields[0].name;
                if (
                    specialtrade
                        .toLowerCase()
                        .includes("i have a special trade today!")
                ) {
                    await message.clickButton();
                    client.global.totalspecialtrade =
                        client.global.totalspecialtrade + 1;
                    logger.info("Event", "Special Trade", "Accepted");
                }
            }
        }

        if (client.config.settings.event.autoarena) {
            if (message.embeds[0].fields[0].name) {
                let arena = message.embeds[0].fields[0].name;
                if (arena.toLowerCase().includes("to join the arena!")) {
                    await message.clickButton();
                    client.global.totalarena = client.global.totalarena + 1;
                    logger.info("Event", "Arena", "Accepted");
                }
            }
        }
    }

    /* if (
        !message.content &&
        !message.embeds &&
        message.interaction &&
        message.interaction[0].type
    ) {
        return;
    }*/

    /**
     * CMD
     */
    let PREFIX = client.config.prefix;

    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const prefixRegex = new RegExp(
        `^(<@!?${client.user.id}>|${escapeRegex(PREFIX)})\\s*`
    );
    if (!prefixRegex.test(message.content)) return;
    const [matchedPrefix] = message.content.match(prefixRegex);
    const args = message.content
        .slice(matchedPrefix.length)
        .trim()
        .split(/ +/g);
    const command = args.shift().toLowerCase();

    const cmd =
        client.commands.get(command) ||
        client.commands.get(client.aliases.get(command));

    if (cmd) {
        if (message.author.id !== client.config.userid) return;
        cmd.run(client, message, args);
    }
};
