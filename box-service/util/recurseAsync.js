'use strict';
const _ = require('lodash');
const autoPageWithOffsetAsync = require('./autopageAsync').autoPageWithOffsetAsync;
const Promise = require('bluebird');
const asyncFunc = Promise.coroutine;

class BoxRecursiveUtilities{

  static getAllItemsAsync(client, id) {
    let nextFolder;
    let folderCollectionIndex = [];
    let folderCollection = [];
    let fileCollection = [];
    return asyncFunc(function* () {
      return yield recurseFolders(client, id);
    })();


    function recurseFolders(client, id) {
      return asyncFunc(function* () {
        id = id || "0";
        let response = yield autoPageWithOffsetAsync(client, "folders", "getItemsAsync", id, null)
        response.forEach(function (item) {
          if (item.type === "folder") {
            folderCollectionIndex.push(item);
            folderCollection.push(item);
          } else if (item.type === "file") {
            fileCollection.push(item);
          }
        });
        if (folderCollection.length > 1) {
          nextFolder = folderCollection.shift();
          return yield recurseFolders(client, nextFolder.id);
        } else {
          return { files: fileCollection, folders: folderCollectionIndex };
        }
      })();
    }
  }

  static getFolderTreeAsync(client, id) {
    let folderPathIndex = {};
    return asyncFunc(function* () {
      id = id || "0";
      let response = yield client["folders"]["getAsync"](id, { fields: "id,name,etag" });
      let rootFolder = {
        id: response.id,
        name: response.name,
        etag: response.etag,
        parent: {},
        folders: [],
        files: []
      }
      folderPathIndex[id] = id;
      return yield recurseFoldersForFolderTree(client, response.id, rootFolder, null);
    })();

    function recurseFoldersForFolderTree(client, id, folderTree, folders) {
      return asyncFunc(function* () {
        id = id || "0";
        folders = folders || [];
        let currentFolderPath = folderPathIndex[id];
        let currentFolder = findFolderFromFolderPath(folderTree, currentFolderPath);
        let response = yield autoPageWithOffsetAsync(client, "folders", "getItemsAsync", id, { fields: "id,name,parent" });
        response.forEach(function (item) {
          if (item.type === "folder") {
            var itemFolderPath = `${currentFolderPath}.${item.id}`;
            folderPathIndex[item.id] = itemFolderPath;
            item.folderPath = itemFolderPath;
            item.folders = [];
            item.files = [];
            currentFolder.folders.push(item);
            folders.push(item.id);
          } else if (item.type === "file") {
            item.folderPath = currentFolderPath;
            currentFolder.files.push(item);
          }
        });
        if (folders.length > 0) {
          return yield recurseFoldersForFolderTree(client, folders.shift(), folderTree, folders);
        } else {
          return folderTree;
        }
      })();
    }

    function findFolderFromFolderPath(obj, folderPath) {
      var path = folderPath.split('.');
      var folder;
      if (path.length === 1) {
        return obj;
      }
      if (path.length > 1) {
        path.shift();
        var findObject = obj.folders;
        path.forEach(function (val, index, arr) {
          var match = _.find(findObject, function (folder) {
            return folder.id == val;
          });
          if ((match && index == arr.length - 1) || arr.length === 1) {
            folder = match;
          } else {
            findObject = match.folders;
          }
        });
        return folder;
      }
    }
  }
}
module.exports = BoxRecursiveUtilities;