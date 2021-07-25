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
    // Example how to block/unblock a device
    /*for( n=0; n<devices.length; n++ ) {
        let d = devices[n];
        if( d.name.startsWith('MyDevice') ) {
            console.log('Unblocking device : '+d.name+' with id '+d.id);
            let ret = await con.changeDeviceBlockState(d.id);
        }
    }*/
};
run();