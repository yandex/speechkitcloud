###Quickstart
####Get API key
First of all you will need to get API key for Yandex.SpeechKit.
To do this go [here](https://developer.tech.yandex.ru) and get an API key for Yandex SpeechKit.

####Add dependecies to your web page
Add Yandex.SpeechKit Web scripts from Yandex CDN to your web page:  
_&lt;script type="text/javascript" src="//download.yandex.ru/webspeechkit/webspeechkit-1.0.0.js"&gt;&lt;/script&gt;_   

####Use API to create wonderful voice interfaces
Write some code for speech recognition logic.  
For example, if you need to simply recognize short voice requests than you'll need to write something like this:  
ya.speechkit.recognize({  
&nbsp;&nbsp;doneCallback: function(text) {  
&nbsp;&nbsp;&nbsp;&nbsp;console.log("You've said: " + text);  
&nbsp;&nbsp;},  
&nbsp;&nbsp;&nbsp;&nbsp;initCallback: function () {  
&nbsp;&nbsp;&nbsp;&nbsp;console.log("You may speak now");  
&nbsp;&nbsp;},  
&nbsp;&nbsp;errorCallback: function(err) {  
&nbsp;&nbsp;&nbsp;&nbsp;console.log("Something gone wrong: " + err);  
&nbsp;&nbsp;},  
&nbsp;&nbsp;model: 'freeform', // Model name for recognition process  
&nbsp;&nbsp;lang: 'ru-RU', //Language for recognition process  
&nbsp;&nbsp;apiKey: PUT_YOUR_API_KEY_HERE,
});_
