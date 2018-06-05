var express = require('express');
var router = express.Router();
var mongoose = require("mongoose");
var User = mongoose.model("User");
var helper = require("../utils");
var hat = require("hat");
var Dataset = mongoose.model("Dataset");

// GET request to push data to dataset
router.get("/update", function(req,res){
	//GET values from the req arg
	var apiKey = req.query.key;
	delete req.query.key;	//Flush the API key value so we only keep values concerning variables

	var values = [];
	var updateQuery = {};

	//find dataset by writeAPI key
	//send status code for each case: -1 if error, 0 if no dataset found and 1 if update successful
	Dataset.findOne({write_key: apiKey}, function(err,dataset){
		if(err){
			console.log("Error retrieving dataset: " + err);
			res.sendStatus(-1);
		} else if(dataset.data){
				//Build $push query with variables passed in POST request
				//We check that the varibale have already been registered otherwise they'll be ignored
				for ( var property in req.query){
					if(req.query.hasOwnProperty(property)&dataset.data.hasOwnProperty(property)){
						updateQuery["data."+property+".values"] = [parseInt(req.query[property]), Date.now()];
					}
				}

				// Update dataset with new values and increment entries_number
				dataset.update({$push: updateQuery,
						$inc: { entries_number: 1},
						last_entry_at: Date.now()}, function(err, datasetID){
							if(err){
								console.log("Error updating dataset: "+ err);
								res.sendStatus(-1);
							} else {
								console.log("New entry for dataset with API key:" + apiKey);
								res.sendStatus(1);
							}
						});
			} else {
				console.log("Either no dataset was found for this API key: "+ apiKey + "or the dataset doesn't have any variables set");
				res.sendStatus(0);
			}

	});

});


//GET request to get Data
router.get("/request", function(req,res){
		var apiKey = req.query.key;

		//Find the dataset by read API key
		Dataset.findOne({read_key:apiKey}, function(err, dataset){
			if(err){
				console.log("Error retrieving dataset: " + err);
				res.sendStatus(-1);
			} else if (dataset) {
				//Strip dataset from sensible informations (_id and API keys)
				var cleanDataset = {
							owner_name: dataset.owner_name,
							name: dataset.name,
							index: dataset.index,
							public: dataset.public,
							created_at: dataset.created_at,
							last_entry_at: dataset.last_entry_at,
							entries_number: dataset.entries_number,
							data: dataset.data
						};
				//Return dataset as JSON
				res.json(cleanDataset);
			} else {
				console.log("No dataset found for this API key: " + apiKey);
				res.sendStatus(0);
			}

		});
});

//GET new dataset page
router.get("/new",helper.authenticate, function(req,res){
	res.render("datasets/new");
});

//GET edit dataset Page
router.get("/:index/edit", helper.autheticate, function(req,res){
	var index = req.params.index;

	//Find dataset by index
	Dataset.findOne({index: index}, function(err,dataset){
		res.render("datasets/edit", {"dataset":dataset});
	});

});

//GET show dataset page
router.get("/:index", function(req,res){
		var index = req.params.index;

		//Find dataset by index
		Dataset.findOne({index: index}, function(err,dataset){
			if(err){
				req.session.error = "Error retireving the dataset";
				res.redirect("/index");
			} else {
				var cleanDataset = {
							name: dataset.name,
							created_at: dataset.create_at,
							last_entry_at: dataset.last_entry_at,
							entries_number: dataset.entries_number,
							data: dataset.data
						};
				//Check if the dataset id Public or not
				//If it is, no need for auth middleware. If not, check auth
				if(!dataset.public)
				{
					helper.authenticate(req,res, function(){
						res.render("datasets/show",{dataset: cleanDataset});
					});
				} else {
					res.render("datasets/show", {dataset:cleanDataset});
				}
			}

		});
});

//POST request to update the API keys
router.post("/udpate/key", helper.autheticate, function(req,res){
		var redirectUrl = req.headers.referer; // used to redirect to dataset edit page

		//GET values from the POST request
		var id = req.body.id;
		var key = req.body.key;

		var updateJson = {};
		updateJson[key+"_key"] = hat(); //Generate a new UPI

		// Find dataset by ID
		Dataset.findById(id, function(err,datasetID){
			if(err){
				console.log("Error retrieving dataset: "+ err);
				req.session.error = "A problem occured finding the dataset");
				res.redirect(redirectUrl);
			} else{
				// Update dataset with new key
				dataset.update(updateJson, function(err, datasetID){
					if(err){
						console.log("Error updating dataset: " + err);
						req.session.error = "A problem occured updating the dataset");
						res.redirect(redirectUrl);
					} else {
						console.log("API key updated: "+ key);
						res.redirect(redirectUrl);
					}
				});
			}
		});


});


router.post('/',helper.authenticate, function(req, res, next) {
	//GET values from POST request
	var name = req.body.name;
	var password = req.body.password;

	//Create new user document
	User.create({
		name: name,
		password: password
	}, function(err,user){
	     if(err){
			console.log("Error creating the new user: " + err);
			res.send("Error in creating user");
	     } else {
			console.log("POST creating new user: " + user);
			res.json(user);
	     }
	})
});

router.get("/:id", helper.authenticate, function(req,res){
	//find user document by id
	User.findById(req.params.id, function(err,user){
		if(err){
			console.log("Error retrieving user"+ err);
			res.send("Error retireving user.");
		} else {
			console.log("GET user with ID: "+ user._id);
			res.json(user);
		}
	});
});

router.put("/:id/edit", helper.authenticate, function(req,res){

	//GET from values
	var newUsername = req.body.newUsername;
	var newPassword = req.body.newPassword;
	var newPasswordBis = req.body.newPasswordConfirm;

	var passError = null;

	//Check if password and confirmation match
	if(newPassword || newPasswordBis){
		if(newPassword!=newPasswordBis){
			newPassword = null;
			passError = true;
			req.session.error = "The passwords do not match, try again.";
			res.redirect("/settings");
		}
	}

	if(!passError)
	{
		User.findById(req.params.id, function(err,user){
			if(err){
				console.log("Error retrieving user "+err);
				req.session.error = "A problem occured retrieving the user";
				req.redirect("/settings");
			} else {
				//Check what to update
				if(user.name!=newUsername) user.name = newUsername;
				if(newPassword) user.password = newPassword;

				//Save is used instead of update so that the hashin middleware is called on the password
				user.save(user, function(err, userID){
					if(err){
						console.log("error updating user: "+ err);
						req.session.error = "A problem occured updating the user.";
						res.redirect("/settings");
					} else {
						console.log("UPDATE user with ID: "+userID);

						//Regenerate session with new user info
						req.session.regenerate(function(){
										req.session.user = user;
										req.session.success = "Update successfully";
										res.redirect("/index");
						});
					}
				});
			}
		});
	}
});

router.delete("/:id", helper.authenticate, function(req,res){
	//Find user document by id
	User.findById(req.params.id, function(err,user){
		if(err){
			console.log("Error in retrieving user "+err);
			req.session.error = "A problem occured retrieving the user";
			res.redirect("/settings");
		} else {
			//Remove user document
			user.document( function(err, user){
					if(err) {
						console.log("Error deleting the user "+ err);
						req.session.error = "A problem occured deleting the user";
						res.redirect("/settings");
					} else {
						console.log("DELETE user with ID: " +  user._id);
						req.session.regenerate( function(){
								req.session.success = "Account successfully deleted.";
								res.redirect("/setup");
						});
					}
			});
		}
	});
});

//POST new Dataset request
router.post("/", helper.authenticate, function(req,res){
	//To set the Dataset ownner
	var sessionUser = req.session.user.name;

	//GET values from the post request
	var name = req.body.name;
	var isPublic = req.body.public != undefined ? true:false;

	delete req.body.name;
	delete req.body.public;

	//This is so that we can loop through the object in reverse order
	//We do that so that the fields are saved in the right order on the DB
	// ( this way it will appear in the right order on the 'edit' view)
	var propertiesList = [];
	for (var property in req.body){
		if(req.body.hasOwnProperty(property)){
			propertiesList.push(property);
		}
	}
	propertiesList.reverse();

	var variablesFields = {};
	for ( var i in propertiesList){
		console.log(propertiesList[i]);
		variablesFields[propertiesList[i]] = {
							name: req.body[propertiesList[i]],
							values: Array
						     };
	}

	//Create dataset
	Dataset.create({
			index: helper.uniqueIndex(),
			name: name,
			owner_name: sessionUser,
			read_key: hat(),
			write_key: hat(),
			public: isPublic,
			data: variablesFields
	}, function(err, dataset){
			if(err){
				console.log("Error creating the dataset: " + err);
				req.session.error = "A problem occured when creating the dataset. Please try again.";
			} else {
				console.log("New dataset created with id: " + dataset._id);
				req.session.success = "Dataset " + name + " created successfully";
			}
			res.redirect("/index");
	});
});

//PUT request to update the dataset
router.put("/:id/", function(req,res){
	//GET values from the POST request
	var name = req.body.name;
	var isPublic = req.body.public!=undefined?true:false;

	//Delete the values from the request body so that we only keep information about the variables
	delete req.body.name;
	delete req.body.public;

	var setList = {};
	var unsetList = {};
	var updateQuery = {};

	// FIND dataset by id
	Dataset.findById(req.params.id, function(err,dataset){
		updateQuery = {
			name: name,
			public: isPublic
		}

		//If varibale in request body and not in dataset, add to setList ( or if no varibale at all in dataset)
		for ( var property in req.body){
			if(!dataset.data||(req.body.hasOwnProperty(property)&!dataset.data.hasOwnProperty(property))){
				console.log(property);
				console.log(req.body[property]);
				setList["data."+property] = {
								name: req.body[property],
								values: Array};
			}
		}

		//If variable in dataset but not in request body, add to unsetList
		for( var property in dataset.data){
			if(dataset.data && dataset.data.hasOwnProperty(property)&!req.body.hasOwnProperty(property)){
				unsetList["data."+property]  = true;
			}
		}

		//If setList or unsetList non-empty, add to updateQuery
		if( Object.keys(setList).length){
			updateQuery[$set"] = setList;
		}
		if( Object.keys(unsetList).length){
			updateQuery["$unset"] = unsetList;
		}

		//Update the Dataset
		dataset.update(updateQuery, function(err,datasetID){
			if(err)
			{
				console.log("Error updating the dataset: "+ err);
				req.session.error = "Update failed, please try again.";
			} else {
				console.log("Update on dataset: " + datasetID);
				req.session.success = "Update successful";
			}
			res.redirect("/index");

		});
	});
});


router.delete("/:id/",helper.authenticate, function(req,res){
	//Find the dataset by id
	Dataset.findById(req.params.id, function(err,dataset){
		if(err)
		{
			console.log("Error retrieving the dataset: "+ err);
			req.session.error = "A problem occured retrieving the dataset";
			req.location("index");
			res.redirect("/index");
		}else{
			dataset.remove(function(err,dataset){
				if(err)
				{
					console.log("Error in Deleting dataset: "+ err);
					req.session.error("A problem occured deleting the dataset. Please try again");
				} else{
					console.log("Deleted dataset with id: " + dataset._id);
					req.session.success = "Successfully deleted dataset" + dataset.name;
				}
				res.redirect("/index");
			});

		}

	});

});

module.exports = router;
