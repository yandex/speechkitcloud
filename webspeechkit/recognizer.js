window.webspeechkit.Recognizer = function(url, uuid, key, audioFormat, listener){
    var socket = new WebSocket(url);

    function sendRaw(data){
        socket.send(data);
    }

    function sendJson(json){
	sendRaw(JSON.stringify({type: 'message', data: json}));
    }

    var sessionId = null;

    $(socket)
        .bind('open', function(){
            sendJson({uuid: uuid, key: key, format: audioFormat});
        })
        .bind('message', function(e){
            var message = JSON.parse(e.originalEvent.data)

            if (message.type == 'InitResponse'){
                sessionId = message.data.sessionId;
                listener.onInit(message.data.sessionId, message.data.code)
            }
            else if (message.type == "AddDataResponse"){
                listener.onResult(message.data.text, message.data.uttr, message.data.merge);
            }
            else if (message.type == "Error"){
                console.log("Error from server " + message.data)
                listener.onError(message.data)
            }
            else {
                console.log("Unknown message format, receive this:" + message)
                listener.onError(message)
            }
        })
    var totaldata = 0;
    this.addData = function(data){
        totaldata += data.byteLength;
        if (!sessionId)
        {
            console.log("Data ingored, session not yet inited.")
            return;
        }


        sendRaw(new Blob([data], { type: audioFormat }))
    }

    this.close = function(){
        socket.close();
    }
};
