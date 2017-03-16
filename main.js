'use strict'

const Promise = require('bluebird')
const process = require('process')
const fs = Promise.promisifyAll(require('fs-extra'))
const online = Promise.promisifyAll(require('is-online'))
const Nano = require('nanotimer')
const pic = require('./src/pic.js')
const days = require('./src/days.js')
const db = require('./src/dbcontroller.js')
const returns = require('./src/returns.js')
const log = require('./src/logController.js')
const admin = require('./src/adminCommands.js')
const mff = require('./src/bots.js').mff
const adminBot = require('./src/bots.js').admin
const command = require('./src/mffCommands.js')
const message = require('./src/message.js')

const timer = new Nano()
const delayForTime = new Nano()

let timeDrift = true

mff.on('new_chat_participant', command.addedToGroup)
mff.on('message', command.message)
mff.onText(/\/start/, command.start)
mff.onText(/\/countdown/, command.countdown)
mff.onText(/\/stopcountdown/, command.stopCountdown)
mff.onText(/\/info/, command.info)
mff.onText(/\/help/, command.help)
mff.onText(/\/daysleft/, command.daysleft)

adminBot.onText(/\/broadcast (.+)/, admin.broadcast)
adminBot.onText(/\/test (.+)/, admin.test)
adminBot.onText(/\/users/, admin.getUsers)
adminBot.onText(/\/logs/, admin.getLogs)
adminBot.on('document', admin.uploadPhoto)

timer.setInterval(checkTime, '', '60s')

async function checkTime() {
   let date = new Date()
   let hour = date.getHours()
   let minute = date.getMinutes()
   if (hour === 10 && minute === 0 || hour === 10 && minute === 1 && timeDrift === true) {
      let isOnline = await online()
      if (isOnline === true) {
         sendDaily()
      }
      timeDrift = false
      delayForTime.setTimeout(() => {
         timeDrift = true
      }, '', '240s')
   }
}

async function sendDaily(debug) {
   let totalPics = await fs.readdirAsync('mff').length
   let attempt = 0
   let photoId
   let info
   let mffDay = days.untilMff()
   if (mffDay >= 1 && mffDay <= totalPics || debug) {
      await fs.writeFileAsync(__dirname + '/backups/countdown ' + new Date().toDateString() + '.db', fs.readFileSync(__dirname + '/databases/countdown.db'))
      let users = await db.lookup({})
      let returned = await pic.pickImage()
      let captionString = `${returns.emojiParser(mffDay)} \n\n📸: ${returned.credit}`
         users.forEach(async(user) => {
            try {
               let sent = await mff.sendPhoto(user.chatId, returned.buffer, { caption: captionString })
               returns.generateLog(info.chat.first_name, null, 'daily')
            } catch (e) {
               db.error(user)
            }
         })
   }
}


mff.onText(/\/until/, msg => {
   fs.readdir('mff', (err, img) => {
      mff.sendMessage(msg.chat.id, (days.untilMff() - img.length) + ' Days until start')
   })
})

mff.onText(/\/debug/, (msg) => {
   if (msg.chat.id === message.connor) {
      sendDaily(true)
   }
})
