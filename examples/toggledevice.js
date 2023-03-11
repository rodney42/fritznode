/**
 * In this example a device is blocked or unblocked from the internet access.
 * 
 * Try out with : node examples/toggledevice.js MyDeviceName
 */
 const fritz = require('./../index.js');

 run = async()=>{
    if( process.argv.length<=2 ) {
        console.info("Expecting a device name as program argument");
        process.exit(2);
    }
    let devicename = process.argv[2];
    let con = await fritz.fritz();
    let devices = await con.getDeviceList();
    let deviceFound = false;
    for( n=0; n<devices.length; n++ ) {
        let d = devices[n];
        if( d.name.startsWith(devicename) ) {
        deviceFound= true;
        if( d.blocked ) {
                console.log('Unblocking device '+d.name+' with id '+d.id+' that is currently blocked.');
                let ret = await con.unblockDevice(d.id);
                if( ret ) {
                    console.log("Successfully unblocked device : "+d.name);
                }
        } else {
                console.log('Blocking device : '+d.name+' with id '+d.id+' that is currently not blocked.');
                let ret = await con.blockDevice(d.id);
                if( ret ) {
                    console.log("Successfully blocked device : "+d.name);
                }
        }
        }
    }
    if(!deviceFound) {
        console.info("A device with name "+devicename+" was not found");
        process.exit(1);
    }
    process.exit(0);
 };
 run();