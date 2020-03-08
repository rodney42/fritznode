/**
 * This example shows currently connected devices.
 * 
 * Try out with : node examples/devices.js
 */
const fritz = require('./../index.js');

run = async()=>{
    let con = await fritz.fritz();
    let devices = await con.getDeviceList();
    console.log(JSON.stringify(devices,' ','  '));

};
run();