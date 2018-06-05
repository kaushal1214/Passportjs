var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var mongoose = require('mongoose');
var session = require("express-session");
var MongoStore = require("connect-mongo")(session);

mongoose.connect("mongodb://localhost/iothb", function(err){
	if(err) throw err;
	console.log("Successfully connected to Mongodb");
});


//  Loading routes
var routes =   require("./routes/index");
    users =    require("./routes/users"),
    datasets = require("./routes/datasets");

//Loading DB models
var user = require("./models/users"),
    dataset = require('./models/datasets');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
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


//We use mongodb to stor session info
//expiration of the session is set to 7 days (ttl option)
app.use(session({
	store: new MongoStore(
				{ mongooseConnection: mongoose.connection,
			          ttl: 7*24*60*60
				 }
			     ),
	saveUninitialized: true,
	resave: true,
	secret: "SecretKey"
  }));

//Used to manipulate post requests and recognize PUT and DELETE operations
app.use(methodOverride(function(req,res){
	if(req.body && typeof(req.body) == "object" && "_method" in req.body)
	{
		var method = req.body._method;
		delete req.body._method;
		return method;
	}
}));

// Register routes
app.use("/", routes);
app.use("/users", users);
app.use("/datasets", datasets);


module.exports = app;
