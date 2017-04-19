'use strict';
const _ = require('lodash');
const TemplateServices = require('./templateServices');
const Promise = require('bluebird');
const asyncFunc = Promise.coroutine;

class TemplateProcessor {
	constructor(client, template, personas, users, includeAccessControl = true, includeMetadata = true, includeFolderWebhooks = true) {
		this.client = client;
		this.folderStructure = template.template;
		this.checklist = template.folderChecklist;
		this.users = users;
		this.user = template.user;
		this.personas = personas;
		this.parentFolderId = template.parentFolderId;
		this.childFolders = [];
		this.foldersToDeleteOnError = [];
		this.folders = [];
		this.collaborations = [];
		this.metadata = [];
		this.groups = [];
		this.webhooks = [];
		this.finishedProcess = {};
		this.includeAccessControl = includeAccessControl;
		this.includeMetadata = includeMetadata;
		this.includeFolderWebhooks = includeFolderWebhooks;
	}

	processTemplate() {
		let self = this;
		return asyncFunc(function* () {
			yield self.processFolders();
			self.addUsersToGroups();
			return {
				folders: self.folders,
				metadata: yield Promise.all(self.metadata),
				collaborations: yield Promise.all(self.collaborations),
				groups: yield Promise.all(self.groups),
				webhooks: yield Promise.all(self.webhooks)
			};
		})()
			.catch(asyncFunc(function* (err) {
				console.log("Intercepted error");
				let ranDelete = yield TemplateServices.cleanUpOnError(self.foldersToDeleteOnError, self.client);
				if (ranDelete) {
					console.log("Finished cleanup...");
				}
				throw err;
			}));
	}

	processFolders() {
		let self = this;
		return asyncFunc(function* () {
			let createdFolder = yield TemplateServices.createFolder(self.client, self.folderStructure.name, self.parentFolderId);
			self.foldersToDeleteOnError.push(createdFolder.id);
			self.processCreatedFolder(self.folderStructure, createdFolder);
			yield self.buildNextFolders(self.folderStructure, createdFolder.id);
		})();
	}

	processCreatedFolder(folderStructure, createdFolder) {
		_.pull(this.checklist, folderStructure.uuid);
		this.folders.push(createdFolder);
		if (this.includeAccessControl) {
			this.processAccessControl(folderStructure, createdFolder.id);
		}
		if (this.includeMetadata) {
			this.processMetadata(folderStructure, createdFolder.id);
		}
		if (this.includeFolderWebhooks) {
			this.processFolderWebhooks(folderStructure, createdFolder.id);
		}
	}

	processChildFolders(parentId, children) {
		let self = this;
		return asyncFunc(function* () {
			let processEachFolderPromise = [];
			for (let i = 0; i < children.length; i++) {
				let createdFolder = yield TemplateServices.createFolder(self.client, children[i].name, parentId);
				children[i].id = createdFolder.id;
				processEachFolderPromise.push(self.processCreatedFolder(children[i], createdFolder));
			}
			yield Promise.all(processEachFolderPromise);
		})();
	}

	buildNextFolders(folderStructure, createdFolderId) {
		let self = this;
		return asyncFunc(function* () {
			if (folderStructure.children && folderStructure.children.length > 0) {
				yield self.processChildFolders(createdFolderId, folderStructure.children);
			} else if (folderStructure.folders && folderStructure.folders.length > 0) {
				yield self.processChildFolders(createdFolderId, folderStructure.folders);
			}
			if (self.checklist.length > 0) {
				let buildNextFoldersPromise = [];
				if (folderStructure.children && folderStructure.children.length > 0) {
					for (let i = 0; i < folderStructure.children.length; i++) {
						buildNextFoldersPromise.push(self.buildNextFolders(folderStructure.children[i], folderStructure.children[i].id));
					}
				} else if (folderStructure.folders && folderStructure.folders.length > 0) {
					for (let i = 0; i < folderStructure.folders.length; i++) {
						buildNextFoldersPromise.push(self.buildNextFolders(folderStructure.folders[i], folderStructure.folders[i].id));
					}
				}
				yield Promise.all(buildNextFoldersPromise);
			}
		})();
	}

	processAccessControl(currentFolder, folderId) {
		let self = this;
		return asyncFunc(function* () {
			if (currentFolder && currentFolder.access && currentFolder.access.length > 0) {
				let processAccessControlPromises = [];
				for (let i = 0; i < currentFolder.access.length; i++) {
					let userIds;
					userIds = self.searchForAccessControlPersona(currentFolder.access[i]);
					if (userIds && userIds.length > 0) {
						processAccessControlPromises.push(self.processAccessControlForPersona(userIds, currentFolder.access[i], folderId, self.user));
					} else if (_.first(/[0-9]*/.exec(currentFolder.access[i].id)).length > 0) {
						self.collaborations.push(TemplateServices.createCollaboration(self.client, currentFolder.access[i], folderId));
					} else {
						console.log("Couldn't resolve a match for this user...");
					}
				}
				if (processAccessControlPromises.length > 0) {
					yield Promise.all(processAccessControlPromises);
				}
			}
		})();
	}

	searchForAccessControlPersona(collaboration) {
		if (_.includes(this.personas, collaboration.id)) {
			return _.filter(this.users, (user) => {
				return user.persona === collaboration.id;
			});
		}
	}

	processAccessControlForPersona(identities, collaboration, folderId, user) {
		for (let i = 0; i < identities.length; i++) {
			if (!(identities[i].excludeFrom && _.includes(identities[i].excludeFrom, user.id))) {
				collaboration.id = identities[i].id;
				this.collaborations.push(TemplateServices.createCollaboration(this.client, collaboration, folderId));
			}
		}
	}


	processMetadata(currentFolder, folderId) {
		if (currentFolder && currentFolder.metadata && currentFolder.metadata.length > 0) {
			for (let i = 0; i < currentFolder.metadata.length; i++) {
				this.metadata.push(TemplateServices.createMetadata(this.client, currentFolder.metadata[i], folderId));
			}
		}
	}

	processFolderWebhooks(currentFolder, folderId) {
		if (currentFolder && currentFolder.webhooks && currentFolder.webhooks.length > 0) {
			for (let i = 0; i < currentFolder.webhooks.length; i++) {
				this.webhooks.push(TemplateServices.createFolderWebhook(this.client, currentFolder.webhooks[i], folderId));
			}
		}
	}

	addUsersToGroups() {
		if (this.user && this.user.addToGroups && this.user.addToGroups.length > 0) {
			for (let j = 0; j < this.user.addToGroups.length; j++) {
				let groupData = this.user.addToGroups[j];
				groupData = TemplateServices.validateGroup(groupData, this.user);
				this.groups.push(this.client.groups.addUserAsync(groupData.id, this.user.id, { role: groupData.role })
					.catch((e) => {
						if (e.response.body.code === 'conflict') {
							let handle = {};
							handle[this.user.id] = e.response.body.message
							return handle;
						} else {
							throw e;
						}
					})
				);
			}
		}
	}
}

module.exports = TemplateProcessor;