/*
 * The MIT License (MIT)
 *
 * Copyright (c) 2017 Karl STEIN
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 */

import {_} from 'meteor/underscore';
import {check} from 'meteor/check';
import {Meteor} from 'meteor/meteor';
import {UploadFS} from 'meteor/jalik:ufs';


/**
 * File system store
 * @param options
 * @constructor
 */
export class LocalStore extends UploadFS.Store {

    constructor(options) {
        // Default options
        options = _.extend({
            mode: '0744',
            path: 'ufs/uploads',
            writeMode: '0744'
        }, options);

        // Check options
        if (typeof options.mode !== "string") {
            throw new TypeError("LocalStore: mode is not a string");
        }
        if (typeof options.path !== "string") {
            throw new TypeError("LocalStore: path is not a string");
        }
        if (typeof options.writeMode !== "string") {
            throw new TypeError("LocalStore: writeMode is not a string");
        }

        super(options);
        let self = this;

        // Private attributes
        let mode = options.mode;
        let path = options.path;
        let writeMode = options.writeMode;

        if (Meteor.isServer) {
            const fs = Npm.require('fs');

            fs.stat(path, function (err) {
                if (err) {
                    const mkdirp = Npm.require('mkdirp');

                    // Create the directory
                    mkdirp(path, {mode: mode}, function (err) {
                        if (err) {
                            console.error(`LocalStore: cannot create store at ${path} (${err.message})`);
                        } else {
                            console.info(`LocalStore: store created at ${path}`);
                        }
                    });
                } else {
                    // Set directory permissions
                    fs.chmod(path, mode, function (err) {
                        err && console.error(`LocalStore: cannot set store permissions ${mode} (${err.message})`);
                    });
                }
            });
        }

        /**
         * Returns the path or sub path
         * @param file
         * @return {string}
         */
        this.getPath = function (file) {
            return path + (file ? `/${file}` : '');
        };


        if (Meteor.isServer) {
            /**
             * Removes the file
             * @param fileId
             * @param callback
             */
            this.delete = function (fileId, callback) {
                let path = this.getFilePath(fileId);

                if (typeof callback !== 'function') {
                    callback = function (err) {
                        err && console.error(`LocalStore: cannot delete file "${fileId}" at ${path} (${err.message})`);
                    }
                }
                const fs = Npm.require('fs');
                fs.stat(path, Meteor.bindEnvironment(function (err, stat) {
                    if (!err && stat && stat.isFile()) {
                        fs.unlink(path, Meteor.bindEnvironment(function () {
                            self.getCollection().remove(fileId);
                            callback.call(self);
                        }));
                    }
                }));
            };

            /**
             * Returns the file read stream
             * @param fileId
             * @param file
             * @param options
             * @return {*}
             */
            this.getReadStream = function (fileId, file, options) {
                const fs = Npm.require('fs');
                options = _.extend({}, options);
                return fs.createReadStream(self.getFilePath(fileId, file), {
                    flags: 'r',
                    encoding: null,
                    autoClose: true,
                    start: options.start,
                    end: options.end
                });
            };

            /**
             * Returns the file write stream
             * @param fileId
             * @param file
             * @param options
             * @return {*}
             */
            this.getWriteStream = function (fileId, file, options) {
                const fs = Npm.require('fs');
                options = _.extend({}, options);
                return fs.createWriteStream(self.getFilePath(fileId, file), {
                    flags: 'a',
                    encoding: null,
                    mode: writeMode,
                    start: options.start
                });
            };

            /**
             * Writes a symbolic link
             * @param linkFileId
             * @param newFileId
             * @param callback
             * @param errorCallback
             */
            this.createSymbolicLink = function (linkFileId, newFileId, callback, errorCallback) {
                const fs = Npm.require('fs');
                const original = self.getFilePath(linkFileId);
                const symlink = self.getFilePath(newFileId);
                if (fs.existsSync(original)) {
                  return fs.symlink(original, symlink, callback);
                } else {
                  return errorCallback({message: 'Symlink Error: Original file cannot be found'});
                }
            };
        }
    }

    /**
     * Returns the file path
     * @param fileId
     * @param file
     * @return {string}
     */
    getFilePath(fileId, file) {
        file = file || this.getCollection().findOne(fileId, {fields: {extension: 1}});
        return file && this.getPath(fileId + (file.extension ? `.${file.extension }` : ''));
    }
}

// Add store to UFS namespace
UploadFS.store.Local = LocalStore;
