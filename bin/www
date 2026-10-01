#!/usr/bin/env node

var http = require('http');
var app = require('../app');

var port = normalizePort(process.env.PORT || '3000');
app.set('port', port);

var server = http.createServer(app);
server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

function normalizePort(value) {
  var parsedPort = parseInt(value, 10);

  if (isNaN(parsedPort)) {
	return value;
  }

  if (parsedPort >= 0) {
	return parsedPort;
  }

  return false;
}

function onError(error) {
  if (error.syscall !== 'listen') {
	throw error;
  }

  var bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;

  if (error.code === 'EACCES') {
	console.error(bind + ' requires elevated privileges');
	process.exit(1);
  }

  if (error.code === 'EADDRINUSE') {
	console.error(bind + ' is already in use');
	process.exit(1);
  }

  throw error;
}

function onListening() {
  var address = server.address();
  var bind = typeof address === 'string' ? 'pipe ' + address : 'port ' + address.port;
  console.log('Listening on ' + bind);
}
