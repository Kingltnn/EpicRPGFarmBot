KingLTN</br>
<br> {/\_\_/}</br>( • . •)</br>/ > 🤍

<h1 align="center">EpicRPG Farm Bot V0.0.5.5(BETA)</h1>
<p align="center">

[![Total Views](https://hits.sh/github.com/Kingltnn/EpicRPGFarmBot.svg?view=today-total&label=Repo%20Today/Total%20Views&color=770ca1&labelColor=007ec6)](https://github.com/Kingltnn/EpicRPGFarmBot)
[![Last Commit](https://img.shields.io/github/last-commit/Kingltnn/EpicRPGFarmBot)](https://github.com/Kingltnn/EpicRPGFarmBot)

## Tutorials

### Text

-   [🎈・Installation](#Installation)
    -   [Windows / Linux](#windows--linux) - Official

</p>

# Contents

[⭐・Star History](#star-history)<br>
[❗・Important](#important)<br>
[👑・Features](#features)<br>
[⚙・Config.json example](#configjson-example)<br>
[📚・Discord RPC](#discord-rpc)<br>
[⚠️・Captcha Alert](#captcha-alert)<br>
[🔗・Required Links](#required-links)<br>
[🎈・Installation](#Installation)<br>

## ⭐・Star History

<h2 align="center">Goal: <a href="https://github.com/Kingltnn/EpicRPGFarmBot/stargazers"><img src="https://img.shields.io/github/stars/Kingltnn/EpicRPGFarmBot" /></a> / 99</h2>
⭐⭐⭐ You can also give this repository a star so that others know we're trusted!<br>

## ❗・Important (Anyone using the bot is deemed to have read and accepted these)

-   Use of this farm bot may lead to actions being taken against your EpicRPG profile and/or your Discord account. We are not responsible for them.
-   Discord may restart as a result of discord RPC overload.
-   DO NOT USE ONE CHANNEL FOR TWO ACCOUNTS, USE IT FOR 1 ACCOUNT ONLY.

## 👑・Features

-   Auto Commands:

    -   Rewards:
        -   Daily
        -   Weekly
        -   Vote (automatically opens the voting site in the browser if you have a vote (not working in termux))
    -   Experience:
        -   Hunt
        -   Adventure
        -   Training
    -   Progress:
        -   Farm
            -   Seed
            -   Potato seed
            -   Carrot seed
            -   Bread seed
        -   Working:
            -   Chop
            -   Fish
            -   Pickup
            -   Mine
            -   Axe
            -   Net
            -   Ladder

-   Event:

    -   Auto Join Events
    -   Auto Special Trade
    -   Auto Accept Arena

-   Inventory:

    -   Auto Check Inventory
    -   Auto Use Life Potion (Heal)
    -   Auto Use Selected LootBoxes
    -   Auto Sell Selected Items
-   Shop:
    -   Auto buy lootbox
-    Webhook
    - Send webhook when captcha detected
    - send webhook profile
    - send inventory webhook   
-   Discord RPC
-   Auto Phrases Send
-   Auto Restart:
    -   Automatically restarts after captcha verification
    -   Automatically restarts when using command "3"
    -   Automatically restarts after crashes
-   Simple Bot Control:
    -   Send "2" to pause bot
    -   Send "3" to restart bot

## ⚙・config.json example

```
{

    {  
  "prefix": "",Enter Prefix
    "token": "",    Enter Account Token
    "channelid": "1377455233944522872", Enter channel id where the bot will work
    "userid": "419369142873882627",Enter your discord account user id
    "commands": {
        "rewards": {
            "daily": true, / true or false
            "weekly": true, / true or false
            "vote": {
                "enable": false / true or false
            }
        },
        "experience": {
            "hunt": true, / true or false
            "adventure": true,     / true or false
            "training": true     / true or false
        },
        "progress": {/ !!!! Enable only one of the progress commands, if more than one progress command is enabled, only the farm command is enabled by default
            "farm": {
                "enable": true,   / true or false
                "types": {
                    "seed": true,    / true or false
                    "potato seed": false,     / true or false
                    "carrot seed": false,    / true or false
                    "bread seed": false    / true or false
                }
            },
            "working": {    / !!!! Enable only one of the run commands, if you enable more than one, by default only the chop command will be enabled.
                "chop": false,    / true or false
                "fish": false,    / true or false
                "pickup":false,    / true or false
                "mine": false,    / true or false
                "axe": true,    / true or false
                "net": false,    / true or false
                "ladder": false    / true or false
            }
        }
    },
    "settings": {
        "discordrpc": false,    / true or false
        "autophrases": true,    / true or false
        "event": {
            "autojoin": true,    / true or false
            "autospecialtrade": true,    / true or false
            "autoarena": true    / true or false
        },
        "shop": {
            "enabled": true, / true or false
            "items": {
                "EDGY lootbox": {
                    "enabled": true     / true or false
                },
                "EPIC lootbox": {
                    "enabled": false     / true or false
                },
                "rare lootbox": {
                    "enabled": false    / true or false
                }
            },
            "check_interval": 300000,
            "retry_delay": 60000
        },
        "captcha_protection": {
            "enabled": true,    / true or false
            "webhook_url": "", Link url discord
            "notification": {
                "desktop": false,      / true or false
                "discord": true,     / true or false
                "sound": false     / true or false
            },
            "auto_resume": true,     / true or false
            "auto_reduce_activity": false     / true or false
        },
        "inventory": {
            "check": true,     / true or false
            "lifepotion": {
                "autouse": true,   / true or false
                "hplimit": 100  /will automatically use a life potion when your health drops below this value
            },
            "lootbox": {
                "autouse": true, / true or false
                "types": {
                    "common lootbox": true, / true or false
                    "uncommon lootbox": true,    / true or false
                    "rare lootbox": true,    / true or false
                    "EPIC lootbox": true,    / true or false
                    "EDGY lootbox":  false,    / true or false
                    "OMEGA lootbox": false    / true or false
                }
            },
            "sell": {
                "enable": false,    / true or false
                "types": {
                    "normie fish": true,    / true or false
                    "golden fish": true,    / true or false
                    "EPIC fish": false,    / true or false    
                    "SUPER fish": false,    / true or false
                    "wooden log": false,    / true or false
                    "EPIC log": false,    / true or false
                    "SUPER log": false,    / true or false
                    "MEGA log": false,    / true or false
                    "HYPER log": false,    / true or false
                    "ULTRA log": false,    / true or false
                    "ULTIMATE log": false,    / true or false
                    "apple": false,    / true or false
                    "banana": false,    / true or false
                    "bread": false,    / true or false
                    "carrot": false,    / true or false
                    "flask": false,    / true or false
                    "wolf skin": false,    / true or false
                    "zombie eye": false    / true or false
                }
            }
        },
        "webhooks": {
            "profile": {
                "url": "", Link url discord
                "checkInterval": 3600000
            },
            "inventory": {
                "url": "",    Link url discord
                "checkInterval": 2700000
            }
        }
    }
}

```

## 💎・Get Token

### PC

1. Open your preferred browser (with developer tools) and login to https://discord.com/app
2. Press CTRL + Shift + I and open the Console tab.
3. Paste the following code.
4. The text returned (excluding the quotes `'`) will be your Discord account token.

```js
(webpackChunkdiscord_app.push([
    [""],
    {},
    (e) => {
        for (let t in ((m = []), e.c)) m.push(e.c[t]);
    },
]),
m)
    .find((e) => e?.exports?.default?.getToken !== void 0)
    .exports.default.getToken();
```

### Mobile/Android

1. Open Chrome
2. Create a bookmark (by clicking on star button in 3 dots menu)
3. Edit it and set name to Token Finder and url to the following code:
    ```javascript
    javascript: (webpackChunkdiscord_app.push([[""],{},(e)=>{m=[];for (let c in e.c) m.push(e.c[c]);},]),m).find((m) => m?.exports?.default?.getToken%20!==%20void%200)%20%20%20%20.exports.default.getToken();
    ```
4. Open https://discord.com/app and log in.
5. Tap on search bar and type Token Finder (don't search it just type)
6. Click on the bookmark named Token Finder.
7. A new page will open, the text in the page will be your Discord account token.

## 📚・Discord RPC

![](https://raw.githubusercontent.com/Kingltnn/EpicRPGFarmBot/main/images/rpc.jpg)

## ⚠️・Captcha Alert

> [!NOTE]
> If you want the captcha alert to work properly, turn off do not disturb

![](https://raw.githubusercontent.com/Kingltnn/EpicRPGFarmBot/main/images/captchaalert.png)

## 🔗・Required Links

[NodeJS](https://nodejs.org/en/)<br>
[Terminal](https://apps.microsoft.com/detail/9n0dx20hk701)<br>
[Farm Bot ZIP File](https://github.com/Kingltnn/EpicRPGFarmBot/archive/refs/heads/main.zip)

## 🎈・Installation

### 🖥️・Windows / Linux

```bash
# Install:
1. Download and install NodeJS
2. Download the bot files
3. Configure config.json with your settings
4. Run start.bat (Windows) or start.sh (Linux)

# Control Bot:
- Send "2" in the configured channel to pause the bot
- Send "3" in the configured channel to resume the bot
```


"# EpicRPG" 
