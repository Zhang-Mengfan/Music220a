// Temporary patch until all browsers support unprefixed context.
window.AudioContext = window.AudioContext || window.webkitAudioContext;

// init() once the page has finished loading.
window.onload = init;

var context;
var buffer;
var convolver;
var panner;
var source = null;
var dryGainNode;
var wetGainNode;
var PlaybackRate;
var AmbienceGain;
var CutoffFreq;
var lowFilter;

var gProjection = 0;

var x = 0;
var y = 0;
var z = 0;

var bufferList;

var fileCount = 8;
var fileList = [
    "./fillin.wav",
    "./piano.wav",
    "./guitar1.wav",
    "./guitar2.wav",
    "./waves.wav",
    "./cauldron.wav",
    "./ticking.wav",
    "./breakbeat.wav",
];

var kInitialReverbLevel = 0.5;

function setReverbImpulseResponse(url) {
    // Load impulse response asynchronously
    var request = new XMLHttpRequest();
    request.open("GET", url, true);
    request.responseType = "arraybuffer";

    request.onload = function() {
        context.decodeAudioData(
            request.response,
            function(buffer) {
                convolver.buffer = buffer;
            },

            function(buffer) {
                console.log("Error decoding impulse response!");
            }
        );
    }

    request.send();
}

function mixToMono(buffer) {
    if (buffer.numberOfChannels == 2) {
        var pL = buffer.getChannelData(0);
        var pR = buffer.getChannelData(1);
        var length = buffer.length;
        
        for (var i = 0; i < length; ++i) {
            var mono = 0.5 * (pL[i] + pR[i]);
            pL[i] = mono;
            pR[i] = mono;
        }
    }
}

function startPlaying(i) {
    if (source)
        source.stop();
     source = context.createBufferSource();
     source.buffer = bufferList[i];
     source.connect(lowFilter);
     source.playbackRate.value = 1.0;
     source.loop = true;
     source.start();
}

function setAudioSource(i) {
    var buffer = bufferList[i];

    // See if we have cached buffer
    if (buffer) {
        source.buffer = buffer;
    } else {
        // Load asynchronously
        var url = fileList[i];

        var request = new XMLHttpRequest();
        request.open("GET", url, true);
        request.responseType = "arraybuffer";

        request.onload = function() {
            context.decodeAudioData(
                request.response,
                function(buffer) {
                    mixToMono(buffer);
                    bufferList[i] = buffer;  // cache it
                    startPlaying(i);
                },

                function(buffer) {
                    console.log("Error decoding audio source data!");
                }
            );
        }

        request.send();
    }
}

function playbackHandler(event, ui) {
    var rate = ui.value;
    var info = document.getElementById("playback-value");
    info.innerHTML = "Playback Rate = " + rate;
    PlaybackRate = rate;
    
    // Draw canvasSmall
    var widthSmall = canvasSmall.width;
    var heightSmall = canvasSmall.height;
    
    var ctxSmall = canvasSmall.getContext('2d');
    ctxSmall.globalAlpha = 0.2;
            
    for(var i=1;i<=20;i=i+2) {

        ctxSmall.fillStyle = 'rgb(' + 100+(i*10) + ',' + Math.floor((PlaybackRate/4.0)*255) + ',' + Math.floor((AmbienceGain/1.0)*255) + ')';

        ctxSmall.beginPath();
        var rC = Math.floor((CutoffFreq/22050)*30);
    ctxSmall.arc(widthSmall/2+(Math.floor(Math.random()*50)+1),heightSmall/2+(Math.floor(Math.random()*50+1)), rC/2+i, 0, Math.PI*2, false);
                                                                                
        ctxSmall.fill();
        ctxSmall.closePath();
    }

    if (source)
        source.playbackRate.value = rate;
}

function reverbHandler(event, ui) {
    var value = ui.value;
    var info = document.getElementById("ambience-value");
    info.innerHTML = "Ambience = " + value;
    AmbienceGain = value;
    
    // Draw canvasSmall
    var widthSmall = canvasSmall.width;
    var heightSmall = canvasSmall.height;
    
    var ctxSmall = canvasSmall.getContext('2d');
    ctxSmall.globalAlpha = 0.2;
            
    for(var i=1;i<=20;i=i+2) {

        ctxSmall.fillStyle = 'rgb(' + 100+(i*10) + ',' + Math.floor((PlaybackRate/4.0)*255) + ',' + Math.floor((AmbienceGain/1.0)*255) + ')';

        ctxSmall.beginPath();
        var rC = Math.floor((CutoffFreq/22050)*30);
    ctxSmall.arc(widthSmall/2+(Math.floor(Math.random()*50)+1),heightSmall/2+(Math.floor(Math.random()*50+1)), rC/2+i, 0, Math.PI*2, false);
                                                                                
        ctxSmall.fill();
        ctxSmall.closePath();
    }

    if (wetGainNode)
        wetGainNode.gain.value = value;
}

function cutoffHandler(event, ui) {
    var value = ui.value;
    var noctaves = Math.log(22050.0 / 40.0) / Math.LN2;
    var v2 = Math.pow(2.0, noctaves * (value - 1.0));

    var sampleRate = 44100.0;
    var nyquist = sampleRate * 0.5;
    var frequency = Math.round(v2 * nyquist);
    var info = document.getElementById("cutoff-value");
    CutoffFreq = frequency;

    info.innerHTML = "Cutoff Frequency = " + frequency + " Hz";

    if (lowFilter)
        lowFilter.frequency.value = frequency;
}

function addSliders() {
    configureSlider("playback", 1.0, 0.1, 4.0, playbackHandler);
    configureSlider("ambience", kInitialReverbLevel, 0.0, 1.0, reverbHandler);
    configureSlider("cutoff", 1.0, 0.0, 1.0, cutoffHandler);
}

function getAbsolutePosition(element) {
  var r = { x: element.offsetLeft, y: element.offsetTop };
  if (element.offsetParent) {
    var tmp = getAbsolutePosition(element.offsetParent);
    r.x += tmp.x;
    r.y += tmp.y;
  }
  return r;
};


function getRelativeCoordinates(eventInfo, opt_reference) {
    var x, y;
    var event = eventInfo.event;
    var element = eventInfo.element;
    var reference = opt_reference || eventInfo.element;
    if (!window.opera && typeof event.offsetX != 'undefined') {
      // Use offset coordinates and find common offsetParent
      var pos = { x: event.offsetX, y: event.offsetY };
      // Send the coordinates upwards through the offsetParent chain.
      var e = element;
      while (e) {
        e.mouseX = pos.x;
        e.mouseY = pos.y;
        pos.x += e.offsetLeft;
        pos.y += e.offsetTop;
        e = e.offsetParent;
      }
      // Look for the coordinates starting from the reference element.
      var e = reference;
      var offset = { x: 0, y: 0 }
      while (e) {
        if (typeof e.mouseX != 'undefined') {
          x = e.mouseX - offset.x;
          y = e.mouseY - offset.y;
          break;
        }
        offset.x += e.offsetLeft;
        offset.y += e.offsetTop;
        e = e.offsetParent;
      }
      // Reset stored coordinates
      e = element;
      while (e) {
        e.mouseX = undefined;
        e.mouseY = undefined;
        e = e.offsetParent;
      }
    } else {
      // Use absolute coordinates
      var pos = getAbsolutePosition(reference);
      x = event.pageX - pos.x;
      y = event.pageY - pos.y;
    }
    // Subtract distance to middle
    return { x: x, y: y };
  };

  
  function configureSlider(name, value, min, max, handler) {
      // var controls = document.getElementById("controls");
      //

      var divName = name + "Slider";

      var slider = document.getElementById(divName);

      slider.min = min;
      slider.max = max;
      slider.value = value;
      slider.oninput = function() { handler(0, this); };
      // Run the handler once so any additional text is displayed.
      handler(0, {value: value});
  }

/**
 * Start panning demo
 */
 function init() {
     addSliders();

     var canvas = document.getElementById('canvasID');
     var canvasSmall = document.getElementById('canvasSmall');
     var clearButton = document.querySelector('#clear-canvas');

     var ctx = canvas.getContext('2d');
     var ctxSmall = canvasSmall.getContext('2d');
     
     gProjection = new Projection('canvasID', 0);
     gSmallProjection = new Projection('canvasSmall', 0);

     // draw center
     var width = canvas.width;
     var height = canvas.height;

     canvas.addEventListener("mousedown", handleMouseDown, true);
     canvas.addEventListener("mousemove", handleAzimuthMouseMove, true);
     canvas.addEventListener("mouseup", handleMouseUp, true);
     clearButton.addEventListener('click', handleBlankCanvas, {once: true});

     // Initialize audio
     context = new AudioContext();

     dryGainNode = context.createGain();
     wetGainNode = context.createGain();
     panner = context.createPanner();
     panner.panningModel = "HRTF";
     panner.distanceModel = "exponential";

     lowFilter = context.createBiquadFilter();
     lowFilter.frequency.value = 22050.0;
     lowFilter.Q.value = 5.0;

     convolver = context.createConvolver();

     // Connect audio processing graph
     lowFilter.connect(panner);

     // Connect dry mix
     panner.connect(dryGainNode);
     dryGainNode.connect(context.destination);
     
     // Connect wet mix
     panner.connect(convolver);
     convolver.connect(wetGainNode);
     wetGainNode.connect(context.destination);
     wetGainNode.gain.value = kInitialReverbLevel;
     
     bufferList = new Array(fileCount);
     for (var i = 0; i < fileCount; ++i) {
         bufferList[i] = 0;
     }

     setReverbImpulseResponse('impulse-responses/s3_r4_bd.wav');

     panner.setPosition(0, 0, 0);

     // Load up initial sound
     setAudioSource(0);

     var cn = {x: 0.0, y: 0};
     gProjection.drawDotNormalized(cn);
     gSmallProjection.drawDotNormalized(cn);
 }

var gIsMouseDown = false;

function Projection(canvasID, type) {
    this.canvasID = canvasID;
    this.canvas = document.getElementById(canvasID);
    this.type = type;
}

// With normalized graphics coordinate system (-1 -> 1)
Projection.prototype.drawDotNormalized = function(cn) {
    var c = {
        x: 0.5 * (cn.x + 1.0) * this.canvas.width,
        y: 0.5 * (cn.y + 1.0) * this.canvas.height
    }
    
    this.drawDot(c);
}

Projection.prototype.handleMouseMove = function(event, suppressY) {
    if (gIsMouseDown) {
        var eventInfo = {event: event, element:this.canvas};
        var c = getRelativeCoordinates(eventInfo);
        if (suppressY) {
            c.y = this.lastY;
        }
        this.drawDot(c);
    }
}

Projection.prototype.drawDot = function(c) {
    var canvas = this.canvas;
    var type = this.type;
    
    var ctx = canvas.getContext('2d');
    ctx.globalAlpha = 0.2;

    for(var i=1;i<=15;i=i+2) {

        ctx.fillStyle = 'rgb(' + 100+(i*10) + ',' + Math.floor((PlaybackRate/4.0)*255) + ',' + Math.floor((AmbienceGain/1.0)*255) + ')';

        ctx.beginPath();
        //console.log(PlaybackRate);
        var rC = Math.floor((CutoffFreq/22050)*30);
        //console.log(AmbienceGain);
    ctx.arc(c.x+(Math.floor(Math.random()*50)+1),c.y+(Math.floor(Math.random()*50+1)), rC/2+i, 0, Math.PI*2, false);
                                                                                
        ctx.fill();
        ctx.closePath();
    }
   
    var clearButton = document.querySelector('#clear-canvas');
    clearButton.addEventListener('click', handleBlankCanvas, {once: true});
                 
    var width = canvas.width;
    var height = canvas.height;
    divWidth = width;
    divHeight = height;

    var a = c.x / divWidth;
    var b = c.y / divHeight;

    x = 8.0 * (2.0*a - 1.0);

    if (type == 0) {
        z = 8.0 * (2.0*b - 1.0);
    } else {
        y = -11.0 * (2.0*b - 1.0);
    }

    panner.setPosition(x, y, z);
}

function handleMouseDown(event) {
    gIsMouseDown = true;
}

function handleMouseUp(event) {
    gIsMouseDown = false;
}

function handleAzimuthMouseMove(event) {
    gProjection.handleMouseMove(event, false);
}

function handleBlankCanvas(event) {
    var canvas = document.getElementById('canvasID');
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}
