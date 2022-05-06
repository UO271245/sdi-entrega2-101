const {MongoClient} = require("mongodb");
const url = 'mongodb+srv://sdi2022101:Pa$$1234@sdi-node-101.axwk6.mongodb.net/myFirstDatabase?retryWrites=true&w=majority';

let createError = require('http-errors');
let express = require('express');
let path = require('path');
let cookieParser = require('cookie-parser');
let logger = require('morgan');

let indexRouter = require('./routes/index');
let usersRouter = require('./routes/users');
let publicationsRouter = require('./routes/publications');

let app = express();

let rest = require('request');
app.set('rest', rest);

let jwt = require('jsonwebtoken');
app.set('jwt', jwt);

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Methods", "POST, GET, DELETE, UPDATE, PUT");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, token");
// Debemos especificar todas las headers que se aceptan. Content-Type , token
  next();
});


let expressSession = require('express-session');
app.use(expressSession({
  secret: 'abcdefg',
  resave: true,
  saveUninitialized: true
}));

let crypto = require('crypto');

let fileUpload = require('express-fileupload');
app.use(fileUpload({
  limits: {fileSize: 50 * 1024 * 1024},
  createParentPath: true
}));


app.set('uploadPath', __dirname)
app.set('clave', 'abcdefg');
app.set('crypto', crypto);
app.set('connectionStrings', url);

let bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

const usersRepository = require("./repositories/usersRepository.js");
usersRepository.init(app, MongoClient);



require("./routes/users.js")(app, usersRepository);

const amistadesRepository = require("./repositories/amistadesRepository.js");
amistadesRepository.init(app, MongoClient);
require("./routes/friends.js")(app, amistadesRepository,usersRepository);

const publicationsRepository = require("./repositories/publicationsRepository.js");
publicationsRepository.init(app, MongoClient);
require("./routes/publications.js")(app, publicationsRepository);


const userSessionRouter = require('./routes/userSessionRouter');

app.use("/friends", userSessionRouter);
app.use("/publications/add", userSessionRouter);
app.use("/publications", userSessionRouter);


const userTokenRouter = require('./routes/userTokenRouter');
app.use("/api/v1.0/", userTokenRouter);


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'twig');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/publications', publicationsRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
