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

const BigNumber = require('bignumber.js');
const Sequelize = require('sequelize');
const PRECISION = 16;
const ZERO = new BigNumber(0);
const NEAR_ZERO = 1e-10;
const CURRENCY_LARGE = Sequelize.DECIMAL(40, PRECISION);
const CURRENCY_CODE = Sequelize.STRING(3);

module.exports = {
    PRECISION,
    ZERO,
    NEAR_ZERO,
    CURRENCY_LARGE,
    CURRENCY_CODE
};
