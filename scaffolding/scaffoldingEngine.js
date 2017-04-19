'use strict'
const _ = require('lodash');
const Promise = require('bluebird');
const asyncFunc = Promise.coroutine;
const fs = Promise.promisifyAll(require("fs"));
const path = require('path');

class ScaffoldingEngine {
  constructor(client) {
    this.client = client;
  }

  deepCopyToBox(basePath, parentId, folderName) {
    return readEntireFolderStructure(basePath, parentId, folderName, this.client);
  }
}

function readEntireFolderStructure(basePath, parentId, folderName, client) {
  return asyncFunc(function* () {
    let folder = yield fs.readdirAsync(basePath);
    let createdFolder = yield client.folders.createAsync(parentId, folderName);
    let nextFolders = [];
    for (let i = 0; i < folder.length; i++) {
      let item = folder[i];
      let stats = yield fs.statAsync(path.join(basePath, item));
      if (stats.isDirectory()) {
        nextFolders.push([path.join(basePath, item), createdFolder.id, item]);
      }
      if (stats.isFile()) {
        let contents = fs.createReadStream(path.join(basePath, item));
        let file = yield client.files.uploadFileAsync(createdFolder.id, item, contents);
      }
    }
    if (nextFolders.length > 0) {
      for (let i = 0; i < nextFolders.length; i++) {
        readEntireFolderStructure(...nextFolders[i], client);
      }
    }
  })();
}

module.exports = ScaffoldingEngine;