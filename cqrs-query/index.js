require('dotenv').config();

const express = require('express')
const app = express();

var eventStream = require('socket.io-client')(process.env.EVENT_HUB_SOCKET_URL);
eventStream.on('connect', function () {
	console.log("Connected to event stream at %s", process.env.EVENT_HUB_SOCKET_URL);
});

eventStream.on('disconnect', function () {
	console.log("Disconnected from event stream");
});

var accounts = [];
var easyAccounts = {};

app.get('/accounts', (req, res) => {
	res.send(accounts);
});

app.get('/accounts/:id', (req, res) => {
	var account = easyAccounts[req.params.id];
	if (account) {
		res.send(account);
	} else {
		res.status(404).send("Account not found");
	}
});


eventStream.on('account:created', function (data) {
	processCreation(data);
});


eventStream.on('transaction:completed', function (data) {
	processTransaction(data);
});

function processCreation(data) {
	var account = {};
	account.id = data.payload.id;
	account.first_name = data.payload.first_name;
	account.last_name = data.payload.last_name;
	account.email = data.payload.email;
	account.created_timestamp = data.timestamp;
	account.balance = 0;
	account.credits = [];
	account.debits = [];
	account.version = data.version;

	accounts.push(account);
	easyAccounts[account.id] = account;
}

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

// get current events - this happens on startup
console.log("Getting all events from the event-hub...");
const request = require('request');

request(process.env.EVENT_HUB_API_URL+ '/events', {
	json: true
}, (err, res, body) => {
	if (err) {
		return console.log(err);
	}
	console.log("%s events retrieved...", body.length);
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

	// when we're done, open up the API
	app.listen(process.env.PORT, () => console.log('API listening on port %s', process.env.PORT));
});