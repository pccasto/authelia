
var UserDataStore = require('../../src/lib/user_data_store');
var DataStore = require('nedb');
var assert = require('assert');
var Promise = require('bluebird');
var sinon = require('sinon');
var MockDate = require('mockdate');

describe('test user data store', function() {
  describe('test u2f meta', test_u2f_meta);
  describe('test u2f registration token', test_u2f_registration_token);
});

function test_u2f_meta() {
  it('should save a u2f meta', function() {
    var options = {};
    options.inMemoryOnly = true;

    var data_store = new UserDataStore(DataStore, options);

    var userid = 'user';
    var app_id = 'https://localhost';
    var meta = {};
    meta.publicKey = 'pbk';

    return data_store.set_u2f_meta(userid, app_id, meta)
    .then(function(numUpdated) {
      assert.equal(1, numUpdated);
      return Promise.resolve();
    });
  });

  it('should retrieve no u2f meta', function() {
    var options = {};
    options.inMemoryOnly = true;

    var data_store = new UserDataStore(DataStore, options);

    var userid = 'user';
    var app_id = 'https://localhost';
    var meta = {};
    meta.publicKey = 'pbk';

    return data_store.get_u2f_meta(userid, app_id)
    .then(function(doc) {
      assert.equal(undefined, doc);
      return Promise.resolve();
    });
  });

  it('should insert and retrieve a u2f meta', function() {
    var options = {};
    options.inMemoryOnly = true;

    var data_store = new UserDataStore(DataStore, options);

    var userid = 'user';
    var app_id = 'https://localhost';
    var meta = {};
    meta.publicKey = 'pbk';

    return data_store.set_u2f_meta(userid, app_id, meta)
    .then(function(numUpdated, data) {
      assert.equal(1, numUpdated);
      return data_store.get_u2f_meta(userid, app_id)
    })
    .then(function(doc) {
      assert.deepEqual(meta, doc.meta);
      assert.deepEqual(userid, doc.userid);
      assert.deepEqual(app_id, doc.appid);
      assert('_id' in doc);
      return Promise.resolve();
    });
  });
}

function test_u2f_registration_token() {
  it('should save u2f registration token', function() {
    var options = {};
    options.inMemoryOnly = true;

    var data_store = new UserDataStore(DataStore, options);

    var userid = 'user';
    var token = 'token';
    var max_age = 60;
    var content = 'abc';

    return data_store.issue_identity_check_token(userid, token, content, max_age)
    .then(function(document) {
      assert.equal(document.userid, userid);
      assert.equal(document.token, token);
      assert.deepEqual(document.content, { userid: 'user', data: content });
      assert('max_date' in document);
      assert('_id' in document);
      return Promise.resolve();
    })
    .catch(function(err) {
      console.error(err);
      return Promise.reject(err);
    });
  });

  it('should save u2f registration token and consume it', function(done) {
    var options = {};
    options.inMemoryOnly = true;

    var data_store = new UserDataStore(DataStore, options);

    var userid = 'user';
    var token = 'token';
    var max_age = 50;

    data_store.issue_identity_check_token(userid, token, {}, max_age)
    .then(function(document) {
      return data_store.consume_identity_check_token(token);
    })
    .then(function() {
      done();
    })
    .catch(function(err) {
      console.error(err);
    });
  });

  it('should not be able to consume registration token twice', function(done) {
    var options = {};
    options.inMemoryOnly = true;

    var data_store = new UserDataStore(DataStore, options);

    var userid = 'user';
    var token = 'token';
    var max_age = 50;

    data_store.issue_identity_check_token(userid, token, {}, max_age)
    .then(function(document) {
      return data_store.consume_identity_check_token(token);
    })
    .then(function(document) {
      return data_store.consume_identity_check_token(token);
    })
    .catch(function(err) {
      console.error(err);
      done();
    });
  });

  it('should fail when token does not exist', function() {
    var options = {};
    options.inMemoryOnly = true;

    var data_store = new UserDataStore(DataStore, options);

    var token = 'token';

    return data_store.consume_identity_check_token(token)
    .then(function(document) {
      return Promise.reject();
    })
    .catch(function(err) {
      return Promise.resolve(err);
    });
  });

  it('should fail when token expired', function(done) {
    var options = {};
    options.inMemoryOnly = true;

    var data_store = new UserDataStore(DataStore, options);

    var userid = 'user';
    var token = 'token';
    var max_age = 60;
    MockDate.set('1/1/2000');

    data_store.issue_identity_check_token(userid, token, {}, max_age)
    .then(function() {
      MockDate.set('1/2/2000');
      return data_store.consume_identity_check_token(token);
    })
    .catch(function(err) {
      MockDate.reset();
      done();
    });
  });

  it('should save the userid and some data with the token', function(done) {
    var options = {};
    options.inMemoryOnly = true;

    var data_store = new UserDataStore(DataStore, options);

    var userid = 'user';
    var token = 'token';
    var max_age = 60;
    MockDate.set('1/1/2000');
    var data = 'abc';

    data_store.issue_identity_check_token(userid, token, data, max_age)
    .then(function() {
      return data_store.consume_identity_check_token(token);
    })
    .then(function(content) {
      var expected_content = {};
      expected_content.userid = 'user';
      expected_content.data = 'abc';
      assert.deepEqual(content, expected_content); 
      done();
    })
  });
}
