const { logger } = require('./logger');

class HuntManager {
    constructor(client) {
        this.client = client;
    }
    init() {
        logger.info('HuntManager', 'Init', 'Hunt manager initialized');
    }
    async startHunt(channel) {
        logger.info('HuntManager', 'Start', 'Starting hunt');
        await this.hunt(channel);
    }
    async hunt(channel) {
        logger.info('HuntManager', 'Hunt', 'Sending hunt command');
        await channel.send('rpg hunt');
    }
    reset() {
        logger.info('HuntManager', 'Reset', 'Reset hunt manager');
    }
    cleanup() {
        logger.info('HuntManager', 'Cleanup', 'Cleanup hunt manager');
    }
}

module.exports = HuntManager; 