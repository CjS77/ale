/*
 * @license
 * Copyright 2017 Cayle Sharrock
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
 * an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under the License.
 */

const dotenv = require('dotenv');
dotenv.config();
const Sequelize = require('sequelize');
const conn = process.env.ALE_CONNECTION;
const { AleError, codes } = require('../lib/errors');

if (!conn) {
    throw new AleError('ALE_CONNECTION envar is not set, cannot connect to database', codes.DatabaseConnectionError);
}

const options = process.env.ALE_DEBUG === 'true' ? { logging: console.log } : { logging: null };
const sequelize = new Sequelize(conn, options);

module.exports = sequelize;
