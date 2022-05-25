//Constants
const CR = "\r"
const LF = "\n"

var flash;
const led = document.getElementById("indicator_led");
function flashLed(time) {
    if (flash) clearTimeout(flash);
    led.classList.add("lit");
    flash = setTimeout(function() {
        flash = null;
        led.classList.remove("lit");
    }, time);
}

function establishProxy() {
    return new Promise(function(resolve) {
        fetch("https://api.ipify.org").then(response => response.text()).then(wan_ipv4 => {
            const proxy = new WebSocket("wss://telnet-proxy.herokuapp.com");
            proxy.onopen = function() {
                proxy.onmessage = function(message) {
                    if (message.data == "ready") {
                        proxy.onmessage = null;
                        resolve(proxy);
                    }
                }
                proxy.send("C_" + wan_ipv4 + ":12345");
            }
            //resolve(proxy);
        });
    });
}

function parseMessage(message) {
    const valid2 = ["FN"];
    const first2 = message.substring(0, 2);
    const after2 = message.substring(2);

    const valid3 = ["PWR", "MUT", "VOL"];
    const first3 = message.substring(0, 3);
    const after3 = message.substring(3);

    if (valid2.find(element => element == first2)) {
        return [first2, after2];
    }
    if (valid3.find(element => element == first3)) {
        return [first3, after3];
    }

    return [message, ""];
}

function indexToInput(i) {
    if (i == 0) {
        return "10"
    } else if (i == 1) {
        return "25"
    } else if (i == 2) {
        return "04"
    } else {
        return "10"
    }
}
function inputToIndex(i) {
    if (i == 10) {
        return 0
    } else if (i == 25) {
        return 1
    } else if (i == 04) {
        return 2
    }
}

class ToggleSwitch {
    constructor(element) {
        this.value = false;
        
        this.set = function(newValue) {
            this.value = newValue;
            if (this.value) {
                element.classList.add("on");
            } else {
                element.classList.remove("on");
            }
        }

        this.connectClick = function(click) {
            element.onclick = click;
        }
    }
}

class ButtonSwitch {
    constructor(elements) {
        this.value = null;
        
        this.set = function(newValue) {
            this.value = newValue;

            for (var i = 0; i < elements.length; i++) {
                if (i == this.value) {
                    elements[i].classList.add("on");
                } else {
                    elements[i].classList.remove("on");
                }
            }
        }

        this.connectClick = function(click) {
            for (var i = 0; i < elements.length; i++) {
                const index = i;
                elements[i].onclick = function() {
                    click(index);
                }
            }
        }
    }
}

class VolumeControl {
    constructor(slider, text, buttonDown, buttonUp) {

        this.value = 0;
        
        this.set = function(newValue) {
            this.value = newValue;

            slider.style.setProperty("--head-position", newValue/185);

            if (this.value == 0) {
                text.innerHTML = "---.-dB";
            } else {
                text.innerHTML = ((((this.value-1)/184)*92)-80).toFixed(1) + "dB";
            }
        }

        this.connectClick = function(click) {

            function callWhileHeld(elem, func) {
                elem.onclick = func;
                elem.onmousedown = function() {
                    const holdId = setInterval(func, 250);
                    elem.onmouseleave = elem.onmouseup = function() {
                        clearInterval(holdId);
                        elem.onmouseleave = elem.onmouseup = null;
                    }
                }
            }

            callWhileHeld(buttonDown, function() {
                click(-1);
            });
            callWhileHeld(buttonUp, function() {
                click(1);
            });

            /*
            buttonDown.onclick = function() {
                click(-1);
            }
            buttonUp.onclick = function() {
                click(1);
            }
            */
        }
    }
}

establishProxy().then(proxy => {
    document.getElementById("loading_screen").classList.add("hidden");

    proxy.onclose = function() {
        document.getElementById("timeout_screen").classList.remove("hidden");
    }

    function tx(command) {
        command = "S_" + command + CR;
        console.log(command);
        proxy.send(command);
    }

    function getState() {
        tx("?P");
        tx("?F");
        tx("?M");
        tx("?V");
    }

    //make components
    const powerToggle = new ToggleSwitch(document.getElementById("power_button"));
    powerToggle.connectClick(function() {
        flashLed(150);
        tx(powerToggle.value ? "PF" : "PO");

        //power updates all states so refresh
        getState();
    })

    const inputSwitches = new ButtonSwitch([document.getElementById("input_1"), document.getElementById("input_2"), document.getElementById("input_3")]);
    inputSwitches.connectClick(function(i) {
        flashLed(150);
        tx(indexToInput(i) + "FN");
    })

    const muteSwitch = new ButtonSwitch([document.getElementById("mute_button")]);
    muteSwitch.connectClick(function() {
        flashLed(150);
        tx(muteSwitch.value == null ? "MO" : "MF");
    })

    const volumeControl = new VolumeControl(
        document.getElementById("volume_slider_head"),
        document.getElementById("volume_show").getElementsByTagName("p")[0],
        document.getElementById("volume_down"),
        document.getElementById("volume_up"),
    );
    volumeControl.connectClick(function(delta) {
        flashLed(150);
        tx(delta == 1 ? "VU" : "VD");
    })

    getState();

    proxy.onmessage = function(messages) {
        messageList = messages.data.split(LF);
        messageList.forEach(message => {
            if (message != "") {
                let [keyword, data] = parseMessage(message);

                switch(keyword) {
                    
                    case "PWR":
                        powerToggle.set(data == 0);
                        break;

                    case "FN":
                        inputSwitches.set(inputToIndex(data));
                        break;

                    case "MUT":
                        muteSwitch.set(data == 0 ? 0 : null);
                        break;

                    case "VOL":
                        volumeControl.set(data);
                        break;

                    default:
                        console.log("Unhandled message: %s", keyword);
                }
            }
        });
    }
})