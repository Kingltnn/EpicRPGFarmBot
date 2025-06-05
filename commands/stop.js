module.exports = {
    config: {
        name: "stop",
    },
    run: async (client, message, args) => {
        if (!client.global.paused) {
            client.global.paused = true;
            client.rpc("update");
            await message.delete();
            await message.channel.send({ 
                content: "Bot has been paused! Use 'start' command to resume farming. 🛑" 
            });
        } else {
            await message.delete();
            await message.channel.send({
                content: "Bot is already paused! Use 'start' command to begin farming.",
            });
        }
    },
}; 