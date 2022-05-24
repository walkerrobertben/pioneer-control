//Constants
const CR = "\r"
const LF = "\n"

const element_powerButton = document.getElementById("power_button")

//Establishes a connection to the proxy server, and connects it to the local network.
function EstablishProxy() {
    return new Promise(function(resolve) {
        fetch("https://api.ipify.org").then(response => response.text()).then(wan_ipv4 => {
            const proxy = new WebSocket("ws://telnet-proxy.herokuapp.com");
            proxy.onopen = function() {
                proxy.onmessage = function(message) {
                    if (message.data == "ready") {
                        proxy.onmessage = null;
                        resolve(proxy);
                    }
                }
                proxy.send("C_" + wan_ipv4 + ":12345");
            }
        });
    });
}

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
    });
    element_powerButton.onclick = function() {

        //Flip state locally, and render
        powerState = !powerState;
        RenderPowerState(powerState);

        //Tell receiver to switch to the new state
        SetPowerState(powerState);
        
        //Get state from receiver. If success, it'll just stay on
        QueryPowerState(state => {
            powerState = state;
            RenderPowerState();
        });
    }
})