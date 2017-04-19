'use strict';
const _ = require('lodash');
const uuid = require('uuid');
const TemplateServices = require('./templateServices');

class Template {
	constructor(baseTemplate, templateKeys, parentFolderId) {
		this.templateKeys = templateKeys;
		this.folderChecklist = [];
		this.template = this._compileTemplate(_.cloneDeep(baseTemplate), templateKeys);
		this.parentFolderId = parentFolderId || TemplateServices.getDefaultRootFolder();
	}

	_compileTemplate(folderTemplate, templateKeys) {
		if (folderTemplate.name) {
			let compiledName = _.template(folderTemplate.name);
			folderTemplate.name = compiledName(templateKeys);
			folderTemplate.uuid = uuid.v4();
			this.folderChecklist.push(folderTemplate.uuid);
		}
		if (folderTemplate.children && folderTemplate.children.length > 0) {
			_.each(folderTemplate.children, (child) => {
				this._compileTemplate(child, templateKeys);
			});
		} else if (folderTemplate.folders && folderTemplate.folders.length > 0) {
			_.each(folderTemplate.folders, (child) => {
				this._compileTemplate(child, templateKeys);
			});
		}
		return folderTemplate;
	}
}
module.exports = Template;