/**
 * Fritz.box access using lua scripting.
 */
const http = require('./lib/http.js');
const log = require('./lib/log.js');
const crypto = require('crypto');
const { allowedNodeEnvironmentFlags } = require('process');

module.exports.fritz = async (opt) => {
    let context = {
        user : (opt?opt.user:null) || process.env.FRITZ_USER,
        password : (opt?opt.password:null) || process.env.FRITZ_PASSWORD,
        host : (opt?opt.host:null) || process.env.FRITZ_HOST || 'fritz.box'
    }
    if( !context.password ) {
        throw new Error('A password must be set. If not set by the options, you can use the FRITZ_PASSWORD environment variable.')
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

    //Calculate the response for a given challenge via PBKDF2
    calculate_pbkdf2_response = (challenge,password) => {
        challenge_parts = challenge.split('$');
        // Extract all necessary values encoded into the challenge
        iter1 = parseInt(challenge_parts[1]);
        salt1 = Buffer.from(challenge_parts[2],'hex');
        iter2 = parseInt(challenge_parts[3]);
        salt2 = Buffer.from(challenge_parts[4],'hex');
        // Hash twice, once with static salt...
        hash1 = crypto.pbkdf2Sync(Buffer.from(password, 'utf8'), salt1, iter1, 32, 'sha256');
        // Once with dynamic salt.
        hash2 = crypto.pbkdf2Sync(hash1, salt2, iter2, 32, 'sha256');
        return challenge_parts[4]+'$'+hash2.toString('hex');
    }

    log.info("Login "+context.user+"@"+context.host+ " ... ");

    // Get a challenge
    let loginResult = await http.getXml(createPath('login_sid.lua',{version:2}));
    log.debug("Login result "+JSON.stringify(loginResult,2,2));
    let challenge = ''+loginResult.SessionInfo.Challenge;
    let user = context.user;
    if( !user ) {
        // If user is not set, get the fritz genarated admin user
        try {
            user = loginResult.SessionInfo.Users[0].User[0]['_'];
        } catch(e) {
            throw new Error('Failed to extract fritz admin user.'+e+'. Please try to set FRITZ_USER enviroment.');
        }
    }

    let challengeResolved;
    
    if( challenge[0]=='2' ) {
        // Resolve pbkdf2 challange
        challengeResolved = calculate_pbkdf2_response(challenge,context.password);
    } else {
        // Resolve md5 challenge for older versions
        let buffer = Buffer.from(challenge + '-' + context.password, 'UTF-16LE');
        challengeResolved = challenge + '-' + crypto.createHash('md5').update(buffer).digest('hex');
    }
    
    log.debug("challengeResolved "+challengeResolved);

    let challengeResponse = await http.getXml(
        createPath('/login_sid.lua', { username : user, response: challengeResolved })
    )

    log.debug("challengeResponse "+JSON.stringify(challengeResponse,2,2));

    // Get the session ID.
    context.sid = ''+challengeResponse.SessionInfo.SID;
  
    // Check SID
    if (context.sid === '0000000000000000') {
      throw new Error('Login to Fritz!Box at '+context.host+' with user '+user+' failed. Invalid login?')
    }

    log.info("Session ID "+context.sid);
    log.info("Login "+user+"@"+context.host+ " ... done.");

    const createDevice = (raw, active) => {
        return {
            id : raw.UID,
            mac : raw.mac,
            type : raw.type,
            name : raw.name,
            active : active,
            ip : raw.ipv4 || raw.ipv6,
            port : raw.port,
            state : raw.state,
            blocked : raw.state == 'globe_notallowed'
        }
    }
    
    return {
        sid : context.sid,
        getDeviceList : async ()=>{
            log.info("Get device list");
            let data = await http.postForm(createPath('data.lua'), {
                sid : context.sid,
                xhrId: 'all',
                xhr: 1,
                page : 'netDev'
            });
            let dataObj = JSON.parse(data);
            const devices = [];
            dataObj.data.active.forEach( (d) => {
              devices.push( createDevice(d, true) );
            });
            dataObj.data.passive.forEach( (d) => {
              devices.push( createDevice(d, false) );
            });
            return devices;
        },
        getDeviceDetails : async (deviceid)=>{
            log.info("Get details for device "+deviceid);
            let data = await http.postForm(createPath('data.lua'), {
                sid : context.sid,
                xhrId: 'all',
                xhr: 1,
                page : 'edit_device',
                dev: deviceid
            });
            return {
                id:     data.vars.dev.UID,
                mac:    data.vars.dev.mac,
                name:   data.vars.dev.name.displayName,
                blocked: data.vars.dev.netAccess.kisi.isDeviceBlocked
            }
        },
        toggleDeviceBlockState : async (deviceid)=>{
            log.info("Toggle block for device "+deviceid);
            let payload = {
                sid : context.sid,
                xhr: 1,
                dev: deviceid,
                block_dev: '',
                page: 'edit_device',
                xhr: 1,
                back_to_page: 'netDev',
                lang: 'de'
            }
            /*if( blocked ) {   // This does not work - only toggle seems possible
                payload.kisi_profile='filtprof1'   // always filtprof1?  
            }*/
            let data = await http.postForm(createPath('data.lua'), payload);
            return true;
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
                downCurrent : dataObj[0].ds_bps_curr[0]*8,
                upMax : dataObj[0].upstream,
                upCurrent : dataObj[0].us_default_bps_curr[0]*8
            }
        }, 
        getOverview : async ()=>{
            let data = await http.postForm(createPath('data.lua'), {
                sid : context.sid,
                page : 'overview'
            });
            let dataObj = JSON.parse(data).data;
            log.info("Overview list : "+JSON.stringify(dataObj,2,2));
            return {
                powerConsumption : parseInt(dataObj.fritzos.energy),
                osVersion : dataObj.fritzos.nspver,
                netDevicesCount : dataObj.net.active_count,
                wanConnected : dataObj.wan.led == 'led_green' ? true : false,
                dslConnected : dataObj.dsl.led == 'led_green' ? true : false,
                wlanConnected : dataObj.wlan.led == 'led_green' ? true : false,
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