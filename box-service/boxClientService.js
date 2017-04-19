'use strict';
const config = require('config');
const Box = require('box-node-sdk');
const BoxSDKConfig = config.get('BoxSDKConfig');
const BoxOptions = config.get('BoxOptions');
const BoxUtilityServices = require('./boxUtilityServices');
const BoxCache = require('./boxTokenCache');
const _ = require('lodash');
const Promise = require('bluebird');
const asyncFunc = Promise.coroutine;
const BoxAutoPageUtilities = require('./util/autopageAsync');
const BoxRecursiveUtilities = require('./util/recurseAsync');

const BOX_ENTERPRISE = "enterprise";
const BOX_USER = "user";

class BoxClientService {
	constructor() {
		this.BoxSdk = new Box({
			clientID: BoxSDKConfig.boxClientId,
			clientSecret: BoxSDKConfig.boxClientSecret,
			appAuth: {
				keyID: BoxSDKConfig.boxPublicKeyId,
				privateKey: BoxSDKConfig.boxPrivateKey(BoxSDKConfig.boxPrivateKeyFileName),
				passphrase: BoxSDKConfig.boxPrivateKeyPassword
			}
		});
		this.BoxCache = BoxCache;
	}

	createAppUser(displayName) {
		let self = this;
		return asyncFunc(function* () {
			let client = yield self.getServiceAccountClient();
			return client.enterprise.addUserAsync(null, displayName, { is_platform_access_only: true });
		})();
	}

	getLongRunningServiceAccountClient() {
		return BoxUtilityServices.promisifyClient(this.BoxSdk.getAppAuthClient(BOX_ENTERPRISE, BoxSDKConfig.boxEnterpriseId));
	}

	getLongRunningUserAccountClient(boxId) {
		return BoxUtilityServices.promisifyClient(this.BoxSdk.getAppAuthClient(BOX_USER, boxId));
	}

	getServiceAccountClient() {
		let self = this;
		return asyncFunc(function* () {
			let token = yield self.generateEnterpriseToken();
			return BoxUtilityServices.promisifyClient(self.BoxSdk.getBasicClient(token.accessToken));
		})();
	}

	getUserClient(boxId) {
		let self = this;
		return asyncFunc(function* () {
			let token = yield self.generateUserToken(boxId);
			return BoxUtilityServices.promisifyClient(self.BoxSdk.getBasicClient(token.accessToken));
		})();
	}

	autoPageWithOffsetUsingServiceAccount(manager, methodName, id, options) {
		return BoxAutoPageUtilities.autoPageWithOffsetAsync(this.getLongRunningServiceAccountClient(), manager, methodName, id, options);
	}

	autoPageWithMarkerUsingServiceAccount(manager, methodName, id, options) {
		return BoxAutoPageUtilities.autoPageWithMarkerAsync(this.getLongRunningServiceAccountClient(), manager, methodName, id, options);
	}

	autoPageWithStreamUsingServiceAccount(manager, methodName, id, options) {
		return BoxAutoPageUtilities.autoPageWithStreamAsync(this.getLongRunningServiceAccountClient(), manager, methodName, id, options);
	}

	autoPageWithOffsetUsingUserAccount(boxId, manager, methodName, id, options) {
		return BoxAutoPageUtilities.autoPageWithOffsetAsync(this.getLongRunningUserAccountClient(boxId), manager, methodName, id, options);
	}

	autoPageWithMarkerUsingUserAccount(boxId, manager, methodName, id, options) {
		return BoxAutoPageUtilities.autoPageWithMarkerAsync(this.getLongRunningUserAccountClient(boxId), manager, methodName, id, options);
	}

	autoPageWithStreamUsingUserAccount(boxId, manager, methodName, id, options) {
		return BoxAutoPageUtilities.autoPageWithStreamAsync(this.getLongRunningUserAccountClient(boxId), manager, methodName, id, options);
	}

	getAllItemsWithinFolderUsingServiceAccount(id) {
		return BoxRecursiveUtilities.getAllItemsAsync(this.getLongRunningServiceAccountClient(), id);
	}

	getFullFolderTreeUsingServiceAccount(id) {
		return BoxRecursiveUtilities.getFolderTreeAsync(this.getLongRunningServiceAccountClient(), id);
	}

	getAllItemsWithinFolderUsingUserAccount(boxId, id) {
		return BoxRecursiveUtilities.getAllItemsAsync(this.getLongRunningUserAccountClient(boxId), id);
	}

	getFullFolderTreeUsingUserAccount(boxId, id) {
		return BoxRecursiveUtilities.getFolderTreeAsync(this.getLongRunningUserAccountClient(boxId), id);
	}

	generateEnterpriseToken() {
		let self = this;
		let key = this.BoxCache.cacheKeyPrefixEnterpriseToken;
		return asyncFunc(function* () {
			let enterpriseToken = yield self.BoxCache.getBoxToken(key);
			if (enterpriseToken && enterpriseToken[BoxOptions.expiresAtFieldName] && enterpriseToken[BoxOptions.expiresAtFieldName] > Date.now()) {
				return enterpriseToken;
			} else {
				return new Promise((resolve, reject) => {
					self.BoxSdk.getEnterpriseAppAuthTokens(BoxSDKConfig.boxEnterpriseId, asyncFunc(function* (err, enterpriseToken) {
						if (err) { reject(err); }
						enterpriseToken = createExpiresAtProp(enterpriseToken);
						let expiryTimeInSeconds = getExpirationTimeForCache(enterpriseToken);
						yield self.BoxCache.setBoxToken(key, enterpriseToken, expiryTimeInSeconds);
						resolve(enterpriseToken);
					}));
				});
			}
		})();
	}

	generateUserToken(boxId) {
		let self = this;
		let key = `${this.BoxCache.cacheKeyPrefixUserToken}|${boxId}`;
		return asyncFunc(function* () {
			let accessTokenFromStorage = yield self.BoxCache.getBoxToken(key);
			if (accessTokenFromStorage && accessTokenFromStorage[BoxOptions.expiresAtFieldName] && accessTokenFromStorage[BoxOptions.expiresAtFieldName] > Date.now()) {
				return accessTokenFromStorage;
			} else {
				return new Promise((resolve, reject) => {
					self.BoxSdk.getAppUserTokens(boxId, asyncFunc(function* (err, accessTokenInfo) {
						if (err) { reject(err); }
						accessTokenInfo = createExpiresAtProp(accessTokenInfo);
						let expiryTimeInSeconds = getExpirationTimeForCache(accessTokenInfo);
						yield BoxCache.setBoxToken(key, accessTokenInfo, expiryTimeInSeconds);
						resolve(accessTokenInfo);
					}));
				});
			}
		})();
	}
}

function createExpiresAtProp(accessTokenInfo) {
	if (accessTokenInfo && (accessTokenInfo.expires_in || accessTokenInfo.accessTokenTTLMS)) {
		accessTokenInfo[BoxOptions.expiresAtFieldName] = (accessTokenInfo.expires_in) ? Date.now() + (accessTokenInfo.expires_in * 1000) : Date.now() + accessTokenInfo.accessTokenTTLMS;
	}
	return accessTokenInfo;
}

function getExpirationTimeForCache(accessTokenInfo) {
	return Math.ceil((new Date(accessTokenInfo[BoxOptions.expiresAtFieldName]) - (Date.now() - 420000)) / 1000);
}

module.exports = new BoxClientService();