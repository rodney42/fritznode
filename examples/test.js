/**
 * This example shows the execution and response of some of the provided methods.
 * 
 * Try out with : node examples/test.js
 */
 const fritz = require('./../index.js');

 run = async()=>{
    let con = await fritz.fritz();

    console.log('-- Bandwith usage --');
    let usage = await con.getBandwithUsage();
    console.log(JSON.stringify(usage,1,2));

    console.log('-- Device list --');
    let devices = await con.getDeviceList();
    console.log("Number of all devices "+devices.length);
    let names = ''; devices.forEach(d=>{ names+=d.name+', ' }); names = names.substring(0,names.length-2);
    console.log("Device names "+names);

    console.log('-- Overview --');
    let overview = await con.getOverview();
    console.log(JSON.stringify(overview,1,2));

    console.log('-- NAS --');
    let nas = await con.getNAS();
    console.log(JSON.stringify(nas,1,2));
 
 };
 run();