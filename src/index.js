const path = require('path')
const http = require('http')
const express = require('express')
const socketio = require('socket.io')
const Filter = require('bad-words')
const { generateMessage, generateLocationMessage } = require('./utils/messages')
const { addUser, removeUser, getUser, getUsersInRoom } = require('./utils/users')

const app = express()
const server = http.createServer(app)
const io = socketio(server)

const PORT = process.env.PORT || 3000
const publicDirectory = path.join(__dirname, '../public/')

app.use(express.static(publicDirectory))

app.get('/', (req, res) => {
    res.render('index')
})

io.on('connection', (socket) => {

    socket.on('join', (options, callback) => {
        const { error, user } = addUser({ id: socket.id, ...options })

        if (error) {
            return callback(error)
        }

        socket.join(user.room)

        //notify particular connection who sends request
        socket.emit('message', generateMessage('System', 'Welcome!'))

        const message = `${user.username} has joined`
        // send message everyone except myself
        socket.broadcast.to(user.room).emit('message', generateMessage(user.username, message))

        // notify all users in room
        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        })

        callback()
    })

    socket.on('sendMessage', (message, callback) => {
        const filter = new Filter()

        if (filter.isProfane(message)) {
            return callback('Profanity is not allowed')
        }

        const user = getUser(socket.id)

        if (!user) {
            return callback(`An user is not known`)
        }

        //notify all connected clients
        io.to(user.room).emit('message', generateMessage(user.username, message))
        callback()
    })

    socket.on('sendLocation', (coords, callback) => {
        const user = getUser(socket.id)

        if (!user) {
            return callback(`An user is not known`)
        }

        const location = `https://google.com/maps?q=${coords.latitude},${coords.longitude}`
        io.to(user.room).emit('locationMessage', generateLocationMessage(user.username, location))
        callback()
    })

    socket.on('disconnect', () => {
        const user = removeUser(socket.io)

        if (user) {
            const message = `${user.username} `
            io.to(user.room).emit('message', generateMessage('System', 'A user has left'))

            // notify all users in room
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            })
        }
    })
})

server.listen(PORT, () => {
    console.log(`Started on http://localhost:${PORT}`)
})