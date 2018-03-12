/*
 * @license
 * Copyright 2018 Cayle Sharrock
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
 * an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under the License.
 *
 */

const swaggerRoutes = require('swagger-routes');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const {codes} = require('./errors');

app.use(bodyParser.json());

swaggerRoutes(app, {
    api: `${__dirname}/../spec/swagger.yaml`,
    handlers: {
        path: `${__dirname}/handlers`,
        generate: process.env.NODE_ENV !== 'production'
    },
    authorizers: `${__dirname}/handlers/security`,
    maintainHeaders: process.env.NODE_ENV !== 'production'
});

// Override error response
app.use((err, req, res, next) => {
    if (!err) {
        next();
    }
    let response = {
        success: false,
        message: err.message,
        errorCode: codes.UnknownError
    };
    if (err.constructor.name === 'ValidationError') {
        response.errorCode = codes.ValidationError;
    }
    if (err.asResponse) {
        response = err.asResponse()
    }
    res.status(400).json(response);
});

module.exports = app;
