'use strict'
const _ = require('lodash');
const Promise = require('bluebird');
const asyncFunc = Promise.coroutine;
const Template = require('./template');
const UserTemplate = require('./userTemplate');
const TemplateServices = require('./templateServices');
const TemplateProcessor = require('./templateProcessor');

class TemplateEngine {
	constructor(baseTemplate, client, personas = null) {
		this.baseTemplate = baseTemplate;
		this.client = client;
	}

	createUserTemplates(users) {
		let templates = [];
		_.each(users, (user) => {
			if (!user.skipTemplate && user.templateKeys) {
				templates.push(new UserTemplate(this.baseTemplate, user.templateKeys, user));
			}
		});
		return templates;
	}

	createPersonasList(users) {
		let personas = [];
		_.each(users, (user) => {
			if (_.has(user, "persona")) {
				personas.push(_.get(user, "persona"));
			}
		});
		return _.uniq(personas);
	}

	processUserTemplate(template, personas, users) {
		let processor = new TemplateProcessor(this.client, template, personas, users);
		return processor.processTemplate();
	}

	processUsersWithTemplate(users) {
		let userTemplates = this.createUserTemplates(users);
		let personas = this.createPersonasList(users);
		let self = this;
		return asyncFunc(function* () {
			let processing = [];
			for (let i = 0; i < userTemplates.length; i++) {
				processing.push(yield self.processUserTemplate(userTemplates[i], personas, users));
			}
			return yield Promise.all(processing)
		})();
	}

	processFoldersWithTemplate(templateKeys, parentFolderId, includeMetadata = false, includeWebhooks = false) {
		console.log(this.baseTemplate);
		let template = new Template(this.baseTemplate, templateKeys, parentFolderId);
		console.log(template);
		let processor = new TemplateProcessor(this.client, template, null, null, false, false);
		return processor.processTemplate();
	}
}
module.exports = TemplateEngine;