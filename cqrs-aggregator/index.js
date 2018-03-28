// The aggregator service is quite simple:
// It listens to events, builds views of accounts and stores them in REDIS
// On startup it will retrieve all events and rebuild everything on REDIS

// LOAD ENVIRONMENT VARIABLES
require('dotenv').config();

// PREREQUISITES
const request = require('request');
const redis = require('redis');

// CONNECT TO REDIS
var client = redis.createClient({
	host: process.env.REDIS_HOST,
	port: process.env.REDIS_PORT
});

// CONNECT TO THE EVENT STREAM SOCKET
var eventStream = require('socket.io-client')(process.env.EVENT_HUB_SOCKET_URL);
eventStream.on('connect', function () {
	console.log("Connected to event stream at %s", process.env.EVENT_HUB_SOCKET_URL);
});
eventStream.on('disconnect', function () {
	console.log("Disconnected from event stream");
});



// SOME LOGIC:
// PROCESS ACCOUNT CREATIONS
function processEvent(event) {
	return new Promise(function (resolve, reject) {
		switch (event.name) {
			case "account:created":
				var account = {};
				account.id = event.payload.id;
				account.first_name = event.payload.first_name;
				account.last_name = event.payload.last_name;
				account.email = event.payload.email;
				account.created_timestamp = event.timestamp;
				account.balance = 0;
				account.overdraft_limit = 0;
				account.credits = [];
				account.debits = [];
				account.version = event.version;
				client.set(account.id, JSON.stringify(account), () => {
					resolve(event);
				});
				break;
			case "transaction:completed":
				client.get(event.entity_id, (err, account) => {
					if (err) {
						console.log("Failed to get account with id %s", event.entity_id);
						reject();
					} else if (account) {
						account = JSON.parse(account);
						account.balance += event.payload.amount;
						account.version = event.version;
						event.payload.timestamp = event.timestamp;
						if (event.payload.amount > 0) {
							account.credits.push(event.payload);
						} else {
							account.debits.push(event.payload);
						}

						client.set(account.id, JSON.stringify(account), () => {
							resolve(event);
						});

					}
				});
				break;
		}
	});
}

//LISTEN FOR EVENTS
// IF AN account:created EVENT IS HEARD, PROCESS IT
eventStream.on('account:created', function (event) {
	processEvent(event);
});

// IF A transaction:completed EVENT IS HEARD, PROCESS IT
eventStream.on('transaction:completed', function (event) {
	processEvent(event);
});



// GET ALL PREVIOUS EVENTS AND REBUILD THE CURRENT STATE
console.log("Getting all events from the event-hub...");

// MAKE A REQUEST TO THE EVENT HUB API
request(process.env.EVENT_HUB_API_URL + '/events', {
	json: true
}, (err, res, body) => {
	if (err) {
		return console.log(err);
	}
	console.log("%s events retrieved...", body.length);

	// FOR EACH TRANSACTION - THIS HAS TO HAPPEN SEQUENTIALLY
	// USE A BIT OF MAP REDUCE
	body.map(x => () => processEvent(x)).reduce(
		(p, next) => p.then(next),
		Promise.resolve()
	).then(() => {
		console.log("All events processed.");
	});

});