'use strict';
const DEFAULT_COLLAB_TYPE = "user";
const Promise = require('bluebird');
const asyncFunc = Promise.coroutine;
const _ = require('lodash');

class ScaffoldingServices {
  static createAppUser(client, displayName) {
    return client.enterprise.addUserAsync(null, displayName, { is_platform_access_only: true });
  }

  static createManagedUser(client, login, displayName, options = {}) {
    return client.enterprise.addUserAsync(login, displayName, options);
  }

  static createGroup(client, name, options = {}) {
    return client.groups.createAsync(name, options);
  }
}