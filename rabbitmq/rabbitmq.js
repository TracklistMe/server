'use strict';

var config = rootRequire('config/config');
var amqp = require('amqp');


var connectionReady = false;


var connection = amqp.createConnection({
    host: config.RABBITMQ_HOST,
    port: config.RABBITMQ_PORT,
    login: config.RABBITMQ_USERNAME,
    password: config.RABBITMQ_PASSWORD,
});

connection.on('ready', function() {


    connectionReady = true;
    console.log("Connection is ready");
    if (resultQueueListener) {
        connection.queue(
            config.RABBITMQ_RESULT_QUEUE, {
                autoDelete: false,
                durable: true
            },
            function(queue) {
                console.log("Before subscribe")
                queue.subscribe(resultQueueListener);
            }, function(err) {
                console.log(err);
                console.log("Callback not registered");
            });
    }

});

connection.on('error', function(err) {
    console.log(err)
});

var resultQueueListener;



function sendReleaseToProcess(release) {

    while (!connectionReady) {}

    connection.queue(
        config.RABBITMQ_RELEASE_QUEUE, {
            autoDelete: false,
            durable: true
        },
        function(queue) {
            connection.publish(
                config.RABBITMQ_RELEASE_QUEUE,
                JSON.stringify(release, null, 4), {
                    deliveryMode: 2
                },
                function(err) {
                    if (err) console.log("Send failed")
                });
        });

}

exports.sendReleaseToProcess = sendReleaseToProcess;

function onReleaseResult(callback) {

    console.log("REGISTERING CALLBACK");
    resultQueueListener = callback;

    if (connectionReady) {
        console.log("Connection is ready");
        connection.queue(
            config.RABBITMQ_RESULT_QUEUE, {
                autoDelete: false,
                durable: true
            },
            function(queue) {
                console.log("before subscribe")
                queue.subscribe(resultQueueListener);
            }, function(err) {
                console.log(err);
                console.log("Callback not registered");
            });
    }

}

exports.onReleaseResult = onReleaseResult;