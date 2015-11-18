'use strict';

var fs = require('fs-extra');

/**
 * Given a word returns a selector for that word.
 * Example: selector('user') === '$user'
 */
function selector(field) {
  return '$' + field;
}

exports.selector = selector;

/**
 * Format email. Given the text contained in template for every field in fields
 * replaces $field with fields.field.
 */
function formatString(template, fields) {
  var updatedTemplate = template;
  for (var field in fields) {
    var fieldSelector = selector(field);
    var newTemplate = updatedTemplate.replace(fieldSelector, fields[field]);
    while (newTemplate !== updatedTemplate) {
      updatedTemplate = newTemplate;
      newTemplate = newTemplate.replace(fieldSelector, fields[field]);
    }
  }
  return updatedTemplate;
}

exports.formatString = formatString;

/**
 * Format email. Opens the file pointed by templateFilename and reads its
 * content, then calls formatString(template, fields).
 *
 * @param {string} templateFilename - The name of the file containing an email
 *     template.
 * @param {object} fields - An object from which fields to replace are taken.
 *     If fields.fieldName exists then $fieldName is replaced with
 *     the value of fields.fieldName.
 * @param {function} callback - The callback function. Callback must be of type
 *    function(err, data): err is set if the file failed to open, data is the
 *    formatted template
 *
 * Usage example:
 * 
 * formatFile('file', {user: 'gigi', invitedBy: 'mario'}, function(err, data) {
 *   if (err) {
 *     // Should never occurr
 *     console.log(err);
 *     return;
 *   }
 *   console.log(data);
 * });
 */
function formatFile(templateFilename, fields, callback) {
  if (!callback) {
    callback = function() {};
  }
  fs.readFile(templateFilename, 'utf8', function(err, data) {
    if (err) {
      // this should never happen
      return callback(err);
    }
    return callback(null, formatString(data, fields));
  });
}

exports.formatFile = formatFile;
