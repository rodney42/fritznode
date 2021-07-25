Fritz Node
======================================
Uses node.js to access the fritz box with a minimal set of external dependencies. 
 

API calls provided
------------------

- getDeviceList

Returns active and inactive network devices known to the box.

- getBandwithUsage

Returns the current download and upload rate.

- toggleDeviceBlockState

Blocks or unblocks the device internet access.

Example:
```javascript
run = async()=>{
    let con = await module.exports.fritz({
        password : 'secret'
    });
    let usage = await con.getBandwithUsage();
    console.log(JSON.stringify(usage,' ','  '));
};
run();
```

Produces
```json
{
  "downMax": 24331000,
  "downCurrent": 27240,
  "upMax": 4899000,
  "upCurrent": 6693
}
```


Environment variables supported
-------------------------------

| Name       | Description | Default
|------------|-------------|---------
| FRITZ_HOST | Fritz box host name or IP. | fritz.box
| FRITZ_USER | Fritz user name. | Defaults to fritz generated admin user
| FRITZ_PASSWORD | Fritz box password. 
| LOG_LEVEL | Console log level. Supported are TRACE,DBEUG,INFO,WARN, ERROR | INFO