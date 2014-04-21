// # Ghost Data API
// Provides access to the data model

var _             = require('lodash'),
    when          = require('when'),
    config        = require('../config'),
    db            = require('./db'),
    settings      = require('./settings'),
    notifications = require('./notifications'),
    posts         = require('./posts'),
    users         = require('./users'),
    tags          = require('./tags'),
    mail          = require('./mail'),
    requestHandler,
    init;

// ## Request Handlers

function cacheInvalidationHeader(req, result) {
    //TODO: don't set x-cache-invalidate header for drafts
    var parsedUrl = req._parsedUrl.pathname.replace(/\/$/, '').split('/'),
        method = req.method,
        endpoint = parsedUrl[4],
        id = parsedUrl[5],
        cacheInvalidate,
        jsonResult = result.toJSON ? result.toJSON() : result;

    if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
        if (endpoint === 'settings' || endpoint === 'users' || endpoint === 'db') {
            cacheInvalidate = '/*';
        } else if (endpoint === 'posts') {
            cacheInvalidate = '/, /page/*, /rss/, /rss/*, /tag/*';
            if (id && jsonResult.posts[0].slug) {
                return config.urlForPost(settings, jsonResult.posts[0]).then(function (postUrl) {
                    return cacheInvalidate + ', ' + postUrl;
                });
            }
        }
    }

    return when(cacheInvalidate);
}

// ### requestHandler
// decorator for api functions which are called via an HTTP request
// takes the API method and wraps it so that it gets data from the request and returns a sensible JSON response
requestHandler = function (apiMethod) {
    return function (req, res) {
        var options = _.extend(req.body, req.files, req.query, req.params),
            apiContext = {
                user: (req.session && req.session.user) ? req.session.user : null
            };

        return apiMethod.call(apiContext, options).then(function (result) {
            return cacheInvalidationHeader(req, result).then(function (header) {
                if (header) {
                    res.set({
                        "X-Cache-Invalidate": header
                    });
                }
                res.json(result || {});
            });
        }, function (error) {
            var errorCode = error.code || 500,
                errorMsg = {error: _.isString(error) ? error : (_.isObject(error) ? error.message : 'Unknown API Error')};
            res.json(errorCode, errorMsg);
        });
    };
};

init = function () {
    return settings.updateSettingsCache();
};

// Public API
module.exports = {
    posts: posts,
    users: users,
    tags: tags,
    notifications: notifications,
    settings: settings,
    db: db,
    mail: mail,
    requestHandler: requestHandler,
    init: init
};
