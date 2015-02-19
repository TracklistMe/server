'use strict';

var config = rootRequire('config/config');
var amqp = require('amqp');


var connection = amqp.createConnection( 
  { host: config.RABBITMQ_HOST,
    port: config.RABBITMQ_PORT,
    login: config.RABBITMQ_USERNAME,
    password: config.RABBITMQ_PASSWORD,
  });

function sendReleaseToProcess(release) {

    connection.queue(
      config.RABBITMQ_RELEASE_QUEUE, 
      {autoDelete: false, durable: true}, 
      function(queue){
        connection.publish(
          config.RABBITMQ_RELEASE_QUEUE, 
          release.toString(), 
          {deliveryMode: 2},
          function(err) {
            if (err) console.log("Send failed")
            else connection.close()
          });
      });
}

function onReleaseResult(callback) {
    connection.queue(
      config.RABBITMQ_RELEASE_QUEUE, 
      {autoDelete: false, durable: true}, 
      function(queue){

        queue.subscribe(callback);
    });
}

exports.sendReleaseToProcess = sendReleaseToProcess;


