import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import * as socket from "socket.io";
import cors from 'cors';
import dotenv from 'dotenv';
import mainsocket from './socket-io/main.js'

dotenv.config()
const PORT = process.env.PORT || 5001
const app = express();
const server = http.createServer(app)
const clientBuildPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../client/build")

const io = new socket.Server(server, {
    // A suspended mobile browser may not answer heartbeats promptly. Session
    // membership and completed turns additionally survive transport and server restarts.
    pingInterval: 25000,
    pingTimeout: 120000,
    maxHttpBufferSize: 2 * 1024 * 1024,
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
})

app.use(cors())
app.use(express.json({limit: "30mb", extended: true}))
app.use(express.urlencoded({limit: "30mb", extended: true}))
app.use(express.static(clientBuildPath))

mainsocket(io, {storagePath: process.env.ONLINE_ROOM_STORE || path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'data/rooms.json')})

app.get('/', (req, res) => {
    if (existsSync(path.join(clientBuildPath, "index.html"))) {
        res.sendFile(path.join(clientBuildPath, "index.html"))
    } else {
        res.send('running')
    }
})

server.listen(PORT, function () {
    console.log(`listening on ${PORT}`);
})
