const { spawn } = require('child_process');
const path = require('path');

function startBot() {
    console.log('Starting bot...');
    
    // Khởi động bot.js như một process con
    const bot = spawn('node', ['bot.js'], {
        stdio: 'inherit', // Cho phép xem log trực tiếp
        cwd: __dirname // Đảm bảo chạy trong thư mục hiện tại
    });

    // Lắng nghe sự kiện kết thúc
    bot.on('exit', (code) => {
        if (code === 15) { // Exit code 15 = yêu cầu khởi động lại sau captcha hoặc lệnh restart
            console.log('Bot requested restart. Restarting in 2 seconds...');
            setTimeout(startBot, 2000); // Đợi 2 giây trước khi khởi động lại
        } else if (code !== 0) {
            console.log(`Bot crashed with code ${code}. Restarting in 5 seconds...`);
            setTimeout(startBot, 5000);
        } else {
            console.log('Bot exited normally. Restarting in 2 seconds...');
            setTimeout(startBot, 2000);
        }
    });

    // Xử lý lỗi process
    bot.on('error', (err) => {
        console.error('Failed to start bot:', err);
        setTimeout(startBot, 5000);
    });
}

// Bắt đầu bot
startBot(); 