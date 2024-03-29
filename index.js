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
            user = loginResult.SessionInfo.Users[0].User[0]['_']; // The users are a mixed list of string or object
            if(!user) {
                user = loginResult.SessionInfo.Users[0].User[0];
            }
            log.info("Admin user name is determined as "+user);
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
            ip : (raw.ipv4 ? raw.ipv4.ip : (raw.ipv6 ? raw.ipv6.ip : null)),
            ipv4 : (raw.ipv4 ? true : false),
            ipv6 : (raw.ipv6 ? true : false),
            blocked : raw.state.class == 'globe_notallowed',
        }
    }
    const fritzHandler = {
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
        getDeviceDetails : async (deviceId)=>{
            log.info("Get device details for id "+deviceId);
            let data = await http.postForm(createPath('data.lua'), {
                sid : context.sid,
                xhrId: 'all',
                dev: deviceId,
                xhr: 1,
                page : 'edit_device'
            });
            let dataObj = JSON.parse(data).data.vars.dev;
            let resp = {
                id : dataObj.UID,
                mac : dataObj.mac,
                name : dataObj.name.dnsName,
                active : dataObj.state == 'ONLINE',
                port : dataObj.devType
            }
            let topologyArray = dataObj.topology.path.path;
            if( topologyArray && topologyArray.length>0 ){
                resp.user = topologyArray[topologyArray.length-1].device.user_UIDs;
            } else {
                log.warn("No toplogy entries found");
            }
            return resp;
        },
        blockDevice : async (deviceId)=>{
            log.info("Blocking device "+deviceId);
            let payload = {
                xhr: 1,
                sid : context.sid,
                blocked: true,
                toBeBlocked: deviceId,
                page: 'kidLis'
            }
            let data = await http.postForm(createPath('data.lua'), payload);
            let dataObj = JSON.parse(data).data;
            return dataObj.toBeBlocked === 'ok';
        },
        unblockDevice : async (deviceId)=>{
            log.info("Unblocking device "+deviceId);
            // We have to get the device details to get the device user id - the deviceid alone does not work
            let deviceDetails = await fritzHandler.getDeviceDetails(deviceId);
            let userId = deviceDetails.user;
            log.info("Device with id "+deviceId+" has user id "+userId);
            let payload = {
                xhr: 1,
                sid : context.sid,
                blocked : false,
                toBeBlocked: userId,
                page: 'kidLis'
            }
            let data = await http.postForm(createPath('data.lua'), payload);
            let dataObj = JSON.parse(data).data;
            return dataObj.toBeBlocked === 'ok';
        },
        getBandwithUsage: async() => {
            let data =  await http.postForm(createPath('data.lua'), {
                sid : context.sid,
                page : 'netMoni'
            });
            let dataObj = JSON.parse(data);
            let syncGroup = dataObj.data.sync_groups[0];
            return {
                downMax : syncGroup.downstream,
                downCurrent : syncGroup.ds_bps_curr[0]*8,
                upMax : syncGroup.upstream,
                upCurrent : syncGroup.us_default_bps_curr[0]*8
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
                wanConnected : dataObj.wan.led == 'led green' ? true : false,
                dslConnected : dataObj.dsl.led == 'led green' ? true : false,
                wlanConnected : ( dataObj.wlan[0] && dataObj.wlan[0].led) == 'led green' ? true : false,
            }
        },
        getNAS : async ()=>{
            let data = await http.get(createPath('nas/api/data.lua', {
                path : '/',
                limit : 100,
                sorting : '+filename',
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
    return fritzHandler;
}