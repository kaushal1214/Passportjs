var express = require("express"),
	router = express.Router(),
	helper = require("../utils"),
	mongoose = require("mongoose"),
	User = mongoose.model("User"),
	Dataset = mongoose.model("Dataset");

//POST setup reuest
router.post("/setup", function(req,res){
	//GET values from the POST request
	var username = req.body.username;
	var password = req.body.password;

	//Create new user document
	User.create({
			name: username,
			password: password
	}, function(err,user){
				if(err){
					console.log("Error creating the user: "+ err);
					req.session.error = "An error occured creating the user";
					req.location("setup");
					req.redirect("/setup");
				} else {
					console.log("POST creating new user.");
					req.session.regenerate(function(){
								req.session.user = user;
								res.redirect("/index");
					});
				}
	});

});

//POST login request
router.post("/login", function(req,res){
		//GET values from POST request
		var username = req.body.username;
		var password = req.body.password;

		//Find user document by username
		// If a user is returned but the passwords do not match, send error message indicating wrong password
		//If no user is returned, send error message indicating wrong username
		User.findOne({name:username}, function(err,user){
			if(err){
				console.log("Error retrieving user " + err);
				req.session.error = "A problem occured while retireving the user";
				req.redirect("/");
			} else if (user){
				//Use the method registered on the User model to compare entered password with user password
				user.comparePassword(password, function(err, isMatch){
					if(err) throw err;

					if(isMatch){
						req.session.regenerate(function(){
							req.session.user = user;
							req.session.success = "Authenticated as " + user.name;
							res.redirect("/index");
						});
					} else {
						req.session.error = "Authentication failed, please check your password";
						res.redirect("/");
					}
				});
			} else{
				req.session.error = "Authentication failed, Please check username";
				req.redirect("/");
			}
		});
});

router.get("/logout", helper.authenticate, function(req,res){
	var errorMessage = req.session.error;
	var successMessage = req.session.success;

	//Regenerate new session; session.destroy() is not used as we still want 
	//error/success messages to be served to the endpoint
	req.session.regenerate(function(){
			req.session.error = errorMessage;
			req.session.success = successMessage;
			res.redirect("/");
	});
});

//GET landing Page
router.get("/", function(req,res,next){
		var errorMessage = req.session.error;
		var successMessage = req.session.success;

		//Since messages have been served, delete from session
		delete req.session.error;
		delete req.session.success;

		User.count({}, function(err,count){
			//If a user is already registered, redirect to index
			//else render setup view in order to register
			if(count){
				if(req.session.user){
					res.redirect("/login");
				} else{
					res.render("login", { errorMessage: errorMessage,
								successMessage: successMessage});
				}
			}else{
				res.render("setup");
			}

		});

});


//GET setup page
router.get("/setup", function(req,res){
		var errorMessage = req.session.error;
		var successMessage = req.session.success;

		//Since messages have been served, delete from session
		delete req.session.error;
		delete req.session.success;

		res.render("setup", {errorMessage: errorMessage,
					successMessage:successMessage});

});

//GET tje index page
router.get("/index", helper.autheticate, function(req,res,next){
		var sessionUser = req.session.user.name;
		var errorMessage = req.session.error;
		var successMessage = req.session.success;

		//Since messages have been served, delete from session
		delete req.session.error;
		delete req.session.success;

		//find dataset documents owned by the current session user
		Dataset.find({owner_name: sessionUser}, function(err,datasets){
			if(err){
				console.log("error retireving datasets: "+ err);
				errorMessage = "A problem occured retrieving the datasets";
				res.render("index",{datasets:{}, errorMessage: errorMessage});
			} else{
				res.render("index",{datasets:datasets,
							errorMessage: errorMessage,
							successMessage: successMessage});
			}
		});

});

router.get("/settings", helper.authenticate, function(req,res){
		var errorMessage = req.session.error;
		var successMessage = req.session.success;

		//Since messages have been served, delete from session
		delete req.session.error;
		delete req.session.success;

		res.render("settings",{
					user:req.session.user,
					errorMessage:errorMessage,
					successMessage: successMessage});
});


module.exports = router;
