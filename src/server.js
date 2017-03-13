import winston from 'winston'
import ns from 'natural-script'
import dotenv from 'dotenv'

import Os from './os/os'

import { Slack } from './adapters'
import { admin, scheduler, welcome, safeKeeper } from './middlewares'

if ('production' !== process.env.NODE_ENV) {
    dotenv.config()
}

let slack = new Slack({
    token: process.env.SLACK_API_TOKEN
})

slack.keepAlive()

slack.on('restart', () => {
    winston.info('slack restarting')
})

slack.on('ready', () => {
    winston.info('slack ready')
})

let os = new Os({
    parser: ns.parse,
    adapters: [ slack ],
    name: process.env.NAME || 'jarvis',
    icon_url: process.env.ICON_URL || 'https://avatars1.githubusercontent.com/u/24452749?v=3&s=200',
    response_time: 1000
})

os.on('ready', () => {
    winston.info(`assistant ${os.name} ready`)
})

os.use(welcome)
os.use(admin)
os.use(scheduler)
os.use(safeKeeper)

os.hear('wake me up {{date:date}}', (req, res) => {
    scheduler.scheduleDateEvent(req.user, 'wake-up', req.parsed.date.start.date())
})

os.hear('wake me up {{occurrence:occurence}}', (req, res) => {
    scheduler.scheduleOccurrenceEvent(req.user, 'wake-up', req.parsed.occurence.laterjs)
})

scheduler.on('event.scheduled', ({ diff, event }) => {
    winston.info('event.scheduled')
    os.speak(event.event.user, 'Roger that!')
})

scheduler.on('event.done.once', ({ event }) => {
    winston.info('event.done.once')
    if (event.event.name === 'wake-up') {
        os.speak(event.event.user, 'Wake up!')
    } else {
        os.speak(event.event.user, 'let\'s go')
    }
    event.event.finish()
})

scheduler.on('event.done.several.times', ({ event }) => {
    winston.info('event.done.several.times')
    if (event.event.name === 'wake-up') {
        os.speak(event.event.user, 'Wake up!')
    } else {
        os.speak(event.event.user, 'let\'s go')
    }
})

os.hear('*', (req, res) => {
    res.reply('Sorry, I didn\'t understand your request')
})

os.start()
