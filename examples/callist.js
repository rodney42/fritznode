/**
 * This example shows the calllist from the overview as table result.
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
    let overview = await con.getOverview();
    console.log( fix("Name", 30) + fix("Date", 25) + fix("Time",10)+fix("Number",22) + fix("Type", 10) );
    console.log( fix("", 125, '-'));
    for( n=0; n<overview.foncalls.calls.length; n++ ) {
        let d = overview.foncalls.calls[n];
        console.log( 
              fix(d.name, 30) 
            + fix(d.date, 25)
            + fix(d.time, 10)
            + fix(d.number, 22)
            + fix(d.type, 10)
        );
    }
};
run();