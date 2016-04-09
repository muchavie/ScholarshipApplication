'use strict';

var express = require('express');
var passport = require('passport');
var Strategy = require('passport-local').Strategy;
var db = require('./db');
var fs = require('fs');
var http = require('http');
var https = require('https');
var nunjucks = require('nunjucks');


var privateKey, certificate, credentials;
if (process.argv[2] == 'local') {
    privateKey = null;
    certificate = null;
    credentials = null;
} else {
    privateKey  = fs.readFileSync('/etc/letsencrypt/live/ogilvie.us.com/privkey.pem', 'utf8');
    certificate = fs.readFileSync('/etc/letsencrypt/live/ogilvie.us.com/cert.pem', 'utf8');
    credentials = {key: privateKey, cert: certificate};
}




// Configure the local strategy for use by Passport.
//
// The local strategy require a `verify` function which receives the credentials
// (`username` and `password`) submitted by the user.  The function must verify
// that the password is correct and then invoke `cb` with a user object, which
// will be set at `req.user` in route handlers after authentication.
passport.use(new Strategy(
  function(username, password, cb) {
    db.users.findByUsername(username, function(err, user) {
      if (err) { return cb(err); }
      if (!user) { return cb(null, false); }
      if (user.password != password) { return cb(null, false); }
      return cb(null, user);
    });
  }));


// Configure Passport authenticated session persistence.
//
// In order to restore authentication state across HTTP requests, Passport needs
// to serialize users into and deserialize users out of the session.  The
// typical implementation of this is as simple as supplying the user ID when
// serializing, and querying the user record by ID from the database when
// deserializing.
passport.serializeUser(function(user, cb) {
  cb(null, user.id);
});

passport.deserializeUser(function(id, cb) {
  db.users.findById(id, function (err, user) {
    if (err) { return cb(err); }
    cb(null, user);
  });
});


// Create a new Express application.
var app = express();
// using nunjucks as the template engine
nunjucks.configure('views', {
    autoescape: true,
    express: app
});

// Use application-level middleware for common functionality, including
// logging, parsing, and session handling.
app.use(require('morgan')('combined'));
app.use(require('cookie-parser')());
app.use(require('body-parser').urlencoded({ extended: true }));
app.use(require('express-session')({ secret: 'keyboard cat', resave: false, saveUninitialized: false }));

// Initialize Passport and restore authentication state, if any, from the
// session.
app.use(passport.initialize());
app.use(passport.session());

// Define routes.
app.get('/',
  function(req, res) {
    res.render('home.njk', { user: req.user });
  });

app.get('/login',
  function(req, res){
    res.render('login.njk');
  });

app.post('/login',
  passport.authenticate('local', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/');
  });

app.get('/logout',
  function(req, res){
    req.logout();
    res.redirect('/');
  });

app.get('/profile',
  require('connect-ensure-login').ensureLoggedIn(),
  function(req, res){
    res.render('profile.njk', { user: req.user });
  });


var server;
let port = 4002;
if (process.argv[2] === 'local') {
    server = http.createServer(app);
    console.log(`Running http on port: ${port}`);
}
else {
    server = https.createServer(credentials, app);
    console.log(`Running https on port: ${port}`);
}

server.listen(port);
