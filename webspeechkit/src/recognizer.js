(function(webspeechkit){
    webspeechkit.Recognizer = function(url, listener, options){
        this.url = url;
        
        this.listener = listener || {onInit: function(){}, onResult: function(){}, onError: function(){}};
        
        // {uuid: uuid, key: key, format: audioFormat, punctuation: punctuation}
        this.options = options;
        
        this.sessionId = null;
        this.socket = null;

        this.buffered = [];
        this.totaldata = 0;
    }
    
    webspeechkit.Recognizer.prototype = {

        sendRaw: function(data){
            if (this.socket)
                this.socket.send(data);
        }
        ,
        sendJson: function(json){        
	    this.sendRaw(JSON.stringify({type: 'message', data: json}));
        }
        ,    
        start: function() {
            this.socket = new WebSocket(this.url);

            this.socket.onopen = function(){
                // {uuid: uuid, key: key, format: audioFormat, punctuation: punctuation}
                this.sendJson(this.options);
            }.bind(this);

            this.socket.onmessage = function(e){
                var message = JSON.parse(e.data)

                if (message.type == 'InitResponse'){
                    this.sessionId = message.data.sessionId;
                    this.listener.onInit(message.data.sessionId, message.data.code)
                }
                else if (message.type == "AddDataResponse"){
                    this.listener.onResult(message.data.text, message.data.uttr, message.data.merge);
                }
                else if (message.type == "Error"){
                    this.listener.onError("Session " + this.sessionId + ": " + message.data);
                    this.close();
                }
                else {
                    this.listener.onError("Session " + this.sessionId + ": " + message);
                    this.close();
                }
            }.bind(this);

            this.socket.onerror = function(error) {
                this.listener.onError("Socket error: " + error.message);
            }.bind(this);

            this.socket.onclose = function(event) {
            }.bind(this);
        }
        ,
        addData: function(data){
            this.totaldata += data.byteLength;
        
            if (!this.sessionId) {
                this.buffered.push(data);
                return;
            }

            for (var i=0; i<this.buffered.length; i++){
                this.sendRaw(new Blob([this.buffered[i]], { type: this.options.format }))
                this.totaldata += this.buffered[i].byteLength;
            }

            this.buffered = [];
            this.sendRaw(new Blob([data], { type: this.options.format }))
        }
        ,
        close: function(){
            this.listener = {onInit: function(){}, onResult: function(){}, onError: function(){}};
            if (this.socket)
                this.socket.close();
            this.socket = null;
        }
    };
}(window.webspeechkit));
