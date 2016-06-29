const
  R = require ('ramda'),
  T = require ('data.task'),
  IO = require ('fantasy-io'),
  M = require ('control.monads'),

  mysql = require ('../lib/mysql'),
  AWS   = require ('aws-sdk')

  logI      = function (x) { console.log (x); return x; },
  id        = function (x) { return x; },
  konst     = R.curry (function (a, b) { return a; }),
  du        = function (M) { return function () { return R.apply (R.pipe, arguments)(M.of ({})); }; },
  bind      = function (a) { return R.chain (konst (a)); },
  chain     = R.chain,
  map       = R.map,
  ap        = R.curry (function (ma, mf) { return mf.ap (ma); }),
  random    = R.curry (function (min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }),
  runTaskIO = R.curry (function (rej, res, t) { return IO (function () { t.fork (rej, res); }); }),

  keyID = "arn:aws:kms:us-east-1:accountid:key/kmskeyhere"
  kms   = new AWS.KMS({region: 'us-east-1'});
  dynamoDBConfiguration = { "region": "us-east-1" }
  AWS.config.update(dynamoDBConfiguration)
  dynamodb = new AWS.DynamoDB({apiVersion: '2012-08-10'})
  docClient = new AWS.DynamoDB.DocumentClient();

//Password to encrypt and decrypt here within this object
  object = {
    KeyId: keyID,
    Plaintext: "123456789abcdefghijklmnopqrstuvwxyz"
  };

//encryptString :: String -> Task (Buffer)
  encryptString = function (conf) {
    return new T (function (reject, resolve) {
      kms.encrypt(conf, function(err, data) {
        if (err) { return reject (err, err.stack); }
        return resolve (data.CiphertextBlob)
      })
    })
  }

//storeEncString :: Buffer -> Task (Response)
  storeEncString = function (encString) {
    return new T (function (reject, resolve) {
      params = {
        "TableName": "dynamodb-here",
        "Item": {
          "name": { "S": "ex.am.ple"  },
          "version": { "S": "1" },
          "pass": { "B": encString}
        }
      }
      dynamodb.putItem(params, function(err, data) {
        if (err) { return reject (err, err.stack); }
        return resolve (data)
      })
    })
  }

//getEncString :: Task (Buffer)
  getEncString = function() {
    return new T (function (reject, resolve) {
      var params = {
        TableName: "dynamodb-here",
        AttributesToGet: [
          "pass"
        ],
        Key: {
          "name": { "S": "ex.am.ple" },
          "version": { "S": "1" }
        } 
      }
      dynamodb.getItem(params, function(err, data){
        if (err) { return reject (err, err.stack); }
        return resolve (data.Item.pass.B) 
      })
    })
  }

//wrapEncString :: Buffer -> { CiphertextBlob: Buffer }
  wrapEncString = function (encString) {
    var encObject = {
      CiphertextBlob: Buffer(encString, 'base64'),
    }
    return encObject
  }

//decryptString :: { CiphertextBlob: Buffer } -> Task (String)
  decryptString = function (encString) {
    return new T (function (reject, resolve) {
      kms.decrypt(encString, function(err, data) {
        if (err) { return reject (err, err.stack); }
        return resolve (data.Plaintext.toString())
      })
    })
  }

  encryptConfig = encryptString (object)

  main = (function (){
    const
    runMe = du (T) ( bind  (encryptConfig)
                   , map   (logI)
                   , chain (storeEncString)
                   , chain (getEncString)
                   , map   (wrapEncString)
                   , map   (logI)
                   , chain (decryptString)
                   , map   (logI)),

    nil = null;

    return runTaskIO (logI, id, runMe);
  })(),

  nill = null;

(function runIO () {
  main.unsafePerform ();
})();
