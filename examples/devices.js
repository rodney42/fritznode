/**
 * This example shows currently connected devices as table result.
 * 
 * Try out with : node examples/devices.js
 */
const fritz = require('./../index.js');

// Helper function
const fix = (val, expected, fillup=' ') => {
    let ret = val;
    if( ret.length>expected ) {
        ret = val.substring(0, expected-3 )+'...';
    } else {
        while (ret.length<expected) ret += fillup;
    }
    return ret;
} 

run = async()=>{
    let con = await fritz.fritz();
    let devices = await con.getDeviceList();
    console.log( fix("Name", 30) + fix("IP", 20) + fix("MAC", 20) + fix("Type", 10) + fix("ID", 20)+ fix("Active", 6) + fix("Block", 6));
    console.log( fix("", 110, '-'));
    for( n=0; n<devices.length; n++ ) {
        let d = devices[n];
        console.log( 
                fix(d.name, 30) 
            + fix(d.ip, 20)
            + fix(d.mac, 20)
            + fix(d.type, 10)
            + fix(d.id, 20)
            + fix((d.active? '*' : ''), 6)
            + fix((d.blocked? '*' : ''), 6)
        );
    }
};
run();