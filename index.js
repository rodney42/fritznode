const http = require('./lib/http.js');
const log = require('./lib/log.js');

module.exports.fritz = async (opt) => {
    let context = {
        user : opt.user || process.env.FRITZ_USER || 'admin',
        password : opt.password || process.env.FRITZ_PASSWORD,
        host : opt.host || process.env.FRITZ_HOST || 'fritz.box'
    }
    if( !context.password ) {
        throw new Error('A password must be set.')
    }
    var createPath = (action,params) => {
        let url = 'http://'+context.host;
        url+='/'+action;
        if( params || context.sid ) {
            url += '?';
            for( key in params ) {
                if(url.slice(-1)!='?') url += '&';
                url += (key +'='+ encodeURIComponent(params[key]));
            }
            if( context.sid ) {
                if(url.slice(-1)!='?') url += '&';
                url += 'sid='+context.sid;
            }
        }
        return url;
    }

    log.info("Login "+context.user+"@"+context.host+ " ... ");

    // Get a challenge
    let loginResult = await http.getXml(createPath('login_sid.lua'));
    let challenge = loginResult.SessionInfo.Challenge;
    
    log.debug("Challenge "+challenge);

    // Resolve the challenge
    let buffer = Buffer.from(challenge + '-' + context.password, 'UTF-16LE')
    let challengeResolved = challenge + '-' + require('crypto').createHash('md5').update(buffer).digest('hex')
    let challengeResponse = await http.getXml(
        createPath('/login_sid.lua', { username : context.user, response: challengeResolved })
    )

    // Get the session ID.
    context.sid = challengeResponse.SessionInfo.SID;
  
    // Check SID
    if (context.sid === '0000000000000000') {
      throw new Error('Login to Fritz!Box at '+host+' with user '+user+' failed. Invalid login?')
    }

    log.debug("Session ID "+context.sid);

    log.info("Login "+context.user+"@"+context.host+ " ... done.");
    
    return {
        sid : context.sid,
        getDeviceList : async ()=>{
            let data = await http.postForm(createPath('data.lua'), {
                sid : context.sid,
                page : 'netDev'
            });
            let dataObj = JSON.parse(data);
            const createDevice = (raw, active) => {
                return {
                    mac : raw.mac,
                    name : raw.name,
                    active : active,
                    ip : raw.ipv4 || raw.ipv6,
                    port : raw.port
                }
            }
            const devices = [];
            dataObj.data.active.forEach( (d) => {
              devices.push( createDevice(d, true) );
            });
            dataObj.data.passive.forEach( (d) => {
                devices.push( createDevice(d, false) );
              });
              return devices;
        },
        getBandwithUsage: async() => {
            let data = await http.get(createPath('/internet/inetstat_monitor.lua',
                {   action:'get_graphic',
                    xhr:1,
                    myXhr:1,
                    useajax:1
                })
            );
            let dataObj = JSON.parse(data);
            return {
                downMax : dataObj[0].downstream,
                downCurrent : dataObj[0].ds_bps_curr_max,
                upMax : dataObj[0].upstream,
                upCurrent : dataObj[0].us_bps_curr_max
            }
        }, 
        getOverview : async ()=>{
            let data = await http.postForm(createPath('data.lua'), {
                sid : context.sid,
                page : 'overview'
            });
            let dataObj = JSON.parse(data).data;
            return {
                powerConsumption : parseInt(dataObj.fritzos.energy),
                osVersion : dataObj.fritzos.nspver,
                netDevicesCount : dataObj.net.active_count,
                wanConnected : dataObj.wan.led == 'led_green' ? true : false,
                dslConnected : dataObj.dsl.led == 'led_green' ? true : false,
                wlan5ghzEnabled : dataObj.wlan5GHzScnd.led == 'led_green' ? true : false,
                wlan24ghzEnabled : dataObj.wlan24GHz.led == 'led_green' ? true : false,
            }
        },
        getNAS : async ()=>{
            let data = await http.get(createPath('nas/api/data.lua', {
                path : '/',
                limit : 100,
                c : 'files',
                a : 'browse'
            }));
            let dataObj = JSON.parse(data);
            return {
                diskUsed : dataObj.diskInfo.used,
                diskTotal : dataObj.diskInfo.total,
                diskFree : dataObj.diskInfo.free,
                writeRight : dataObj.writeRight,
            }
        } 
    }
}