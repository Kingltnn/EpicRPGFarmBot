const { Client, GatewayIntentBits, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Import các module
const { logger } = require('./utils/logger');

// Import các manager
const HuntManager = require('./utils/hunt_manager');
const CooldownManager = require('./utils/cooldown_manager');
const InventoryManager = require('./utils/inventory_manager');
const EventManager = require('./utils/event_manager');
const ShopManager = require('./utils/shop_manager');
const InfoChecker = require('./utils/info_checker');

// Tạo client Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User]
});

// Load config
const configPath = path.join(__dirname, 'config.json');
if (!fs.existsSync(configPath)) {
    logger.error('Main', 'Config', 'config.json not found');
    process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
client.config = config;

// Global state
client.global = {
    paused: false,
    captchadetected: false,
    dailycd: false,
    weeklycd: false,
    huntcd: false,
    adventurecd: false,
    trainingcd: false,
    workingcd: false,
    petcd: false,
    horsecd: false,
    arena: false,
    dungeon: false,
    miniboss: false,
    horse: false,
    pet: false,
    working: false,
    training: false,
    adventure: false,
    hunt: false,
    daily: false,
    weekly: false
};

// Khởi tạo các manager
client.huntManager = new HuntManager(client);
client.cooldownManager = new CooldownManager(client);
client.inventoryManager = new InventoryManager(client);
client.eventManager = new EventManager(client);
client.shopManager = new ShopManager(client);
client.infoChecker = new InfoChecker(client);

// Event handlers
client.once('ready', () => {
    logger.info('Main', 'Ready', `Logged in as ${client.user.tag}`);
    
    // Khởi tạo các manager
    client.huntManager.init();
    client.cooldownManager.init();
    client.inventoryManager.init();
    client.eventManager.init();
    client.shopManager.init();
    client.infoChecker.init();
    
    // Bắt đầu farming
    startFarming();
});

client.on('messageCreate', async (message) => {
    try {
        // Bỏ qua tin nhắn từ bot
        if (message.author.bot) return;
        
        // Xử lý commands
        if (message.content.startsWith('!')) {
            await handleCommands(message);
            return;
        }
        
        // Xử lý cooldown từ EpicRPG
        await client.cooldownManager.handleCooldownMessage(message);
        
        // Xử lý inventory updates
        await client.inventoryManager.handleInventoryMessage(message);
        
        // Xử lý event messages
        await client.eventManager.handleEventMessage(message);
        
    } catch (error) {
        logger.error('Main', 'Message', `Error handling message: ${error}`);
    }
});

// Command handler
async function handleCommands(message) {
    const command = message.content.toLowerCase();
    
    switch (command) {
        case '!start':
            if (!client.global.paused) {
                logger.info('Main', 'Command', 'Bot is already running');
                return;
            }
            client.global.paused = false;
            logger.info('Main', 'Command', 'Bot started');
            break;
            
        case '!stop':
            if (client.global.paused) {
                logger.info('Main', 'Command', 'Bot is already stopped');
                return;
            }
            client.global.paused = true;
            logger.info('Main', 'Command', 'Bot stopped');
            break;
            
        case '!status':
            const status = client.global.paused ? 'Stopped' : 'Running';
            const captcha = client.global.captchadetected ? 'Detected' : 'None';
            logger.info('Main', 'Status', `Bot: ${status}, Captcha: ${captcha}`);
            break;
            
        case '!reset':
            client.global.paused = false;
            client.global.captchadetected = false;
            client.huntManager.reset();
            client.cooldownManager.reset();
            client.inventoryManager.reset();
            client.eventManager.reset();
            client.shopManager.reset();
            client.infoChecker.reset();
            logger.info('Main', 'Command', 'All systems reset');
            break;
            
        case '!daily':
            const dailyChannel = client.channels.cache.get(client.config.channelid);
            if (dailyChannel) {
                await dailyChannel.send('rpg daily');
                logger.info('Main', 'Command', 'Sent daily command manually');
            }
            break;
            
        case '!weekly':
            const weeklyChannel = client.channels.cache.get(client.config.channelid);
            if (weeklyChannel) {
                await weeklyChannel.send('rpg weekly');
                logger.info('Main', 'Command', 'Sent weekly command manually');
            }
            break;
            
        default:
            logger.info('Main', 'Command', `Unknown command: ${command}`);
    }
}

// Farming function
async function startFarming() {
    const channel = client.channels.cache.get(client.config.channelid);
    if (!channel) {
        logger.error('Main', 'Farming', 'Channel not found');
        return;
    }
    
    logger.info('Main', 'Farming', 'Starting farming process');
    
    // Bắt đầu mua items từ shop
    if (client.config.settings.shop.enabled) {
        await client.shopManager.buyItems(channel);
    }
    
    // Bắt đầu hunt
    await client.huntManager.startHunt(channel);
    
    // Interval cho hunt
    setInterval(async () => {
        if (!client.global.paused && !client.global.captchadetected && !client.global.huntcd) {
            await client.huntManager.hunt(channel);
        }
    }, client.config.settings.hunt.interval);
    
    // Interval cho adventure
    setInterval(async () => {
        if (!client.global.paused && !client.global.captchadetected && !client.global.adventurecd) {
            await channel.send('rpg adventure');
            client.global.adventurecd = true;
            setTimeout(() => { client.global.adventurecd = false; }, 300000); // 5 phút cooldown
        }
    }, 300000);
    
    // Interval cho training
    setInterval(async () => {
        if (!client.global.paused && !client.global.captchadetected && !client.global.trainingcd) {
            await channel.send('rpg training');
            client.global.trainingcd = true;
            setTimeout(() => { client.global.trainingcd = false; }, 300000); // 5 phút cooldown
        }
    }, 300000);
    
    // Interval cho working
    setInterval(async () => {
        if (!client.global.paused && !client.global.captchadetected && !client.global.workingcd) {
            await channel.send('rpg work');
            client.global.workingcd = true;
            setTimeout(() => { client.global.workingcd = false; }, 300000); // 5 phút cooldown
        }
    }, 300000);
    
    // Interval cho pet
    setInterval(async () => {
        if (!client.global.paused && !client.global.captchadetected && !client.global.petcd) {
            await channel.send('rpg pet');
            client.global.petcd = true;
            setTimeout(() => { client.global.petcd = false; }, 300000); // 5 phút cooldown
        }
    }, 300000);
    
    // Interval cho horse
    setInterval(async () => {
        if (!client.global.paused && !client.global.captchadetected && !client.global.horsecd) {
            await channel.send('rpg horse');
            client.global.horsecd = true;
            setTimeout(() => { client.global.horsecd = false; }, 300000); // 5 phút cooldown
        }
    }, 300000);
}

// Error handling
process.on('unhandledRejection', (error) => {
    logger.error('Main', 'UnhandledRejection', error);
});

process.on('uncaughtException', (error) => {
    logger.error('Main', 'UncaughtException', error);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    logger.info('Main', 'Shutdown', 'Received SIGINT, shutting down gracefully');
    
    // Cleanup các manager
    client.huntManager.cleanup();
    client.cooldownManager.cleanup();
    client.inventoryManager.cleanup();
    client.eventManager.cleanup();
    client.shopManager.cleanup();
    client.infoChecker.cleanup();
    
    process.exit(0);
});

// Login
client.login(client.config.token); 