var
  mysql = require ('mysql'),
  R     = require ('ramda'),
  T     = require ('data.task'),

//defaultHandler :: (b -> c) -> (a -> c) -> b -> a -> c
  defaultHandler = R.curry (function (reject, resolve, err, data) {
    if (err) { return reject (err); }
    return resolve (data);
  }),

//Ends connection and passes through result
//endConnection :: Connection -> a -> a
  endConnection = R.curry (function (conn, f, x) { conn.end(); return f (x); }),

//getConnection :: Config -> Connection
  getConnection = function (conf) { return mysql.createConnection (conf); },

//query :: Config -> String -> [Sql.Param] -> Task Error [a]
  query = R.curry (function (conf, sql, params) {
   return new T (function (reject, resolve) {
     // Using Either ADT would make results more reasonable.
     var conn    = mysql.createConnection (conf);
     var handler = defaultHandler (endConnection (conn, reject), endConnection (conn, resolve));
     conn.connect (function (err) {
       if (err) { return reject (err); }
       conn.query (sql, params, handler);
     });
   });
  }),

  nil = null;

module.exports = {
  escape: mysql.escape,

  query: query
};
