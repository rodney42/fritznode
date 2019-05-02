const LEVEL = ['TRACE','DEBUG','INFO','WARN','ERROR']
const isEnabled = (level)=>{
    return LEVEL.indexOf(level) >= LEVEL.indexOf( (process.env.LOG_LEVEL || 'INFO' ) ) 
}
module.exports = {
    trace : (msg) =>    { if(isEnabled(LEVEL[0])) console.log('TRACE : '+msg) },
    debug : (msg) =>    { if(isEnabled(LEVEL[1])) console.log('DEBUG : '+msg) },
    info  : (msg) =>    { if(isEnabled(LEVEL[2])) console.log('INFO  : '+msg) },
    warn  : (msg) =>    { if(isEnabled(LEVEL[3])) console.log('WARN  : '+msg) },
    error : (msg) =>    { if(isEnabled(LEVEL[4])) console.log('ERROR : '+msg) }
}