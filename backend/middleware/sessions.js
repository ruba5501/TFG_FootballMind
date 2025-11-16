"use strict";

const session = require('express-session');
const MongoStore = require('connect-mongo');

const middlewareSession = session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI,
        collectionName: 'sessions',
        ttl: 60 * 60 * 24  // 1 día
    }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24  // 1 día
    }
});

module.exports = middlewareSession;
