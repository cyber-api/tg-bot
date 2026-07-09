const mongoose = require('mongoose');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const threadModelMongo = require('./models/thread');
const userModelMongo = require('./models/user');

class SQLiteUserModel {
    constructor(db) {
        this.db = db;
    }
    async findOne(query) {
        return new Promise((resolve, reject) => {
            const key = query.userID ? 'userID' : 'username';
            const val = query.userID || query.username;
            this.db.get(`SELECT * FROM users WHERE ${key} = ?`, [val], (err, row) => {
                if (err) return reject(err);
                if (!row) return resolve(null);
                resolve({
                    userID: row.userID,
                    username: row.username,
                    first_name: row.first_name,
                    last_name: row.last_name,
                    banned: Boolean(row.banned),
                    save: async () => {
                        return new Promise((res, rej) => {
                            this.db.run(
                                `INSERT OR REPLACE INTO users (userID, username, first_name, last_name, banned) VALUES (?, ?, ?, ?, ?)`,
                                [row.userID, row.username, row.first_name, row.last_name, row.banned ? 1 : 0],
                                (e) => e ? rej(e) : res(true)
                            );
                        });
                    }
                });
            });
        });
    }
    async find(query = {}) {
        return new Promise((resolve, reject) => {
            this.db.all(`SELECT * FROM users`, [], (err, rows) => {
                if (err) return reject(err);
                resolve(rows.map(row => ({
                    ...row,
                    banned: Boolean(row.banned)
                })));
            });
        });
    }
    async countDocuments() {
        return new Promise((resolve, reject) => {
            this.db.get(`SELECT COUNT(*) as count FROM users`, [], (err, row) => {
                if (err) return reject(err);
                resolve(row ? row.count : 0);
            });
        });
    }
}

class SQLiteThreadModel {
    constructor(db) {
        this.db = db;
    }
    async findOne(query) {
        return new Promise((resolve, reject) => {
            this.db.get(`SELECT * FROM threads WHERE chatId = ?`, [query.chatId], (err, row) => {
                if (err) return reject(err);
                let usersMap = new Map();
                if (row && row.usersData) {
                    try {
                        const parsed = JSON.parse(row.usersData);
                        for (const [k, v] of Object.entries(parsed)) {
                            usersMap.set(k, v);
                        }
                    } catch(e) {}
                }

                const threadObj = {
                    chatId: query.chatId,
                    sorthelp: row ? Boolean(row.sorthelp) : false,
                    users: usersMap,
                    save: async () => {
                        let usersObj = {};
                        if (threadObj.users instanceof Map) {
                            for (let [k, v] of threadObj.users.entries()) {
                                usersObj[k] = v;
                            }
                        } else if (typeof threadObj.users === 'object' && threadObj.users !== null) {
                            usersObj = threadObj.users;
                        }
                        const usersDataStr = JSON.stringify(usersObj);
                        return new Promise((res, rej) => {
                            this.db.run(
                                `INSERT OR REPLACE INTO threads (chatId, sorthelp, usersData) VALUES (?, ?, ?)`,
                                [threadObj.chatId, threadObj.sorthelp ? 1 : 0, usersDataStr],
                                (e) => e ? rej(e) : res(true)
                            );
                        });
                    }
                };
                if (!row) {
                    return resolve(threadObj);
                }
                resolve(threadObj);
            });
        });
    }
    async find(query = {}) {
        return new Promise((resolve, reject) => {
            this.db.all(`SELECT * FROM threads`, [], (err, rows) => {
                if (err) return reject(err);
                resolve(rows.map(row => {
                    let usersMap = new Map();
                    if (row.usersData) {
                        try {
                            const parsed = JSON.parse(row.usersData);
                            for (const [k, v] of Object.entries(parsed)) {
                                usersMap.set(k, v);
                            }
                        } catch(e) {}
                    }
                    return {
                        chatId: row.chatId,
                        sorthelp: Boolean(row.sorthelp),
                        users: usersMap
                    };
                }));
            });
        });
    }
    async countDocuments() {
        return new Promise((resolve, reject) => {
            this.db.get(`SELECT COUNT(*) as count FROM threads`, [], (err, row) => {
                if (err) return reject(err);
                resolve(row ? row.count : 0);
            });
        });
    }
}

module.exports = async function(configOrUri) {
    let config = {};
    if (typeof configOrUri === 'string') {
        config = { databaseType: 'mongodb', mongoURI: configOrUri };
    } else {
        config = configOrUri || {};
    }

    const dbType = config.databaseType || 'sqlite';
    const mongoURI = config.mongoURI;

    if (dbType === 'mongodb' && mongoURI && mongoURI !== 'MOngoDB_URI' && mongoURI.startsWith('mongodb')) {
        try {
            await mongoose.connect(mongoURI, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
            });
            console.log('[DATABASE] Connected to MongoDB successfully.');
            return {
                threadModel: threadModelMongo,
                userModel: userModelMongo,
                dbType: 'mongodb'
            };
        } catch (err) {
            console.warn('[DATABASE] MongoDB connection failed, falling back to SQLite:', err.message);
        }
    }

    // Default to SQLite
    const dbFile = path.resolve(__dirname, '..', 'database', 'bot.sqlite');
    const dbDir = path.dirname(dbFile);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }

    const sqliteDb = new sqlite3.Database(dbFile);
    
    await new Promise((resolve, reject) => {
        sqliteDb.serialize(() => {
            sqliteDb.run(`CREATE TABLE IF NOT EXISTS users (
                userID TEXT PRIMARY KEY,
                username TEXT,
                first_name TEXT,
                last_name TEXT,
                banned INTEGER DEFAULT 0
            )`, (err) => {
                if (err) return reject(err);
            });

            sqliteDb.run(`CREATE TABLE IF NOT EXISTS threads (
                chatId TEXT PRIMARY KEY,
                sorthelp INTEGER DEFAULT 0,
                usersData TEXT
            )`, (err) => {
                if (err) return reject(err);
                resolve();
            });
        });
    });

    console.log('[DATABASE] Connected to SQLite database successfully.');
    return {
        threadModel: new SQLiteThreadModel(sqliteDb),
        userModel: new SQLiteUserModel(sqliteDb),
        dbType: 'sqlite',
        sqliteDb
    };
};
