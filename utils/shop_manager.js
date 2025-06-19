const { logger } = require("./logger");

class ShopManager {
    constructor(client) {
        this.client = client;
        this.cooldowns = new Map(); // Lưu trữ cooldown của từng item
        this.currentPurchaseItem = null; // Item đang được mua
        this.purchaseTimeout = null; // Timeout cho việc mua
    }

    /**
     * Khởi tạo shop manager
     */
    init() {
        if (!this.client.config.settings.shop.enabled) {
            logger.info("ShopManager", "Init", "Shop auto-buy is disabled");
            return;
        }

        logger.info("ShopManager", "Init", "Shop manager initialized");

        // Thiết lập interval để kiểm tra và mua items định kỳ
        const checkInterval = this.client.config.settings.shop.check_interval || 300000; // 5 phút mặc định
        this.checkInterval = setInterval(async () => {
            if (!this.client.global.paused && !this.client.global.captchadetected) {
                await this.checkAndBuyWhenReady();
            }
        }, checkInterval);

        logger.info("ShopManager", "Init", `Shop check interval set to ${checkInterval/1000}s`);
    }

    /**
     * Mua tất cả items được bật trong config
     */
    async buyAllEnabledItems() {
        if (!this.client.config.settings.shop.enabled) {
            return;
        }

        const channel = this.client.channels.cache.get(this.client.config.channelid);
        if (!channel) {
            logger.error("ShopManager", "Buy", "Channel not found");
            return;
        }

        const shopConfig = this.client.config.settings.shop.items;
        const itemsToBuy = [];

        // Lấy danh sách items cần mua
        for (const [itemName, config] of Object.entries(shopConfig)) {
            if (config.enabled) {
                // Kiểm tra cooldown
                const cooldown = this.cooldowns.get(itemName);
                if (!cooldown || Date.now() >= cooldown) {
                    itemsToBuy.push(itemName);
                } else {
                    const remaining = cooldown - Date.now();
                    logger.info("ShopManager", "Cooldown", `${itemName} still on cooldown: ${this.formatTime(remaining)}`);
                }
            }
        }

        if (itemsToBuy.length === 0) {
            logger.info("ShopManager", "Buy", "No items to buy (all on cooldown or disabled)");
            return;
        }

        logger.info("ShopManager", "Buy", `Attempting to buy: ${itemsToBuy.join(', ')}`);

        // Mua từng item
        for (const itemName of itemsToBuy) {
            await this.buyItem(channel, itemName);
            await this.client.delay(2000); // Delay 2s giữa các lần mua
        }
    }

    /**
     * Kiểm tra và mua items khi lootbox cooldown hết
     */
    async checkAndBuyWhenReady() {
        if (!this.client.config.settings.shop.enabled) {
            return;
        }

        const shopConfig = this.client.config.settings.shop.items;
        const now = Date.now();
        let hasReadyItems = false;

        // Kiểm tra xem có item nào sẵn sàng mua không
        for (const [itemName, config] of Object.entries(shopConfig)) {
            if (config.enabled) {
                const cooldown = this.cooldowns.get(itemName);
                if (!cooldown || now >= cooldown) {
                    hasReadyItems = true;
                    break;
                }
            }
        }

        // Nếu có items sẵn sàng, thực hiện mua
        if (hasReadyItems) {
            logger.info("ShopManager", "Check", "Items ready to buy, starting purchase");
            await this.buyAllEnabledItems();
        }
    }

    /**
     * Gọi từ bên ngoài khi lootbox cooldown hết
     */
    async onLootboxCooldownExpired() {
        logger.info("ShopManager", "Lootbox", "Lootbox cooldown expired, checking for shop purchases");
        await this.checkAndBuyWhenReady();
    }

    /**
     * Mua một item cụ thể
     */
    async buyItem(channel, itemName) {
        try {
            logger.info("ShopManager", "Purchase", `Attempting to buy ${itemName}`);
            
            // Lưu item đang mua
            this.currentPurchaseItem = itemName;
            
            // Gửi lệnh mua
            await channel.send({ content: `rpg buy ${itemName}` });
            
            // Set timeout để reset nếu không có phản hồi
            this.purchaseTimeout = setTimeout(() => {
                this.currentPurchaseItem = null;
                logger.warn("ShopManager", "Purchase", `Timeout waiting for ${itemName} purchase response`);
            }, 10000);

        } catch (error) {
            logger.error("ShopManager", "Purchase", `Error buying ${itemName}: ${error.message}`);
            this.currentPurchaseItem = null;
        }
    }

    /**
     * Xử lý kết quả mua hàng
     */
    async handlePurchaseResult(channel, item, response) {
        // Clear timeout
        if (this.purchaseTimeout) {
            clearTimeout(this.purchaseTimeout);
            this.purchaseTimeout = null;
        }

        const content = response.content.toLowerCase();
        const embedDescription = response.embeds?.[0]?.description?.toLowerCase() || '';

        // Kiểm tra mua thành công
        if (content.includes('successfully bought') || 
            content.includes('you bought') ||
            embedDescription.includes('successfully bought') ||
            embedDescription.includes('you bought')) {
            
            logger.info("ShopManager", "Success", `Successfully bought ${item}`);
            
            // Gửi thông báo đến inventory webhook
            await this.sendInventoryNotification(item);
            
        } else if (content.includes('not enough') || 
                   content.includes('insufficient') ||
                   embedDescription.includes('not enough') ||
                   embedDescription.includes('insufficient')) {
            
            logger.warn("ShopManager", "Purchase", `Not enough money to buy ${item}`);
            
            // Thử lại sau retry_delay * 2 nếu không đủ tiền (có thể kiếm được tiền)
            const retryDelay = (this.client.config.settings.shop.retry_delay || 60000) * 2;
            setTimeout(async () => {
                if (!this.client.global.paused && !this.client.global.captchadetected) {
                    logger.info("ShopManager", "Retry", `Retrying purchase of ${item} after insufficient money`);
                    await this.buyItem(channel, item);
                }
            }, retryDelay);
            
        } else {
            logger.warn("ShopManager", "Purchase", `Unknown response for ${item}: ${content}`);
            
            // Thử lại sau retry_delay nếu gặp lỗi không xác định
            const retryDelay = this.client.config.settings.shop.retry_delay || 60000;
            setTimeout(async () => {
                if (!this.client.global.paused && !this.client.global.captchadetected) {
                    logger.info("ShopManager", "Retry", `Retrying purchase of ${item} after error`);
                    await this.buyItem(channel, item);
                }
            }, retryDelay);
        }

        // Reset current purchase item
        this.currentPurchaseItem = null;
    }

    /**
     * Xử lý tin nhắn từ messageCreate event
     */
    async handleShopResponse(message) {
        const content = message.content.toLowerCase();
        const embedDescription = message.embeds?.[0]?.description?.toLowerCase() || '';

        // Kiểm tra nếu đang trong quá trình mua
        if (!this.currentPurchaseItem) return;

        // Kiểm tra nếu tin nhắn liên quan đến mua hàng
        if (content.includes('bought') || 
            content.includes('not enough') ||
            content.includes('insufficient') ||
            embedDescription.includes('bought') ||
            embedDescription.includes('not enough') ||
            embedDescription.includes('insufficient')) {
            
            // Xử lý kết quả
            await this.handlePurchaseResult(message.channel, this.currentPurchaseItem, message);
        }
    }

    /**
     * Gửi thông báo mua thành công đến inventory webhook
     */
    async sendInventoryNotification(item) {
        try {
            const webhookUrl = this.client.config.settings.webhooks?.inventory?.url;
            if (!webhookUrl) {
                logger.warn("ShopManager", "Notification", "No inventory webhook URL configured");
                return;
            }

            const { WebhookClient } = require('discord.js');
            const webhook = new WebhookClient({ url: webhookUrl });

            await webhook.send({
                username: 'Epic RPG Shop Bot',
                embeds: [{
                    title: '🛒 Shop Purchase Success',
                    description: `Successfully purchased **${item}**`,
                    fields: [
                        {
                            name: 'Item',
                            value: item,
                            inline: true
                        },
                        {
                            name: 'Time',
                            value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
                            inline: true
                        }
                    ],
                    color: 0x00FF00,
                    timestamp: new Date()
                }]
            });

            logger.info("ShopManager", "Notification", `Sent inventory notification for ${item}`);
        } catch (error) {
            logger.error("ShopManager", "Notification", `Failed to send notification: ${error.message}`);
        }
    }

    /**
     * Lấy thông tin cooldown của tất cả items
     */
    getCooldownInfo() {
        const info = {};
        const now = Date.now();
        
        for (const [itemName, cooldownTime] of this.cooldowns.entries()) {
            if (cooldownTime > now) {
                const remaining = cooldownTime - now;
                info[itemName] = {
                    remaining: remaining,
                    remainingText: this.formatTime(remaining)
                };
            }
        }
        
        return info;
    }

    /**
     * Format thời gian thành text dễ đọc
     */
    formatTime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ${hours % 24}h`;
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }

    /**
     * Dọn dẹp khi bot dừng
     */
    cleanup() {
        this.cooldowns.clear();
        
        // Clear timeout nếu có
        if (this.purchaseTimeout) {
            clearTimeout(this.purchaseTimeout);
            this.purchaseTimeout = null;
        }

        // Clear interval nếu có
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        
        this.currentPurchaseItem = null;
        logger.info("ShopManager", "Cleanup", "Shop manager cleaned up");
    }
}

module.exports = ShopManager; 