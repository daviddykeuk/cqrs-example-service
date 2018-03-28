// The command service is super simple:
// It retrieves current account state from redis

// LOAD ENVIRONMENT VARIABLES
require('dotenv').config();

// PREREQUISITES
const redis = require('redis');
const express = require('express');
const app = express();

// CONNECT TO REDIS
var client = redis.createClient({
	host: process.env.REDIS_HOST,
	port: process.env.REDIS_PORT
});


// GETTING A SINGLE ACCOUNT
// RETURN THE ACCOUNT USING REDIS
app.get('/accounts/:id', (req, res) => {
	client.get(req.params.id, (err, account) => {
		if (err){
			res.status(404).send("Account not found");
		} else {
			res.send(JSON.parse(account));
		}
	});
});


// START THE API SERVER 
app.listen(process.env.PORT, () => console.log('API listening on port %s', process.env.PORT));