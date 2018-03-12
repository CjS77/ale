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

class AleError extends Error {
    constructor(msg, code) {
        super(msg);
        // Saving class name in the property of our custom error as a shortcut.
        this.name = this.constructor.name;
        // Capturing stack trace, excluding constructor call from it.
        Error.captureStackTrace(this, this.constructor);
        this.code = code;
    }
    
    asResponse() {
        return {
            success: false,
            message: this.message,
            errorCode: this.code
        }
    }
}

const codes = {
    UnknownError: -1,
    MismatchedCurrency: 100,
    TransactionIDNotFound: 200,
    ExchangeRateNotFound: 210,
    DatabaseConnectionError: 300,
    DatabaseUpdateError: 310,
    DatabaseQueryError: 320,
    EntryNotBalanced: 400,
    MissingInput: 500,
    BookDoesNotExist: 510
};

module.exports = {
    AleError, codes
};
