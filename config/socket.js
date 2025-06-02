const socketIO = require('socket.io');
const Message = require('../models/messageModel');

function initializeSocket(server) {
    const io = socketIO(server);
    const userSockets = new Map(); // 存储用户ID和socket的映射

    io.on('connection', (socket) => {
        console.log('New client connected');

        // 用户加入聊天
        socket.on('join chat', ({ userId }) => {
            userSockets.set(userId, socket.id);
            console.log(`User ${userId} joined chat`);
        });

        // 新消息
        socket.on('new message', async (message) => {
            const { senderId, receiverId, content } = message;
            
            // 获取接收者的socket
            const receiverSocketId = userSockets.get(receiverId);
            
            if (receiverSocketId) {
                // 如果接收者在线，发送实时消息
                io.to(receiverSocketId).emit('receive message', {
                    senderId,
                    content,
                    created_at: new Date()
                });
            }

            // 同时也发送给发送者（用于多设备同步）
            const senderSocketId = userSockets.get(senderId);
            if (senderSocketId && senderSocketId !== socket.id) {
                io.to(senderSocketId).emit('receive message', {
                    senderId,
                    content,
                    created_at: new Date()
                });
            }
        });

        // 用户离开聊天
        socket.on('leave chat', ({ userId }) => {
            userSockets.delete(userId);
            console.log(`User ${userId} left chat`);
        });

        // 断开连接
        socket.on('disconnect', () => {
            // 找到并删除断开连接的用户
            for (const [userId, socketId] of userSockets.entries()) {
                if (socketId === socket.id) {
                    userSockets.delete(userId);
                    console.log(`User ${userId} disconnected`);
                    break;
                }
            }
        });
    });

    return io;
}

module.exports = initializeSocket; 