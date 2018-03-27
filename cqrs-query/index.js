
// The command service is quite simple:
// It allows users to create accounts, only validation is that they have a first_name, last_name and valid email
// It allows transactions to happen on accounts, whatever happens transactions will not be allowed if it will take the user's balance below zero

// LOAD ENVIRONMENT VARIABLES
require('dotenv').config();

// PREREQUISITES
const request = require('request');
const express = require('express');
const app = express();

// CONNECT TO THE EVENT STREAM SOCKET
var eventStream = require('socket.io-client')(process.env.EVENT_HUB_SOCKET_URL);
eventStream.on('connect', function () {
	console.log("Connected to event stream at %s", process.env.EVENT_HUB_SOCKET_URL);
});
eventStream.on('disconnect', function () {
	console.log("Disconnected from event stream");
});

// SET UP SOME VARIABLES
var accounts = [];
var easyAccounts = {};

// GETTING A LIST OF ALL ACCOUNTS
// SEND BACK THE accounts ARRAY
app.get('/accounts', (req, res) => {
	res.send(accounts);
});

// GETTING A SINGLE ACCOUNT
// RETURN THE ACCOUNT USING THE easyAccounts OBJECT AND account_id KEY
app.get('/accounts/:id', (req, res) => {
	var account = easyAccounts[req.params.id];
	if (account) {
		res.send(account);
	} else {
		res.status(404).send("Account not found");
	}
});

// IF AN account:created EVENT IS HEARD, PROCESS IT
eventStream.on('account:created', function (data) {
	processCreation(data);
});

// IF A transaction:completed EVENT IS HEARD, PROCESS IT
eventStream.on('transaction:completed', function (data) {
	processTransaction(data);
});

// PROCESS ACCOUNT CREATIONS
function processCreation(data) {
	var account = {};
	account.id = data.payload.id;
	account.first_name = data.payload.first_name;
	account.last_name = data.payload.last_name;
	account.email = data.payload.email;
	account.created_timestamp = data.timestamp;
	account.balance = 0;
	account.overdraft_limit = 0;
	account.credits = [];
	account.debits = [];
	account.version = data.version;

	accounts.push(account);
	easyAccounts[account.id] = account;
}

// PROCESS TRANSACTIONS
function processTransaction(data) {
	var account;

	accounts.forEach((acc) => {
		if (acc.id == data.entity_id) {
			account = acc;
		}
	});

	if (account) {
		account.balance += data.payload.amount;
		account.version = data.version;
		data.payload.timestamp = data.timestamp;
		if (data.payload.amount > 0) {
			account.credits.push(data.payload);
		} else {
			account.debits.push(data.payload);
		}

		easyAccounts[account.id] = account;
	}
}

// GET ALL PREVIOUS EVENTS AND REBUILD THE CURRENT STATE
console.log("Getting all events from the event-hub...");

// MAKE A REQUEST TO THE EVENT HUB API
request(process.env.EVENT_HUB_API_URL+ '/events', {
	json: true
}, (err, res, body) => {
	if (err) {
		return console.log(err);
	}
	console.log("%s events retrieved...", body.length);

	// FOR EACH TRANSACTION
	body.forEach((e) => {
		switch (e.name) {
			case "account:created":
				processCreation(e);
				break;
			case "transaction:completed":
				processTransaction(e);
				break;
		}
	});

	console.log("All events processed.");

	// START THE API SERVER AFTER PROCESSING ALL THE TRANSACTIONS
	app.listen(process.env.PORT, () => console.log('API listening on port %s', process.env.PORT));
});