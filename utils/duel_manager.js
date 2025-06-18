const { logger } = require('./logger');

class DuelManager {
    constructor(client) {
        this.client = client;
        this.isDueling = false;
        this.lastDuelTime = 0;
        this.DUEL_COOLDOWN = 7200000; // 2 giờ cooldown
        this.waitingForChoice = false;
        this.duelCooldown = 0; // Cooldown từ EpicRPG response
        this.duelStartTime = 0; // Thời gian bắt đầu duel
        this.duelTimeout = null; // Timeout để hủy duel
        this.DUEL_TIMEOUT = 60000; // 1 phút timeout
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

    /**
     * Xử lý tin nhắn duel request (người nhận)
     */
    async handleDuelRequest(message) {
        // Ignore if dueling is disabled
        if (!this.client.config.settings.duel.enabled) return;

        // Check if message and author exist
        if (!message || !message.author) {
            logger.warn('DuelManager', 'Request', 'Invalid message or missing author');
            return;
        }

        // Kiểm tra tin nhắn "Will you accept" (người nhận duel)
        if (message.content.toLowerCase().includes('will you accept') && 
            message.mentions.users.has(this.client.user.id)) {
            
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
                    
                    await message.channel.send('yes');
                    this.isDueling = true;
                    this.duelStartTime = Date.now();
                    this.duelTimeout = setTimeout(() => this.handleDuelTimeout(), this.DUEL_TIMEOUT);
                    logger.info('DuelManager', 'Accept', 'Accepted duel request');
                } catch (error) {
                    logger.error('DuelManager', 'Accept', `Error accepting duel: ${error}`);
                    this.resumeAllActivities();
                }
            }
        }
    }

    /**
     * Xử lý tất cả tin nhắn liên quan đến duel
     */
    async handleDuelMessages(message) {
        // Check if message and author exist
        if (!message || !message.author) {
            logger.warn('DuelManager', 'Messages', 'Invalid message or missing author');
            return;
        }

        // Kiểm tra tin nhắn từ Epic RPG bot
        if (message.author.id !== '555955826880413696') return; // Epic RPG bot ID

        // Chỉ kiểm tra tin nhắn khi đang trong quá trình duel
        if (!this.isDueling) return;

        const content = message.content.toLowerCase();
        const embedDescription = message.embeds?.[0]?.description?.toLowerCase() || '';
        const fullText = content + ' ' + embedDescription;

        // Log nội dung tin nhắn để debug
        logger.info('DuelManager', 'Message', `Content: ${content}`);

        // Kiểm tra tin nhắn chọn vũ khí - cải thiện pattern matching
        if (fullText.includes('choose the weapon') || 
            fullText.includes('select your weapon') ||
            fullText.includes('pick your weapon') ||
            fullText.includes('weapon choice') ||
            fullText.includes('choose weapon')) {
            this.waitingForChoice = true;
            logger.info('DuelManager', 'Choice', 'Weapon choice required, making random choice...');
            await this.makeRandomChoice(message.channel);
            return;
        }

        // Kiểm tra tin nhắn yêu cầu lựa chọn khác
        if (this.isDueling && !this.waitingForChoice) {
            if (fullText.includes("choose your move") || 
                fullText.includes("choose an action") ||
                fullText.includes("select your move") ||
                fullText.includes("pick your move") ||
                fullText.includes("make your choice")) {
                this.waitingForChoice = true;
                await this.makeRandomChoice(message.channel);
                return;
            }
        }

        // Kiểm tra kết thúc duel - tìm từ "won"
        if (fullText.includes('won')) {
            this.lastDuelTime = Date.now();
            this.duelCooldown = 0; // Reset EpicRPG cooldown
            this.isDueling = false;
            this.waitingForChoice = false;
            if (this.duelTimeout) {
                clearTimeout(this.duelTimeout);
                this.duelTimeout = null;
            }
            logger.info('DuelManager', 'End', `Duel won, next duel available in ${this.DUEL_COOLDOWN/1000/60} minutes`);
            setTimeout(() => this.resumeAllActivities(), 3000);
            return;
        }

        // Kiểm tra thất bại duel
        if (fullText.includes('lost') || fullText.includes('fled')) {
            this.lastDuelTime = Date.now();
            this.duelCooldown = 0; // Reset EpicRPG cooldown
            this.isDueling = false;
            this.waitingForChoice = false;
            if (this.duelTimeout) {
                clearTimeout(this.duelTimeout);
                this.duelTimeout = null;
            }
            logger.info('DuelManager', 'End', `Duel lost/fled, next duel available in ${this.DUEL_COOLDOWN/1000/60} minutes`);
            setTimeout(() => this.resumeAllActivities(), 3000);
            return;
        }

        // Kiểm tra cooldown từ EpicRPG response
        if (fullText.includes('cooldown')) {
            const cooldownTime = this.extractCooldownTime(fullText);
            if (cooldownTime) {
                this.duelCooldown = cooldownTime;
                logger.info('DuelManager', 'Cooldown', `Duel cooldown from EpicRPG: ${cooldownTime/1000}s`);
            }
        }
    }

    /**
     * Trích xuất thời gian cooldown từ tin nhắn
     */
    extractCooldownTime(text) {
        // Các pattern phổ biến cho cooldown
        const patterns = [
            /(\d+)\s*minutes?/i,
            /(\d+)\s*hours?/i,
            /(\d+)\s*seconds?/i,
            /(\d+)\s*days?/i,
            /(\d+)\s*m/i,
            /(\d+)\s*h/i,
            /(\d+)\s*s/i,
            /(\d+)\s*d/i
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                const value = parseInt(match[1]);
                const unit = match[0].toLowerCase();
                
                if (unit.includes('day') || unit.includes('d')) return value * 24 * 60 * 60 * 1000;
                if (unit.includes('hour') || unit.includes('h')) return value * 60 * 60 * 1000;
                if (unit.includes('minute') || unit.includes('m')) return value * 60 * 1000;
                if (unit.includes('second') || unit.includes('s')) return value * 1000;
            }
        }

        return null;
    }

    /**
     * Gửi duel request (người gửi)
     */
    async sendDuelRequest(channel) {
        // Don't send if dueling is disabled or we're already in a duel
        if (!this.client.config.settings.duel.enabled || 
            !this.client.config.settings.duel.auto_send ||
            this.isDueling ||
            this.client.global.captchadetected) return;

        // Check cooldown
        if (this.isOnCooldown()) {
            return;
        }

        // Check EpicRPG cooldown if available
        if (this.duelCooldown > 0) {
            const remainingTime = Math.ceil(this.duelCooldown / 1000 / 60);
            logger.info('DuelManager', 'Send', `EpicRPG cooldown active. ${remainingTime} minutes remaining`);
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
            this.isDueling = true;
            this.duelStartTime = Date.now();
            this.duelTimeout = setTimeout(() => this.handleDuelTimeout(), this.DUEL_TIMEOUT);
            logger.info('DuelManager', 'Send', 'Sent duel request, waiting for weapon choice');

        } catch (error) {
            logger.error('DuelManager', 'Send', `Error sending duel request: ${error}`);
            this.resumeAllActivities();
        }
    }

    // Reset all states
    reset() {
        this.isDueling = false;
        this.waitingForChoice = false;
        this.duelCooldown = 0;
        this.duelStartTime = 0;
        if (this.duelTimeout) {
            clearTimeout(this.duelTimeout);
            this.duelTimeout = null;
        }
        this.resumeAllActivities();
        logger.info('DuelManager', 'Reset', 'All duel states reset');
    }

    /**
     * Khởi tạo DuelManager
     */
    init() {
        if (!this.client.config.settings.duel.enabled) {
            logger.info('DuelManager', 'Init', 'Duel system is disabled');
            return;
        }

        // Interval để tự động reset EpicRPG cooldown
        setInterval(() => {
            if (this.duelCooldown > 0) {
                this.duelCooldown -= 1000; // Giảm 1 giây mỗi lần
                if (this.duelCooldown <= 0) {
                    this.duelCooldown = 0;
                    logger.info('DuelManager', 'Cooldown', 'EpicRPG cooldown expired');
                }
            }
        }, 1000);

        logger.info('DuelManager', 'Init', 'Duel manager initialized');
    }

    /**
     * Dọn dẹp khi bot dừng
     */
    cleanup() {
        if (this.duelTimeout) {
            clearTimeout(this.duelTimeout);
            this.duelTimeout = null;
        }
        this.reset();
        logger.info('DuelManager', 'Cleanup', 'Duel manager cleaned up');
    }

    handleDuelTimeout() {
        if (this.isDueling) {
            this.lastDuelTime = Date.now();
            this.duelCooldown = 0; // Reset EpicRPG cooldown
            this.isDueling = false;
            this.waitingForChoice = false;
            this.duelTimeout = null;
            logger.warn('DuelManager', 'Timeout', 'Duel timed out after 1 minute, resuming activities');
            setTimeout(() => this.resumeAllActivities(), 3000);
        }
    }
}

module.exports = DuelManager; 