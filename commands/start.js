module.exports = {
    config: {
        name: "start",
    },
    run: async (client, message, args) => {
        if (client.global.paused) {
            if (client.global.captchadetected) {
                client.global.captchadetected = false;
            }
            client.global.paused = false;
            client.rpc("update");
            await message.delete();
            await message.channel.send({ content: "Bot has been resumed! Happy farming! 🌾" });
            setTimeout(() => {
                require("../utils/farm.js")(client, message);
            }, 1000);
        } else {
            await message.delete();
            await message.channel.send({
                content: "Bot is already running! Use 'stop' command to pause farming.",
            });
        }
    },
};
