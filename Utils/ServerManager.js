const client = require('./websocket');
const md5 = require("md5-node");
const helper = require('./PackHelper');
const { AESdecrypt } = require('./AES');
const logger = new NIL.Logger('ServerManager');
NIL.EventManager.addEvent('MAIN','onWebsocketConnected');
NIL.EventManager.addEvent('MAIN','onWebsocketClosed');
NIL.EventManager.addEvent('MAIN','onWebsocketReceived');
NIL.EventManager.addEvent('MAIN','onWebsocketError');

let cfg = JSON.parse(NIL.IO.readFrom('./Data/servers.json'));

NIL.SERVERS = new Map();

/** 
* 生成一个GUID
* @returns GUID
*/
function GUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0,
            v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

let callbacks = {};

class SERVER {
    constructor(url,name,pwd){
        this._k = md5(pwd).substring(0,16).toUpperCase();
        this._iv = md5(pwd).substring(16,32).toUpperCase();
        console.log(this._iv,this._k);
        this._url = url;
        this._name = name;
        this._ws = new client(url,name,onmessage(name,this._k,this._iv));
    }
    get _ifConnect(){
        return this._ws.ifAlive;
    }
    get k(){
        return this._k;
    }
    get iv(){
        return this._iv;
    }
    sendCMD(cmd,callback){
        console.log(`cmd ${cmd} send`);
        let id = GUID();
        this._ws.send(helper.GetRuncmdPack(this._k,this._iv,cmd,id));
        callbacks[id] = callback;
    }
    sendStart(){
        this._ws.send(helper.GetStartPack(this._k,this._iv))
    }
    sendStop(){
        this._ws.send(helper.GetStopPack(this._k,this._iv));
    }
    sendText(text){
        this._ws.send(helper.GetSendTextPack(this._k,this._iv,text));
    }
}

function onmessage(name,k,iv){
    return (data)=>{
        NIL.EventManager.on('onWebsocketReceived',{server:name,message:AESdecrypt(k,iv,JSON.parse(data).params.raw)});
    }
}

NIL.EventManager.listen('MAIN','onWebsocketReceived',(dt)=>{
    logger.info(dt.message);
    let data = JSON.parse(dt.message);
    if(callbacks[data.params.id] != undefined){
        callbacks[data.params.id](data.params.result);
        delete callbacks[data.params.id];
    }
});

for(let ser in cfg){
    NIL.SERVERS.set(ser,new SERVER(cfg[ser].url,ser,cfg[ser].pwd));
}