###Quickstart
####Get API key
First of all you will need to get API key for Yandex.SpeechKit.
To do this go [here](https://developer.tech.yandex.ru) and get an API key for Yandex SpeechKit.

####Add dependecies to your web page
Add Yandex.SpeechKit Web scripts from Yandex CDN to your web page:

`<script type="text/javascript" src="//download.yandex.ru/webspeechkit/webspeechkit-1.0.0.js"></script>`
`<script type="text/javascript" src="//download.yandex.ru/webspeechkit/webspeechkit-settings.js"></script>`

####Use API to create wonderful voice interfaces
Write some code for speech recognition logic.
For example, if you need to simply recognize short voice requests than you'll need to write something like this:

```
window.onload = function() {
    ya.speechkit.recognize({
        doneCallback: function (text) {
            console.log("You've said: " + text);
        },
        initCallback: function () {
            console.log("You may speak now");
        },
        errorCallback: function (err) {
            console.log("Something gone wrong: " + err);
        },
        model: 'freeform', // Model name for recognition process
        lang: 'ru-RU', //Language for recognition process
        apiKey: PUT_YOUR_API_KEY_HERE
    });
};
```

Simple synthesis:

```
window.onload = function() {
    var tts = ya.speechkit.Tts(
        {
            speaker: 'jane',
            emotion: 'good',
            gender: 'female'
        });
    tts.speak('1 2 3');
};
```
