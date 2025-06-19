const { logger } = require("../../utils/logger");
const CaptchaDetector = require("../../utils/captcha_detection");
const { WebhookClient } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = async (client, message) => {
    if (!client.captchaDetector) {
        client.captchaDetector = new CaptchaDetector();
    }

    /**
     * Client
     */

    if (message.channel.id !== client.config.channelid) return;

    let msgcontent = message.content.toLowerCase();

    // Thêm xử lý cho tin nhắn "2" và "3"
    if (message.author.id === client.config.userid) {
        if (msgcontent === "2") {
            if (!client.global.paused) {
                client.global.paused = true;
                client.rpc("update");
                await message.delete();
                await message.channel.send({ 
                    content: "Bot has been paused! Use '3' to restart bot. 🛑" 
                });
            } else {
                await message.delete();
                await message.channel.send({
                    content: "Bot is already paused! Use '3' to restart bot.",
                });
            }
            return;
        }
        
        if (msgcontent === "3") {
            await message.delete();
            await message.channel.send({ content: "Restarting bot... 🔄" });
            // Thoát với mã 15 để tự động khởi động lại
            process.exit(15);
            return;
        }
    }

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

                    // Thử giải captcha tự động - function không tồn tại nên luôn false
                    const solved = false; // autoSolveCaptcha function không tồn tại
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
                    message: `Bot stopped. Auto-solve failed.\nTotal Captchas: ${client.global.totalcaptcha}`,
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
            
            // Reset captcha detector
            client.captchaDetector.reset();
            
            logger.info("Bot", "Captcha", `Captcha solved! Restarting bot...`);

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
                            description: 'Bot is restarting...',
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
                                    value: 'Manual',
                                    inline: true
                                }
                            ],
                            color: 0x00FF00,
                            timestamp: new Date()
                        }]
                    });

                    // Thoát với mã 15 để tự động khởi động lại
                    process.exit(15);

                } catch (error) {
                    logger.error("Bot", "Webhook", `Failed to send webhook: ${error.message}`);
                    // Vẫn thoát với mã 15 ngay cả khi gửi webhook thất bại
                    process.exit(15);
                }
            } else {
                // Nếu không có webhook, vẫn thoát với mã 15
                process.exit(15);
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
        }
    }
    
    // Xử lý shop response
    if (client.shopManager && client.config.settings.shop.enabled) {
        await client.shopManager.handleShopResponse(message);
    }
}