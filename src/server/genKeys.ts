import * as crypto from "crypto";
var fs = require('fs');

// crypto.generateKeyPair('rsa',
// {
//     modulusLength: 2048,
//     publicKeyEncoding: {
//       type: 'spki',
//       format: 'pem'
//     },
//     privateKeyEncoding: {
//       type: 'pkcs8',
//       format: 'pem',
//     }
//   }
// , (error, pubKey, pvtKey) => {
//     console.log(pubKey);
//     console.log(pvtKey);
// });