/**
 * Promise wrapper around simple get.
 */
const log = require('./log.js');
const simpleget = require('simple-get');
const xml = require('xml2js-parser');

/**
 * Make a http call.
 * 
 * @param opt  Used as options for simple get.
 */
module.exports.call = async (opt) => {
    return new Promise((resolve, reject) => {
        log.trace('http '+opt.method+' '+opt.url);
        simpleget.concat(opt, (err, res, data) =>{
            if(err) {
                reject(err);
            } else {
                log.trace('http data '+data);
                if( res.statusCode>=100 && res.statusCode<400 ) {
                    resolve(data);
                } else {
                    reject(new Error("Error response for "+opt.url+" with status " +res.statusCode));
                }
            }
        });
    })
}

/**
 * Make a POST call.
 * 
 * @param url The target url.
 * @param data The body data.
 */
module.exports.post = async (url, data) => {
    return await module.exports.call( {
        method : 'POST',
        url : url,
        body : data
    })
}

/**
 * Make a POST as form data call.
 * 
 * @param url The target url
 * @param data The form data.
 */
module.exports.postForm = async (url, data) => {
    return await module.exports.call( {
        method : 'POST',
        url : url,
        form : data
    })
}

/**
 * Makes a get call.
 * 
 * @param url The target url.
 */
module.exports.get = async (url) => {
    return await module.exports.call( {
        method : 'GET',
        url : url
    })
}

/**
 * Executes a http get and returns the xml parsed as object.
 * 
 * @param url The target url.
 */
module.exports.getXml = async (url) => {
    let xmlString = await module.exports.get(url);
    return xml.parseStringSync( xmlString );
}