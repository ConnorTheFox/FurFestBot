'use strict'

const Promise = require('bluebird')
const path = require('path')
const gm = require('gm')
const fs = Promise.promisifyAll(require('fs-extra'))
const color = require('node-vibrant')
const debug = require('debug')('pic')
const days = require('./days.js')
const log = require('./logController.js')
const returns = require('./returns.js')
const db = require('./dbcontroller.js')


const genImage = function () {
	return new Promise(async (res, rej) => {
		let pics = await fs.readdirAsync(path.join(__dirname, '../pics'))
		let photoCredit = await db.distinct('name', {used:false}, 'credit')
		let photoName = photoCredit[Math.floor(Math.random() * photoCredit.length)]
		let photoArr = await db.find({used:false, name:photoName}, 'credit')
		let photo = photoArr[Math.floor(Math.random() * photoArr.length)]
		await db.update(photo, {used:true}, 'credit')
		if (path.parse(photo.photo).ext === '.jpg') {
			gm(path.join(__dirname, '../pics/' + photo.photo)).size((err, num) => {
				if (!err) {
					color.from(path.join(__dirname, ('../pics/' + photo.photo))).getPalette((err, palette) => {
						if (!err) {
							debug('Got photo colors.')
							writeImage(num.width, num.height, palette.Vibrant._rgb, photo.photo)
						} else {
							rej(err)
						}
					})
				} else {
					rej(err)
				}
			})
		}

		function writeImage(width, height, palette, photo) {
			const day = days.until()
			const landscapeHeight = 1.65 //Constant for landscape height
			const portraitHeight = 1.8 //Constant for portrait height
			let textW
			let textH
			//Larger Number moves it to the left, Smaller moves it down
			const daypos = {
				3: {
					landscape: [4.4, landscapeHeight],
					portrait: [4.4, portraitHeight]
				},
				2: {
					landscape: [3.2, landscapeHeight],
					portrait: [3.2, portraitHeight]
				},
				1: {
					landscape: [2.4, landscapeHeight],
					portrait: [2.4, portraitHeight]
				}
			}
			let determinePosition = day.toString().length
			if (width > height) {
				textW = width / daypos[determinePosition].landscape[0]
				textH = height / daypos[determinePosition].landscape[1]
			} else {
				textW = width / daypos[determinePosition].portrait[0]
				textH = height / daypos[determinePosition].portrait[1]
			}
			let textColor = `rgb(${palette[0]}, ${palette[1]}, ${palette[2]})`
			debug('Preparing to generate photo.')
			gm(path.join(__dirname, '../pics/' + photo))
				.fill(textColor)
				.drawText(textW, textH, day)
				.font(path.join(__dirname, '../fonts/Notes.ttf'))
				.fontSize(width / 4.5) //Smaller number makes it larger
				.write(path.join(__dirname, '../countdown/' + day.toString() + '.jpg'), (err) => {
					if (!err) {
						log.picture('Day ' + day + ' Generated')
						let file = fs.readFile(path.join(__dirname, '../countdown/' + day + '.jpg'), (err, data) => {
							if (!err) {
								debug('Photo gen complete writing file.')
								db.find({ photo: photo }, 'credit').then(credit => {
									res({
										buffer: data,
										credit: credit[0].url
									})
								})
							} else {
								rej(err)
							}
						})
					}
				})
		}
	})
}

exports.genImage = genImage
