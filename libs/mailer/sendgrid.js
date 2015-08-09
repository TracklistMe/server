'use strict';

var config = rootRequire('config/config');

console.log(config.SENDGRID_USER);
console.log(config.SENDGRID_API_KEY);

var sendgrid = require('sendgrid')(config.SENDGRID_API_KEY);

/**
 * Send an email.
 *
 * @param {object} email - The email to be sent.
 * @param {array|string} email.to - One or multiple to addresses.
 * @param {string} email.from - Email sender.
 * @param {string} email.subject - Email subject.
 * @param {string=} email.text - Text of the email.
 * @param {string=} email.html - Html content of the email.
 * @param {string=} email.template - Template id.
 * @param {function} callback - The callback function.
 */
function sendEmail(email, callback) {
  var sgEmail = new sendgrid.Email(email);
  if (email.template) {
    sgEmail.addFilter('templates', 'enable', 1);
    sgEmail.addFilter('templates', 'template_id', email.template);
  }
  sendgrid.send(email, callback);
}

exports.sendEmail = sendEmail;