'use strict';
const ITEM_LIMIT = 100;
const Promise = require('bluebird');
const asyncFunc = Promise.coroutine;

class BoxAutoPageUtilities {

  static autoPageWithOffsetAsync(client, manager, methodName, id, options) {
    return asyncFunc(function* () {
      let collection = [];
      options = options || {};
      options.offset = options.offset || 0;
      options.limit = options.limit || ITEM_LIMIT;
      return yield continuePagingWithOffset(client, manager, methodName, id, options, collection, options.offset);
    })();

    function continuePagingWithOffset(client, manager, methodName, id, options, collection, offset) {
      return asyncFunc(function* () {
        var keepGoing = true;
        options.offset = offset;
        let results;
        if (id) {
          results = yield client[manager][methodName](id, options);
        } else {
          results = yield client[manager][methodName](options);
        }
        let entries = results.entries || results.item_collection.entries;
        collection = collection.concat(entries);
        offset += options.limit;
        keepGoing = entries.length >= options.limit;
        if (keepGoing) {
          return yield continuePagingWithOffset(client, manager, methodName, id, options, collection, offset);
        } else {
          return collection;
        }
      })();
    }
  }

  static autoPageWithMarkerAsync(client, manager, methodName, id, options) {
    return asyncFunc(function* () {
      var collection = [];
      options = options || {};
      options.limit = options.limit || ITEM_LIMIT;
      return yield continuePagingWithMarker(client, manager, methodName, id, options, collection);
    })();

    function continuePagingWithMarker(client, manager, methodName, id, options, collection) {
      return asyncFunc(function* () {
        var keepGoing = true;
        let results;
        if (id) {
          results = yield client[manager][methodName](id, options);
        } else {
          results = yield client[manager][methodName](options);
        }
        collection = collection.concat(results.entries);
        keepGoing = (results.next_marker);
        if (keepGoing) {
          options.marker = results.next_marker;
          return yield continuePagingWithMarker(client, manager, methodName, id, options, collection);
        } else {
          return collection;
        }
      })();
    }
  }



  static autoPageWithStreamAsync(client, manager, methodName, id, options) {
    return asyncFunc(function* () {
      var collection = [];
      options = options || {};
      options.limit = options.limit || ITEM_LIMIT;
      return yield continuePagingWithStream(client, manager, methodName, id, options, collection);
    })();
    function continuePagingWithStream(client, manager, methodName, id, options, collection) {
      return asyncFunc(function* () {
        var keepGoing = true;
        let results;
        if (id) {
          results = yield client[manager][methodName](id, options);
        } else {
          results = yield client[manager][methodName](options);
        }
        collection = collection.concat(results.entries);
        keepGoing = (results.next_stream_position && results.entries.length > 0);
        if (keepGoing) {
          options.stream_position = results.next_stream_position;
          return yield continuePagingWithStream(client, manager, methodName, id, options, collection);
        } else {
          return collection;
        }
      })();

    }
  }
}

module.exports = BoxAutoPageUtilities;