
module.exports = {
  run: run
}

var express = require('express');
var bodyParser = require('body-parser');
var path = require('path');
var UserDataStore = require('./user_data_store');
var Notifier = require('./notifier');
var AuthenticationRegulator = require('./authentication_regulator');
var setup_endpoints = require('./setup_endpoints');
var config_adapter = require('./config_adapter');
var Ldap = require('./ldap');
var AccessControl = require('./access_control');

function run(yaml_config, deps, fn) {
  var config = config_adapter(yaml_config);

  var view_directory = path.resolve(__dirname, '../views');
  var public_html_directory = path.resolve(__dirname, '../public_html');
  var datastore_options = {};
  datastore_options.directory = config.store_directory;
  if(config.store_in_memory)
    datastore_options.inMemory = true;

  var app = express();
  app.use(express.static(public_html_directory));
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json());
  app.set('trust proxy', 1); // trust first proxy

  app.use(deps.session({
    secret: config.session_secret,
    resave: false,
    saveUninitialized: true,
    cookie: { 
      secure: false,
      maxAge: config.session_max_age,
      domain: config.session_domain
    },
  }));
  
  app.set('views', view_directory);
  app.set('view engine', 'ejs');

  // by default the level of logs is info
  deps.winston.level = config.logs_level || 'info';

  var five_minutes = 5 * 60;
  var data_store = new UserDataStore(deps.nedb, datastore_options);
  var regulator = new AuthenticationRegulator(data_store, five_minutes);
  var notifier = new Notifier(config.notifier, deps);
  var ldap = new Ldap(deps, config.ldap);
  var access_control = AccessControl(deps.winston, config.access_control);

  app.set('logger', deps.winston);
  app.set('ldap', ldap);
  app.set('totp engine', deps.speakeasy);
  app.set('u2f', deps.u2f);
  app.set('user data store', data_store);
  app.set('notifier', notifier);
  app.set('authentication regulator', regulator);
  app.set('config', config);
  app.set('access control', access_control);

  setup_endpoints(app);
  
  return app.listen(config.port, function(err) {
    console.log('Listening on %d...', config.port);
    if(fn) fn();
  });
}
