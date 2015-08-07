'use strict';

var config = rootRequire('config/config');
var sendgrid = require("sendgrid")(
  config.SENDGRID_USER, 
  config.SENDGRID_API_KEY);

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
 */
function sendEmail(email) {
  var sgEmail = new sendgrid.Email(jsonEmail);
  if (email.template) {
    sgEmail.addFilter('templates', 'enable', 1);
    sgEmail.addFilter('templates', 'template_id', template);
  }
  sendgrid.send(email);
}

exports.sendEmail = sendEmail;