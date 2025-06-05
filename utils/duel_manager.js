const { logger } = require('./logger');

class DuelManager {
    constructor(client) {
        this.client = client;
        this.isDueling = false;
        this.lastDuelTime = 0;
        this.DUEL_COOLDOWN = 7200000; // 2 giờ cooldown
        this.pendingDuel = null;
        this.waitingForChoice = false;
        this.hasRetried = false; // Chỉ thử lại 1 lần
        this.RETRY_DELAY = 30000; // 30 giây delay
    }

    isOnCooldown() {
        const timeSinceLastDuel = Date.now() - this.lastDuelTime;
        const isOnCd = timeSinceLastDuel < this.DUEL_COOLDOWN;
        
        if (isOnCd) {
            const remainingTime = Math.ceil((this.DUEL_COOLDOWN - timeSinceLastDuel) / 1000 / 60);
            logger.info('DuelManager', 'Cooldown', `Still on cooldown. ${remainingTime} minutes remaining`);
        }
        
        return isOnCd;
    }

    pauseAllActivities() {
        if (!this.client.global.paused) {
            this.client.global.paused = true;
            logger.info('DuelManager', 'Pause', 'All activities paused for duel');
        }
    }

    resumeAllActivities() {
        if (this.client.global.paused) {
            this.client.global.paused = false;
            logger.info('DuelManager', 'Resume', 'Activities resumed');
            
            // Reset duel states
            this.isDueling = false;
            this.pendingDuel = null;
            this.waitingForChoice = false;
        }
    }

    async makeRandomChoice(channel) {
        try {
            // Chờ một chút trước khi chọn để tránh spam
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Chọn ngẫu nhiên A, B hoặc C
            const choices = ['A', 'B', 'C'];
            const choice = choices[Math.floor(Math.random() * choices.length)];
            
            await channel.send(choice);
            logger.info('DuelManager', 'Choice', `Selected option ${choice}`);
            
            this.waitingForChoice = false;
        } catch (error) {
            logger.error('DuelManager', 'Choice', `Error making choice: ${error}`);
            // Nếu lỗi khi chọn, thử lại sau 2s
            setTimeout(() => this.makeRandomChoice(channel), 2000);
        }
    }

    async handleDuelRequest(message) {
        // Ignore if dueling is disabled
        if (!this.client.config.settings.duel.enabled) return;

        // Check if message and author exist
        if (!message || !message.author) {
            logger.warn('DuelManager', 'Request', 'Invalid message or missing author');
            return;
        }

        // Check if it's a duel request for our bot
        if (message.content.toLowerCase().includes('rpg duel') && 
            message.mentions.users.has(this.client.user.id)) {
            
            // Only accept duels from target user
            if (message.author.id !== this.client.config.settings.duel.target_user_id) {
                logger.info('DuelManager', 'Request', `Ignored duel request from non-target user: ${message.author.tag}`);
                return;
            }

            if (this.isDueling) {
                logger.info('DuelManager', 'Request', 'Cannot accept duel - Already in a duel');
                return;
            }

            if (this.isOnCooldown()) {
                logger.info('DuelManager', 'Request', 'Cannot accept duel - Still on cooldown');
                return;
            }

            if (this.client.config.settings.duel.auto_accept) {
                try {
                    // Pause other activities before accepting
                    this.pauseAllActivities();
                    
                    // Wait a bit before accepting to avoid spam detection
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    await message.channel.send('rpg accept');
                    logger.info('DuelManager', 'Accept', 'Accepted duel request');
                    this.isDueling = true;
                } catch (error) {
                    logger.error('DuelManager', 'Accept', `Error accepting duel: ${error}`);
                    this.resumeAllActivities();
                }
            }
        }
    }

    async sendCaptchaWebhook(message) {
        try {
            const webhookUrl = this.client.config.settings.webhooks.captcha.url;
            if (!webhookUrl) {
                logger.warn('DuelManager', 'Webhook', 'No captcha webhook URL configured');
                return;
            }

            const { WebhookClient } = require('discord.js');
            const webhook = new WebhookClient({ url: webhookUrl });

            await webhook.send({
                username: 'Epic RPG Bot Alert',
                embeds: [{
                    title: '⚠️ Duel System Alert',
                    description: 'Duel system encountered repeated failures',
                    fields: [
                        {
                            name: 'Status',
                            value: 'Duel requests failed twice. System will pause for 2 hours.',
                            inline: false
                        },
                        {
                            name: 'Last Error',
                            value: message || 'Unknown error',
                            inline: false
                        },
                        {
                            name: 'Next Attempt',
                            value: `<t:${Math.floor((Date.now() + this.DUEL_COOLDOWN) / 1000)}:R>`,
                            inline: false
                        }
                    ],
                    color: 0xFF0000,
                    timestamp: new Date()
                }]
            });
            logger.info('DuelManager', 'Webhook', 'Sent alert to captcha webhook');
        } catch (error) {
            logger.error('DuelManager', 'Webhook', `Failed to send webhook: ${error}`);
        }
    }

    async handleDuelMessages(message) {
        // Check if message and author exist
        if (!message || !message.author) {
            logger.warn('DuelManager', 'Messages', 'Invalid message or missing author');
            return;
        }

        // Kiểm tra tin nhắn từ Epic RPG bot
        if (message.author.id !== '555955826880413696') return; // Epic RPG bot ID

        // Chỉ kiểm tra tin nhắn khi đang trong quá trình duel
        if (!this.isDueling && !this.pendingDuel) return;

        // Log nội dung tin nhắn để debug
        if (message.content) {
            logger.info('DuelManager', 'Message', `Content: ${message.content}`);
        }
        if (message.embeds && message.embeds.length > 0 && message.embeds[0].description) {
            logger.info('DuelManager', 'Message', `Embed: ${message.embeds[0].description}`);
        }

        // Kiểm tra tin nhắn gửi duel request
        if ((message.content && message.content.toLowerCase().includes('sent a duel request')) ||
            (message.embeds.length > 0 && message.embeds[0].description && 
             message.embeds[0].description.toLowerCase().includes('sent a duel request'))) {
            this.isDueling = true;
            logger.info('DuelManager', 'Request', 'Duel request sent, waiting for acceptance');
            return;
        }

        // Kiểm tra tin nhắn chấp nhận duel và chọn vũ khí
        if ((message.content && message.content.toLowerCase().includes('choose the weapon that better fits with you')) ||
            (message.embeds.length > 0 && message.embeds[0].description && 
             message.embeds[0].description.toLowerCase().includes('choose the weapon that better fits with you'))) {
            this.waitingForChoice = true;
            logger.info('DuelManager', 'Choice', 'Duel accepted, choosing weapon...');
            await this.makeRandomChoice(message.channel);
            return;
        }

        // Kiểm tra tin nhắn yêu cầu lựa chọn khác
        if (this.isDueling && !this.waitingForChoice) {
            if ((message.content && 
                (message.content.toLowerCase().includes("choose your move") || 
                 message.content.toLowerCase().includes("choose an action"))) ||
                (message.embeds.length > 0 && message.embeds[0].description &&
                (message.embeds[0].description.includes("choose your move") || 
                 message.embeds[0].description.includes("choose an action")))) {
                this.waitingForChoice = true;
                await this.makeRandomChoice(message.channel);
                return;
            }
        }

        // Kiểm tra kết thúc duel
        if ((message.content && 
            (message.content.toLowerCase().includes('won the duel') || 
             message.content.toLowerCase().includes('fled from the duel'))) ||
            (message.embeds.length > 0 && message.embeds[0].description &&
            (message.embeds[0].description.includes('won the duel') || 
             message.embeds[0].description.includes('fled from the duel')))) {
            
            this.lastDuelTime = Date.now();
            logger.info('DuelManager', 'End', `Duel ended, next duel available in ${this.DUEL_COOLDOWN/1000/60} minutes`);
            setTimeout(() => this.resumeAllActivities(), 3000);
            return;
        }

        // Kiểm tra timeout/hủy duel
        if (message.content && 
           (message.content.toLowerCase().includes('duel request timed out') ||
            message.content.toLowerCase().includes('duel request cancelled'))) {
            
            if (!this.hasRetried) {
                // Lần đầu thất bại - thử lại sau 30 giây
                this.hasRetried = true;
                logger.info('DuelManager', 'Cancel', 'Duel request failed. Will retry once in 30s');
                this.resumeAllActivities();
                
                setTimeout(() => {
                    if (!this.isOnCooldown()) {
                        const channel = this.client.channels.cache.get(this.client.config.channelid);
                        if (channel) {
                            this.checkAndSendDuel(channel);
                        }
                    }
                }, this.RETRY_DELAY);
            } else {
                // Lần thử lại cũng thất bại
                logger.info('DuelManager', 'Cancel', 'Retry also failed. Setting 2h cooldown and notifying webhook');
                this.lastDuelTime = Date.now(); // Đặt cooldown 2h
                this.hasRetried = false; // Reset retry flag
                this.resumeAllActivities();
                
                // Gửi thông báo đến webhook
                await this.sendCaptchaWebhook('Duel requests failed twice in succession');
            }
        }
    }

    async checkAndSendDuel(channel) {
        // Don't send if dueling is disabled or we're already in a duel
        if (!this.client.config.settings.duel.enabled || 
            !this.client.config.settings.duel.auto_send ||
            this.isDueling ||
            this.pendingDuel ||
            this.client.global.captchadetected) return;

        // Check cooldown
        if (this.isOnCooldown()) {
            return;
        }

        try {
            const targetId = this.client.config.settings.duel.target_user_id;
            if (!targetId) {
                logger.warn('DuelManager', 'Send', 'No target user ID configured');
                return;
            }

            // Pause other activities before sending duel
            this.pauseAllActivities();

            // Wait a bit before sending duel request
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Send duel request
            await channel.send(`rpg duel <@${targetId}>`);
            this.pendingDuel = {
                targetId: targetId,
                timestamp: Date.now()
            };
            logger.info('DuelManager', 'Send', 'Sent duel request, waiting for acceptance');

            // Set timeout to clear pending duel if not accepted
            setTimeout(() => {
                if (this.pendingDuel) {
                    const elapsed = Date.now() - this.pendingDuel.timestamp;
                    if (elapsed >= 30000) { // 30 seconds timeout
                        this.pendingDuel = null;
                        this.resumeAllActivities();
                        logger.info('DuelManager', 'Timeout', 'Duel request expired. Will retry after checking cooldown.');
                        
                        // Check cooldown and retry after 30 seconds
                        setTimeout(() => {
                            if (!this.isOnCooldown()) {
                                this.checkAndSendDuel(channel);
                            }
                        }, 30000);
                    }
                }
            }, 30000);

        } catch (error) {
            logger.error('DuelManager', 'Send', `Error sending duel request: ${error}`);
            this.pendingDuel = null;
            this.resumeAllActivities();
            
            // Check cooldown and retry after 30 seconds
            setTimeout(() => {
                if (!this.isOnCooldown()) {
                    this.checkAndSendDuel(channel);
                }
            }, 30000);
        }
    }

    // Reset all states
    reset() {
        this.isDueling = false;
        this.pendingDuel = null;
        this.waitingForChoice = false;
        this.hasRetried = false; // Reset retry flag
        this.resumeAllActivities();
        logger.info('DuelManager', 'Reset', 'All duel states reset');
    }
}

module.exports = DuelManager; 