// the command service is quite simple:
// I allow users to create accounts, my only validation is that they have a first_name, last_name, email
// I allow transactions to happen on accounts, whatever happens transactions will not be allowed if it will take the user's balance below zero

require('dotenv').config();

const request = require('request');
const express = require('express');
const uuidv4 = require('uuid/v4');

const app = express();
var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({
	extended: false
}));
app.use(bodyParser.json());

// CREATE ACCOUNTS
function createAccount(req, res){
	var account = req.body;
	
	// check everything is supplied
	if(!account.first_name || !account.last_name || !account.email){
		res.status(400).send("Not a proper account");
	}

	// give the account a new ID
	account.id = uuidv4();

	// send the event
	emit("account:created", account.id, 0, account, (err, event) => {
		if (err){
			res.status(500).send(err);
		} else {
			res.status(201).send(account);
		}
	});	

}


function performTransaction(req, res){
	var account_id = req.params.id;
	var transaction = req.body;
	
	// check everything is supplied
	if(!transaction.description || !transaction.amount || !parseInt(transaction.amount)){
		res.status(400).send("Not a proper transaction");
	} else {
		getBalance(account_id, (err, account) => {
			if (err){
				res.status(500).send(err);
			} else if (account.version == 0){
				res.status(404).send("Could not find account");
			} else if (account.balance + transaction.amount < 0){
				res.status(400).send("Not enough funds");
			} else {
				emit("transaction:completed", account_id, account.version, transaction, (err, result) => {
					if (err){
						res.status(500).send("Could not complete transaction, please try again");
					} else {
						res.status(204).send();
					}
				})
			}
		});
	}
}

function getBalance(account_id, next){
	request(process.env.EVENT_HUB_API_URL + '/entities/' + account_id, { json: true}, (err, rest, events) => {
		if(err){
			next(err);
		} else {
			var account = {
				version: 0,
				balance: 0
			}
			events.forEach((e)=>{
				account.version = e.version;
				if(e.name=="transaction:completed"){
					account.balance = account.balance + e.payload.amount;
				}
			});
			next(null, account);
		}
	});
}

function emit(name, entity_id, version, payload, next){
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

app.post('/accounts', createAccount);
app.put('/accounts/:id', performTransaction);

app.listen(process.env.PORT, () => console.log('Command service listening on port %s', process.env.PORT));