'use strict'

let bot
const process = require('process')
const child = require('child_process')
const path = require('path')
const emoji = require('node-emoji')
const fs = require('fs')
const TelegramBot = require('node-telegram-bot-api')
const unzip = require('unzip')
const move = require('mv')
const pic = require('./src/pic.js')
let token = process.env.TOKEN

let mode = process.env.TYPE
if (mode === 'test') {
    bot = new TelegramBot(token, {
        polling: true
    })
}
if (mode === 'production') {
    bot = new TelegramBot(token, {
        webHook: {
            port: 8000,
            key: __dirname + '/keys/key.pem',
            cert: __dirname + '/keys/crt.pem'
        }
    })
    bot.setWebHook('telegram.thetechiefox.com/bot' + token, __dirname + '/keys/crt.pem')
}

const days = require('./src/days.js')
const db = require('./src/dbcontroller.js')
const Nano = require('nanotimer')
const timer = new Nano()
const delayForTime = new Nano()
const request = require('request')
const returns = require('./src/returns.js')
const log = require('./src/logController.js')

const start = 'The bot is currently not counting down since MFF 2016 just happened. Going to start it about day 250. If you want to add your name into the countdown use /countdown'
const help = '/countdown - Adds you to countdown list\n/stopcountdown - Stops countdown \n/credit - Credit for the pictures I use in the countdown'
const info = 'Im a fox'
let timeDrift = true

let connor = 119682002

bot.on('new_chat_participant', function(msg) {
    if (msg.new_chat_participant.id === 185002901) {
        bot.sendMessage(msg.chat.id, start, {
            parse_mode: 'markdown'
        })
    }
})

bot.on('message', function(msg) {
    if (msg.migrate_from_chat_id) {
        db.lookup('chatId', msg.migrate_from_chat_id).then(function(found) {
                if (found[0]) {
                    db.update({
                        chatId: msg.migrate_from_chat_id
                    }, msg.migrate_to_chat_id).then(console.log('Supergroup' + msg.chat.title + 'Updated'))
                }
            })
            .catch(err => {
                handleErr(err, msg.chat.id, 'Supergroup Change')
            })
    }
})


bot.onText(/\/start/, function(msg, match) {
    generateLog(msg.chat.title || msg.chat.first_name, 'start', 'command', testForGroup(msg.chat.first_name))
    bot.sendMessage(msg.chat.id, start, {
        parse_mode: 'markdown'
    })
})

bot.onText(/\/countdown/, function(msg, match) {
    generateLog(msg.chat.title || msg.chat.first_name, 'countdown', 'command', testForGroup(msg.chat.first_name))
    db.add(msg.chat.id, msg.chat.title || msg.chat.first_name, testForGroup(msg.chat.first_name)).then(function(input) {
            if (input === 'Added') {
                bot.sendMessage(msg.chat.id, 'Added to countdown list for whenever I start it back up').then(bot.sendMessage('connor', msg.chat.title || msg.chat.first_name + ' Subscribed!'))
                    .catch(err => {
                        handleErr(err, msg.chat.id, 'Add To Countdown')
                    })
            }
            if (input === 'In') {
                bot.sendMessage(msg.chat.id, 'Im sorry you are already subscribed')
            }
        })
        .catch(err => {
            handleErr(err, null, 'Add To Countdown')
        })
})


bot.onText(/\/info/, function(msg, match) {
    generateLog(msg.chat.title || msg.chat.first_name, 'info', 'command', testForGroup(msg.chat.first_name))
    bot.sendMessage(msg.chat.id, info)
})


bot.onText(/\/stopcountdown/, function(msg, match) {
    generateLog(msg.chat.title || msg.chat.first_name, 'stopcountdown', 'command', testForGroup(msg.chat.first_name))
    db.remove(msg.chat.id).then(function(done) {
            if (done === 'Removed') {
                bot.sendMessage(msg.chat.id, 'Unscribed form daily countdown')
            }
            if (done === 'Not Here') {
                bot.sendMessage(msg.chat.id, 'Already removed')
            }
        })
        .catch(err => {
            handleErr(err, msg.chat.id, 'Removing User')
        })
})

bot.onText(/\/daysleft/, function(msg, match) {
    let day = days.untilMff()
    generateLog(msg.chat.title || msg.chat.first_name, 'daysleft', 'command', testForGroup(msg.chat.first_name))
    bot.sendMessage(msg.chat.id, day + ' Days until MFF')
})


bot.onText(/\/help/, function(msg, match) {
    generateLog(msg.chat.title || msg.chat.first_name, 'help', 'command', testForGroup(msg.chat.first_name))
    bot.sendMessage(msg.chat.id, help)
})



bot.onText(/\/debug/, function(msg, match) {
    if (msg.chat.id === connor) {
        sendDaily()
    }
})

timer.setInterval(checkTime, '', '60s')

function checkTime() {
    let date = new Date()
    let hour = date.getHours()
    let minute = date.getMinutes()
    if (hour === 10 && minute === 0 || hour === 10 && minute === 1 && timeDrift === true) {
        sendDaily()
        timeDrift = false
        delayForTime.setTimeout(function() {
            timeDrift = true
        }, '', '240s')
    }
}
sendDaily()
function sendDaily() {
    fs.writeFileSync(__dirname + '/backups/countdown ' + new Date().toDateString() + '.db', fs.readFileSync(__dirname + '/databases/countdown.db'))
    let totalPics = fs.readdirSync('mff').length
    let attempt = 0
    let photoId
    let mffDay = days.untilMff()
    if (mffDay > !1 && mffDay < totalPics + 1) {
        db.lookup({})
            .then(function(users) {
                pic.pickImage().then(function(returned) {
                        let captionString = returns.emojiParser(mffDay) + ' MFF!! ' + returns.randomEmoji() + '\n\n📸: ' + returned.credit

                        function getPhotoId(num) {
                            bot.sendPhoto(users[num].chatId, returned.buffer, {
                                caption: captionString
                            }).then(function(info) {
                                photoId = info.photo[info.photo.length - 1].file_id
                                if (attempt === 0) {
                                    users.splice(attempt, attempt + 1)
                                } else {
                                    users.splice(attempt, attempt)
                                }
                                gotPhotoId()
                                generateLog(info.chat.first_name, null, 'daily')
                            }).catch(function(err) {
                                if (err) {
                                    db.error(users[num])
                                    users.splice(attempt, attempt)
                                    attempt += 1
                                    getPhotoId(attempt)
                                }
                            })
                        }

                        function gotPhotoId() {
                            users.forEach(user => {
                                bot.sendPhoto(user.chatId, photoId, {
                                    caption: captionString
                                }).then(function(info) {
                                    generateLog(info.chat.first_name, null, 'daily')
                                }).catch(function(err) {
                                    if (err) {
                                        db.error(user)
                                    }
                                })
                            })
                        }
                        getPhotoId(attempt)
                    })
                    .catch(err => {
                        handleErr(err, null, 'Generating Image')
                    })
            })
            .catch(err => {
                handleErr(err, null, 'Send Daily DB Lookup')
            })
    }
}


bot.onText(/\/broadcast (.+)/, function(msg, match) {
    if (msg.chat.id === connor) {
        db.lookup({}).then(users => {
            users.forEach(id => {
                bot.sendMessage(id.chatId, match[1], {
                    parse_mode: 'Markdown'
                })
            })
        })
    }
})

bot.on('document', function(msg) {
    if (msg.chat.id === connor) {
        bot.downloadFile(msg.document.file_id, __dirname + '/zip/').then(zip => {
                var name = path.parse(zip).base
                fs.createReadStream(__dirname + '/zip/' + name).pipe(unzip.Extract({
                    path: __dirname + '/zip/'
                })).on('close', function() {
                    fs.readFile('zip/author.txt', 'utf8', function(err, file) {
                        if (!err) {
                            fs.readdir('zip', function(err, dir) {
                                if (!err) {
                                    let pictureArr = []
                                    dir.forEach(item => {
                                        if (item != 'author.txt' && item != name) {
                                            pictureArr.push(item)
                                        }
                                    })
                                    pictureArr.forEach(item => {
                                        db.addCredit(file, item).catch(err => {
                                            handleErr(err, null, 'db add')
                                        })
                                        move('zip/' + item, 'mff/' + item, function(err) {
                                            if (err) {
                                                handleErr(err, null, 'move file')
                                            }
                                        })
                                    })
                                    bot.sendMessage(connor, 'Added All Photos')
                                    fs.unlink('zip/' + name, function() {})
                                    fs.unlink('zip/author.txt', function() {})
                                } else {
                                    handleErr(err, null, 'document')
                                }
                            })
                        } else {
                            handleErr(err, null, 'document')
                        }
                    })
                })
            })
            .catch(err => {
                handleErr(err, null, 'downloading zip')
            })
    }
})

bot.onText(/\/test (.+)/, function(msg, match) {
    if (msg.chat.id === connor) {
        bot.sendMessage(connor, match[1], {
            parse_mode: 'Markdown'
        })
    }
})

function generateLog(name, command, type, group) {
    if (type === 'command') {
        if (group === true) {
            log.command('Group: ' + name + ' Used command /' + command)
        } else {
            log.command(name + ' Used command /' + command)
        }
    }
    if (type === 'daily') {
        log.daily('Sent to ' + name)
    }
}

function testForGroup(input) {
    if (!input) {
        return true
    } else {
        return false
    }
}

function handleErr(error, user, command) {
    if (user) {
        bot.sendMessage(connor, 'An error has occured in ' + command + '\n' + error)
        bot.sendMessage(user, 'Im sorry an error has occured.' + '\n' + error)
    } else {
        bot.sendMessage(connor, 'An error has occured in ' + command + '\n' + error)
    }
}
