'use strict';
const _ = require('lodash');
const Promise = require('bluebird');

const BOX_MANAGERS = [
	"users",
	"files",
	"folders",
	"comments",
	"collaborations",
	"groups",
	"sharedItems",
	"metadata",
	"collections",
	"events",
	"search",
	"tasks",
	"trash",
	"enterprise",
	"legalHoldPolicies",
	"weblinks",
	"retentionPolicies",
	"devicePins",
	"webhooks"
]

class BoxUtilityServices {
	static promisifyClient(client) {
		_.each(BOX_MANAGERS, (manager) => {
			Promise.promisifyAll(client[manager]);
		});
		return client;
	}

	static errorHandler(err) {
	}
}

module.exports = BoxUtilityServices;