'use strict';

let express = require('express'),
   passport = require('passport'),
   Strategy = require('passport-local').Strategy,
         db = require('./db'),
         fs = require('fs'),
       http = require('http'),
      https = require('https'),
   nunjucks = require('nunjucks');


// Credentials are only needed in the production https environment
var privateKey, certificate, credentials;
if (process.argv[2] == 'local') {
    privateKey  = null;
    certificate = null;
    credentials = null;
} else {
    privateKey  = fs.readFileSync('/etc/letsencrypt/live/ogilvie.us.com/privkey.pem', 'utf8');
    certificate = fs.readFileSync('/etc/letsencrypt/live/ogilvie.us.com/cert.pem', 'utf8');
    credentials = {key: privateKey, cert: certificate};
}

// The server we're building and the TCP port it will listen on
var server;
let port = 4002;

// Configure the local strategy for use by Passport.
// input: credencials (username, passord), callback (cb)
//
// The verify function (db.users.findByUsername) verified that
// the given password is correct for the provided password.
// and invokes the provied callback with success or failure.
//
// User object is set to req.user after authentication.
passport.use(new Strategy(function(username, password, cb) {

        db.users.findByUsername(username, function(err, user) {

            if (err)
                return cb(err);

            if (!user)
                return cb(null, false);

            if (user.password != password)
                return cb(null, false);

            return cb(null, user);
        });
}));


/*
 *             PASSPORT AUTHENTICATED SESSION PERSISTENCE.
 */
passport.serializeUser(function(user, cb) {
    cb(null, user.id);
});

passport.deserializeUser(function(id, cb) {

    db.users.findById(id, function (err, user) {

        if (err)
            return cb(err);

        cb(null, user);
    });
});


/*
 *             E X P R E S S
 */
var app = express();

/*
 *             M I D D L E W A R E
 */

// Template Engine
nunjucks.configure('views', {
    autoescape: true,
    express: app
});

// Logging
app.use(require('morgan')('combined'));

// Cookies
app.use(require('cookie-parser')());

// http request parsing
app.use(require('body-parser').urlencoded({ extended: true }));

// http session handling
app.use(require('express-session')({ secret: 'keyboard cat', resave: false, saveUninitialized: false }));

// Authentication
app.use(passport.initialize());
app.use(passport.session());

// Static Files
app.use(express.static('lib'));    // CSS and JS Libraris

/*
 *            A P P L I C A T I O N  R O U T I N G
 */

app.get('/',  function(req, res) {
    res.render('home.njk', { user: req.user });
});

app.get('/login', function(req, res){
    res.render('login.njk');
});

app.post('/login',
  passport.authenticate('local', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/');
  });

app.get('/logout', function(req, res){
    req.logout();
    res.redirect('/');
 });

app.get('/profile', require('connect-ensure-login').ensureLoggedIn(),
  function(req, res){
    res.render('profile.njk', { user: req.user });
});



if (process.argv[2] === 'local') {
    server = http.createServer(app);
    console.log(`Running http on port: ${port}`);
}
else {
    server = https.createServer(credentials, app);
    console.log(`Running https on port: ${port}`);
}

server.listen(port);
