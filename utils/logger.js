const chalk = require("chalk");
let logger = [];

logger.info = (type, module, result = "") => {
    console.log(
        chalk.whiteBright.bold(
            `[${new Date().getHours()}:${new Date().getMinutes()}:${new Date().getSeconds()}]`
        ),
        chalk.cyanBright.bold(type),
        chalk.whiteBright.bold(`>`),
        chalk.magentaBright.bold(module),
        chalk.whiteBright.bold(`>`),
        chalk.greenBright.bold(result)
    );
};

logger.warn = (type, module, result = "") => {
    console.log(
        chalk.whiteBright.bold(
            `[${new Date().getHours()}:${new Date().getMinutes()}:${new Date().getSeconds()}]`
        ),
        chalk.cyanBright.bold(type),
        chalk.whiteBright.bold(`>`),
        chalk.magentaBright.bold(module),
        chalk.whiteBright.bold(`>`),
        chalk.yellowBright.bold(result)
    );
};

logger.alert = (type, module, result = "") => {
    console.log(
        chalk.whiteBright.bold(
            `[${new Date().getHours()}:${new Date().getMinutes()}:${new Date().getSeconds()}]`
        ),
        chalk.cyanBright.bold(type),
        chalk.whiteBright.bold(`>`),
        chalk.magentaBright.bold(module),
        chalk.whiteBright.bold(`>`),
        chalk.redBright.bold(result)
    );
};

logger.error = (type, module, result = "") => {
    console.log(
        chalk.whiteBright.bold(
            `[${new Date().getHours()}:${new Date().getMinutes()}:${new Date().getSeconds()}]`
        ),
        chalk.cyanBright.bold(type),
        chalk.whiteBright.bold(`>`),
        chalk.magentaBright.bold(module),
        chalk.whiteBright.bold(`>`),
        chalk.redBright.bold(result)
    );
};

module.exports = { logger };
