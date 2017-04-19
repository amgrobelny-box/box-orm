'use strict';
const DEFAULT_COLLAB_TYPE = "user";
const Promise = require('bluebird');
const asyncFunc = Promise.coroutine;
const _ = require('lodash');

class TemplateServices {
	static processFolders() {
		console.log("Processing folders...");
	}

	static getDefaultRootFolder() {
		return "0";
	}

	static createFolder(client, name, parentId) {
		return client.folders.createAsync(parentId, name);
	}

	static createCollaboration(client, collab, folderId) {
		collab = TemplateServices.validateCollaboration(collab);
		collab.type = collab.type || DEFAULT_COLLAB_TYPE;
		return client.collaborations.createAsync({ type: collab.type, id: collab.id }, folderId, collab.role)
	}

	static createMetadata(client, metadata, folderId) {
		metadata = TemplateServices.validateMetadata(metadata);
		return client.folders.addMetadataAsync(folderId, metadata.scope, metadata.template, metadata.values);
	}

	static createFolderWebhook(client, webhook, folderId) {
		webhook = TemplateServices.validateFolderWebhook(webhook);
		return client.webhooks.createAsync(folderId, webhook.type, webhook.address, webhook.triggers);
	}

	static validateCollaboration(collab) {
		if (!collab.id) {
			throw new Error("An id field is required on Access objects.");
		}
		if (!collab.role) {
			throw new Error("A role field is required on Access objects.");
		}
		if (!collab.notify) {
			collab.notify = false;
		}
		if (!collab.can_view_path) {
			collab.can_view_path = false;
		}
		return collab;
	}

	static validateMetadata(metadata) {
		if (!metadata.values) {
			throw new Error("No metadata values supplied.");
		}
		if (!metadata.scope) {
			metadata.scope = "global";
		}
		if (!metadata.template) {
			metadata.template = "properties";
		}
		return metadata;
	}

	static validateGroup(group, user) {
		if (!group.id) {
			throw new Error("A group id is required to add a user to a group.");
		}
		if (!user.id) {
			throw new Error("A user id is required to add a user to a group");
		}
		if (!group.role) {
			group.role = "member";
		}
		return group;
	}

	static validateFolderWebhook(webhook) {
		if (!webhook.address) {
			throw new Error("A notification url is required to add a webhook.");
		}
		if (!webhook.triggers && !_.isArray(webhook.triggers)) {
			throw new Error("A triggers array is required to add a webhook.");
		}
		webhook.type = "folder";
		return webhook;
	}

	static cleanUpOnError(foldersToDeleteOnError, client) {
		return asyncFunc(function* () {
			for (let i = 0; i < foldersToDeleteOnError.length; i++) {
				console.log(`Deleting ${foldersToDeleteOnError[i]}...`);
				yield client.folders.deleteAsync(foldersToDeleteOnError[i], { recursive: true });
			}
			return true;
		})();
	}

}

module.exports = TemplateServices;