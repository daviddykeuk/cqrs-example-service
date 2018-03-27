// The command service is quite simple:
// It allows users to create accounts, only validation is that they have a first_name, last_name and valid email
// It allows transactions to happen on accounts, whatever happens transactions will not be allowed if it will take the user's balance below zero

// LOAD ENVIRONMENT VARIABLES
require('dotenv').config();

// PREREQUISITES
const Joi = require("joi");
const request = require('request');
const express = require('express');
const uuidv4 = require('uuid/v4');

// CREATING AN ACCOUNT
// ACCOUNT MUST HAVE:
// A FIRST NAME
// A LAST NAME
// A VALID EMAIL ADDRESS
function createAccount(req, res) {

	// get the account from the request body
	var account = req.body;

	// create a schema model
	const schema = Joi.object().keys({
		first_name: Joi.string().alphanum().min(1).max(30).required(),
		last_name: Joi.string().alphanum().min(1).max(30).required(),
		email: Joi.string().email().required()
	});

	// validate the supplied object
	var valid = Joi.validate(account, schema);
	if (valid.error){
		// if not valid, reject
		res.status(400).send(valid.error)
	} else {
		// give the account a new ID
		account.id = uuidv4();
	
		// send the event
		emit("account:created", account.id, 0, account, (err, event) => {
			if (err) {
				res.status(500).send(err);
			} else {
				res.status(201).send(account);
			}
		});
	}

}

// PERFORMING A TRANSACTION
// A TRANSACTION REQUIRES:
// A DESCRIPTION
// AN AMOUNT AS AN INTEGER
// BALANCE MUST NOT FALL BELOW ZERO
// FUNDS CAN BE ADDED IF BALANCE SOMEHOW MAKES IT BELOW ZERO

function performTransaction(req, res) {

	// get details from request
	var account_id = req.params.id;
	var transaction = req.body;

	// create a schema model
	const schema = Joi.object().keys({
		amount: Joi.number().integer().required(),
		description: Joi.string().alphanum().min(1).max(30).required()
	});

	// validate the supplied object
	var valid = Joi.validate(transaction, schema);

	// check everything is supplied
	if (valid.error) {
		res.status(400).send(valid.error);
	} else {
		getBalance(account_id, (err, account) => {
			if (err) {
				res.status(500).send(err);
			} else if (account.version == 0) {
				res.status(404).send("Could not find account");
			} else if (transaction.amount > 0 || account.balance + transaction.amount < 0) {
				res.status(400).send("Not enough funds");
			} else {
				emit("transaction:completed", account_id, account.version, transaction, (err, result) => {
					if (err) {
						res.status(500).send("Could not complete transaction, please try again");
					} else {
						res.status(204).send();
					}
				})
			}
		});
	}
}


// USING THE EVENT-HUB TO GET AN ACCOUNT BALANCE
function getBalance(account_id, next) {
	request(process.env.EVENT_HUB_API_URL + '/entities/' + account_id, {
		json: true
	}, (err, rest, events) => {
		if (err) {
			next(err);
		} else {
			var account = {
				version: 0,
				balance: 0
			}
			events.forEach((e) => {
				account.version = e.version;
				if (e.name == "transaction:completed") {
					account.balance = account.balance + e.payload.amount;
				}
			});
			next(null, account);
		}
	});
}


// COMMITING THE TRANSACTION TO THE EVENT-HUB
function emit(name, entity_id, version, payload, next) {
	var event = {
		name: name,
		entity_id: entity_id,
		version: version,
		payload: payload
	}

	var options = {
		method: 'post',
		body: event,
		json: true,
		url: process.env.EVENT_HUB_API_URL + '/events'
	}

	request(options, next);
}



// SETTING UP THE EXPRESS SERVER
const app = express();
var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({
	extended: false
}));
app.use(bodyParser.json());

// REGISTERING ROUTES
app.post('/accounts', createAccount);
app.put('/accounts/:id', performTransaction);

// STARTING THE SERVER
app.listen(process.env.PORT, () => console.log('Command service listening on port %s', process.env.PORT));