const { WebhookClient } = require('discord.js-selfbot-v13');
const { logger } = require('./logger');

class InfoChecker {
    constructor(client) {
        this.client = client;
        this.lastProfileCheck = 0;
        this.lastInventoryCheck = 0;
        this.initialInventoryData = null;
        this.lastInventoryData = null;
        this.setupWebhooks();
        
        // Start periodic checks if webhooks are configured
        this.startPeriodicChecks();

        // Subscribe to initial inventory check event
        this.client.on('initialInventoryCheck', (data) => {
            if (!this.initialInventoryData) {
                this.initialInventoryData = this.parseInventoryData(data);
                this.lastInventoryData = this.initialInventoryData;
                logger.info('InfoChecker', 'Setup', 'Initial inventory data stored');
            }
        });
    }

    setupWebhooks() {
        try {
            const profileUrl = this.client.config.settings.webhooks.profile.url;
            const inventoryUrl = this.client.config.settings.webhooks.inventory.url;

            if (profileUrl) {
                this.profileWebhook = new WebhookClient({ url: profileUrl });
                logger.info('InfoChecker', 'Setup', 'Profile webhook initialized');
            }

            if (inventoryUrl) {
                this.inventoryWebhook = new WebhookClient({ url: inventoryUrl });
                logger.info('InfoChecker', 'Setup', 'Inventory webhook initialized');
            }
        } catch (error) {
            logger.error('InfoChecker', 'Setup', `Error setting up webhooks: ${error}`);
        }
    }

    startPeriodicChecks() {
        // Only start if at least one webhook is configured
        if (this.profileWebhook || this.inventoryWebhook) {
            // Check profile based on configured interval
            if (this.profileWebhook) {
                const profileInterval = this.client.config.settings.webhooks.profile.checkInterval;
                logger.info('InfoChecker', 'Setup', `Profile check interval: ${profileInterval}ms`);
                
                setInterval(() => {
                    const channel = this.client.channels.cache.get(this.client.config.channelid);
                    if (channel && !this.client.global.captchadetected) {
                        this.checkProfile(channel);
                    }
                }, profileInterval);
            }

            // Check inventory based on configured interval
            if (this.inventoryWebhook) {
                const inventoryInterval = this.client.config.settings.webhooks.inventory.checkInterval;
                logger.info('InfoChecker', 'Setup', `Inventory check interval: ${inventoryInterval}ms`);
                
                setInterval(() => {
                    const channel = this.client.channels.cache.get(this.client.config.channelid);
                    if (channel && !this.client.global.captchadetected) {
                        this.checkInventory(channel);
                    }
                }, inventoryInterval);
            }

            logger.info('InfoChecker', 'Periodic', 'Started periodic info checks with configured intervals');
        }
    }

    async checkProfile(channel) {
        if (!this.profileWebhook) {
            return;
        }

        try {
            // Send rpg profile command
            await channel.send('rpg profile');
            logger.info('InfoChecker', 'Profile', 'Sent profile check command');

            // Wait for response
            const response = await this.waitForEpicRPGResponse(channel);
            if (!response || !response.embeds.length) {
                logger.warn('InfoChecker', 'Profile', 'No profile response received');
                return;
            }

            // Send to webhook
            const embed = response.embeds[0];
            await this.profileWebhook.send({
                username: 'Epic RPG Info Checker',
                avatarURL: this.client.user.displayAvatarURL(),
                embeds: [embed],
                content: `Profile Check - <t:${Math.floor(Date.now() / 1000)}:R>`
            });

            this.lastProfileCheck = Date.now();
            logger.info('InfoChecker', 'Profile', 'Profile info sent to webhook');

        } catch (error) {
            logger.error('InfoChecker', 'Profile', `Error checking profile: ${error}`);
        }
    }

    async checkInventory(channel) {
        if (!this.inventoryWebhook) {
            return;
        }

        try {
            // Send rpg inventory command
            await channel.send('rpg inventory');
            logger.info('InfoChecker', 'Inventory', 'Sent inventory check command');

            // Wait for response
            const response = await this.waitForEpicRPGResponse(channel);
            if (!response || !response.embeds.length) {
                logger.warn('InfoChecker', 'Inventory', 'No inventory response received');
                return;
            }

            const embed = response.embeds[0];
            
            // Kiểm tra embed.fields tồn tại
            if (!embed.fields || !Array.isArray(embed.fields)) {
                logger.warn('InfoChecker', 'Inventory', 'No fields found in inventory embed');
                return;
            }
            
            const currentData = this.parseInventoryData(embed);

            // Compare with initial inventory data if available
            if (this.initialInventoryData) {
                for (const field of embed.fields) {
                    if (!field || !field.name || !field.value) continue;
                    const newValue = this.compareAndUpdateField(
                        field.value,
                        this.initialInventoryData[field.name],
                        currentData[field.name]
                    );
                    field.value = newValue;
                }
            }

            // Send to webhook
            await this.inventoryWebhook.send({
                username: 'Epic RPG Info Checker',
                avatarURL: this.client.user.displayAvatarURL(),
                embeds: [embed],
                content: this.lastInventoryCheck === 0 
                    ? `Initial Inventory Check - <t:${Math.floor(Date.now() / 1000)}:R>`
                    : `Inventory Check - <t:${Math.floor(Date.now() / 1000)}:R>`
            });

            // Update last inventory data
            this.lastInventoryData = currentData;
            this.lastInventoryCheck = Date.now();
            logger.info('InfoChecker', 'Inventory', 'Inventory info sent to webhook');

        } catch (error) {
            logger.error('InfoChecker', 'Inventory', `Error checking inventory: ${error}`);
        }
    }

    parseInventoryData(embed) {
        const data = {};
        // Kiểm tra embed.fields tồn tại trước khi truy cập
        if (!embed.fields || !Array.isArray(embed.fields)) {
            logger.warn('InfoChecker', 'Parse', 'No fields found in embed');
            return data;
        }
        
        for (const field of embed.fields) {
            if (!field || !field.name || !field.value) continue;
            
            data[field.name] = {};
            const lines = field.value.split('\n');
            for (const line of lines) {
                // Match both item name and count, preserving formatting
                const match = line.match(/(\*\*[^*]+\*\*): (\d+)/);
                if (match) {
                    const [, formattedName, count] = match;
                    const itemName = formattedName.replace(/\*\*/g, '').trim();
                    data[field.name][itemName] = parseInt(count);
                }
            }
        }
        return data;
    }

    compareAndUpdateField(fieldValue, initialData, currentData) {
        if (!initialData || !currentData || !fieldValue) return fieldValue;

        const lines = fieldValue.split('\n');
        const updatedLines = lines.map(line => {
            // Match both item name and count, preserving formatting
            const match = line.match(/(\*\*[^*]+\*\*): (\d+)/);
            if (match) {
                const [, formattedName, count] = match;
                const itemName = formattedName.replace(/\*\*/g, '').trim();
                const initialCount = initialData[itemName] || 0;
                const currentCount = parseInt(count);
                
                // Calculate total change from initial value
                const totalChange = currentCount - initialCount;
                if (totalChange !== 0) {
                    const changeText = totalChange > 0 ? `+${totalChange}` : totalChange;
                    return `${formattedName}: ${count} (${changeText} total)`;
                }
            }
            return line;
        });

        return updatedLines.join('\n');
    }

    async waitForEpicRPGResponse(channel) {
        return new Promise((resolve) => {
            const collector = channel.createMessageCollector({
                filter: m => m.author.id === '555955826880413696' && m.embeds.length > 0,
                max: 1,
                time: 10000
            });

            collector.on('collect', (message) => {
                resolve(message);
            });

            collector.on('end', (collected) => {
                if (collected.size === 0) {
                    resolve(null);
                }
            });
        });
    }

    /**
     * Khởi tạo InfoChecker
     */
    init() {
        logger.info('InfoChecker', 'Init', 'Info checker initialized');
    }

    /**
     * Dọn dẹp khi bot dừng
     */
    cleanup() {
        logger.info('InfoChecker', 'Cleanup', 'Info checker cleaned up');
    }
}

module.exports = InfoChecker; 