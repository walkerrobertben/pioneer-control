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

    const valid3 = ["PWR"];
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

establishProxy().then(proxy => {
    document.getElementById("loading_screen").classList.add("hidden");

    function tx(command) {
        command = "S_" + command + CR;
        console.log(command);
        proxy.send(command);
    }

    //make components
    const powerToggle = new ToggleSwitch(document.getElementById("power_button"));
    powerToggle.connectClick(function() {
        flashLed(150);
        tx(powerToggle.value ? "PF" : "PO");
    })

    const inputSwitches = new ButtonSwitch([document.getElementById("input_1"), document.getElementById("input_2"), document.getElementById("input_3")]);
    inputSwitches.connectClick(function(i) {
        flashLed(150);
        tx(indexToInput(i) + "FN");
    })

    //fetch latest info
    tx("?P");
    tx("?F");

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

                    default:
                        console.log("Unhandled message: %s", keyword);
                }
            }
        });
    }
})



/*
//Creates a command processor queue
function CreateCommandQueue(proxy) {
    var isProcessing = false;
    var command_queue = [];

    function Process() {
        if (isProcessing) return;
        isProcessing = true;

        let command, replyHandler;
        [command, replyHandler] = command_queue.shift();

        console.log("writing: %s", "S_" + command + CR);
        proxy.send("S_" + command + CR);

        if (replyHandler) {
            proxy.onmessage = function(message) {
                proxy.onmessage = null;
                replyHandler(message.data.replace(CR,"").replace(LF,""));
                ProcessFinished();
            }
        } else {
            ProcessFinished();
        }
    }
    function ProcessFinished() {
        isProcessing = false;
        if (command_queue.length > 0) {
            Process();
        }
    }
    function Push(command, callback) {
        command_queue.push([command, callback]);
        Process();
    }

    return Push;
}

//Establish proxy, and then hide the establishing loading spinner
EstablishProxy().then(proxy => {
    document.getElementById("loading_screen").classList.add("hidden");

    //Create command queue
    const Push = CreateCommandQueue(proxy);
    
    //Utility functions
    function QueryPowerState(state) {
        Push("?P", reply => {
            switch(reply) {
                case "PWR0":
                    state(true);
                    break;
                case "PWR1":
                    state(false);
                    break;
                default:
                    console.log("Unhandled reply: %s", reply);
            }
        });
    }
    function SetPowerState(newState) {
        if (newState) {
            Push("PO");
        } else {
            Push("PF");
        }
    }

    function QueryInput() {
        Push("?F", reply => {
            console.log(reply);
        })
    }


    function UpdateEntireRemote(powerState) {
        if (powerState) {
            QueryInput();
        } else {

        }
    }

    //Power toggle switch
    var powerState = false;
    function RenderPowerState() {
        if (powerState) {
            element_powerButton.classList.add("on");
        } else {
            element_powerButton.classList.remove("on");
        }
    }
    QueryPowerState(state => {
        powerState = state;
        RenderPowerState();
        UpdateEntireRemote(powerState);
    });
    element_powerButton.onclick = function() {

        //Flip state locally, and render
        powerState = !powerState;
        RenderPowerState();

        //Tell receiver to switch to the new state
        SetPowerState(powerState);
        
        //Get state from receiver. If success, it'll just stay on
        QueryPowerState(state => {
            powerState = state;
            RenderPowerState();
            UpdateEntireRemote(powerState);
        }); 
    }
})
*/