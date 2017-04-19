'use strict';
const Template = require('./template');

class UserTemplate extends Template {
  constructor(baseTemplate, templateKeys, user) {
    super(baseTemplate, templateKeys, user.parentFolderId);
    this.user = user;
  }
}

module.exports = UserTemplate;