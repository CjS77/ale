const Sequelize = require('sequelize');
const sequelize = require('./connection');
const { AleError, codes } = require('../lib/errors');
const Book = require('./book');

/**
 * An account is a record base to store and sort transactions. Each transaction must belong to an account. 
 */
const Account = sequelize.define('account', {
  accountCode: { type: Sequelize.INTEGER, notNull: true, unique: { args: true, msg: 'The account code already exists' } },
  accountName: { type: Sequelize.STRING, unique: { args: true, msg: 'The account name already exists' } },
  toIncrease: { type: Sequelize.STRING, notNull: true },
  accountClassification: { type: Sequelize.STRING },
  accountType: { type: Sequelize.STRING },
  subAccountType: { type: Sequelize.STRING },
  memo: { type: Sequelize.STRING },
  bookId: {
    type: Sequelize.INTEGER,
    references: {
      // This is a reference to another model
      model: Book,

      // This is the column name of the referenced model
      key: 'id',
    }
  },
});

/**
 * Gets an existing account, or creates a new one
 * @param accountCode Unique code for the new account
 * @param accountName Unique name of the new account
 * @param toIncrease Debit or Credit - to increase the account
 * @param accountClassification Is this a 'Balance sheet' or 'P or L' account
 * @param accountType Which account type? Income, liability etc.
 * @param subAccountType Which sub-account type? current asset, non-current etc. Also for reporting purposes
 * @param memo Some description of the account
 * @param bookId Already created book for account to be linked to
 */
Account.getOrCreateBook = function (accountCode, accountName, toIncrease, accountClassification, accountType, subAccountType, memo, bookId) {
  return Account.findOrCreate({
    where: { accountCode: accountCode },
    defaults: {
      accountCode, accountName, toIncrease, accountClassification, accountType, subAccountType, memo, bookId
    }
  }).then(result => {
    console.log(result);
    
    if (result.includes(false)) {
      return sequelize.Promise.reject(new AleError('Account code already exists', codes.DatabaseQueryError));
    }
    return result
  });
};

/**
 * Return instance in native formats
 */
Account.prototype.values = function () {
  return {
    id: this.getDataValue('id'),
    accountCode: this.getDataValue('accountCode'),
    accountName: this.getDataValue('accountName'),
    toIncrease: this.getDataValue('toIncrease'),
    accountClassification: this.getDataValue('accountClassification'),
    accountType: this.getDataValue('accountType'),
    subAccountType: this.getDataValue('subAccountType'),
    memo: this.getDataValue('memo'),
  };
};

module.exports = Account;
