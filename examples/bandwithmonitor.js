/**
 * This example shows the current bandwith usage.
 * 
 * Try out with : node examples/bandwithmonitor.js
 */
const fritz = require('./../index.js');

run = async()=>{
    let con = await fritz.fritz();
    let usage = await con.getBandwithUsage();
    console.log(JSON.stringify(usage,' ','  '));

    let factDown = ((usage.downCurrent) / usage.downMax)
    let factUp = ((usage.upCurrent) /usage.upMax )

    console.log('Download '+(factDown*100)+"   upload "+(factUp*100));

};
run();