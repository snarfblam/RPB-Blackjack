//@ts-check

var firebase = firebase || {}; // todo: remove this

var firebaseConfig = {
    apiKey: "AIzaSyAyG6Ny610VSLtnHNK6dG2lOFaXujLW0SU",
    authDomain: "rpblack-jack.firebaseapp.com",
    databaseURL: "https://rpblack-jack.firebaseio.com",
    projectId: "rpblack-jack",
    storageBucket: "rpblack-jack.appspot.com",
    messagingSenderId: "1080305949942"
};
firebase.initializeApp(firebaseConfig);
//@ts-ignore
var database = firebase.database();
var provider = new firebase.auth.GoogleAuthProvider();

var userGoogleToken;
var userData;
// if (!firebase.auth().currentUser) {
//     var provider = new firebase.auth.GoogleAuthProvider();
//     firebase.auth().signInWithRedirect(provider);
// }
firebase.auth().getRedirectResult().then(function (result) {
    // The signed-in user info.
    userData = result.user;
    if (userData) {
        // This gives you a Google Access Token. You can use it to access the Google API.
        userGoogleToken = result.credential.accessToken;
    } else {
        var provider = new firebase.auth.GoogleAuthProvider();
        firebase.auth().signInWithRedirect(provider);
    }
}).catch(function (error) {
    // Handle Errors here.
    var errorCode = error.code;
    var errorMessage = error.message;
    // The email of the user's account used.
    var email = error.email;
    // The firebase.auth.AuthCredential type that was used.
    var credential = error.credential;
    // ...
});
// firebase.auth().signInWithPopup(provider).then(function(result) {
//     // This gives you a Google Access Token. You can use it to access the Google API.
//     userGoogleToken = result.credential.accessToken;
//     // The signed-in user info.
//     userData = result.user;
//     // ...
//   }).catch(function(error) {
//     // Handle Errors here.
//     var errorCode = error.code;
//     var errorMessage = error.message;
//     // The email of the user's account used.
//     var email = error.email;
//     // The firebase.auth.AuthCredential type that was used.
//     var credential = error.credential;
//     // ...
//   });

// OH GOD MY BRAIN IS MELTING IM GOING TO COME BACK TO THIS LATER ON

var RpbGame;

function signOut() {
    firebase.auth().signOut();
}

/** Managese communication with firebase
 *  @constructor */
function RpbComm() {
    this.isHosting = false;
    this.myUserKey = null;
    this.myName = "stefan";

    /** An object containing handlers for requests. Property names correspond to message strings. */
    this.requestHandlers = {};
    /** An object containing handlers for actions. Property names correspond to message strings. */
    this.actionHandlers = {};
    /** An object containing handlers for events. */
    this.eventHandlers = {};
    /** The object on whose context request and action handlers will be invoke */
    this.handlerContext = null;

    this.nodes = {
        root: database.ref("rpb"),
        host: database.ref("rpb/host"),
        hostPing: database.ref("rpb/hostPing"),
        players: database.ref("rpb/players"),
        waitingPlayers: database.ref("rpb/requestJoin"),
        requests: database.ref("rpb/requestAction"),
        actions: database.ref("rpb/performAction"),
    };

    this.cached=  {
        host: null,
        players: {},
        waitingPlayers: {},
        requests: [],
        actions: [],
    };
    this.events = {
        playerListChanged: "playerListChanged",
        hostSet: "hostSet",
        waitingListChanged: "waitingListChanged",
    };

    this.connect = function() {
        var self = this;

        // First and foremost, we're checking who the host is. 
        // If there is no host, we're becoming the host.
        // Else, we're joining as a spectator, at which point we can ask to join the next round

        this.nodes.host.once("value")
        .then(function (snapshot) {
            if (snapshot.val()) {
                self.joinExistingGame();
            } else {
                self.createNewGame();
            }

            self.nodes.host.on("value", self.ondb_host_value.bind(self));
            self.nodes.players.on("value", self.ondb_players_value.bind(self));
            self.nodes.requests.on("value", self.ondb_requests_value.bind(self));
            self.nodes.waitingPlayers.on("value", self.ondb_waitingPlayers_value.bind(self));
            self.nodes.actions.on("child_added", self.ondb_actions_childAdded.bind(self));
        }).catch(function (error) {
            alert(JSON.stringify(error));
        });
    }

    
    this.createNewGame = function () {
        this.isHosting = true;

        // note that the key name "host" carries no significance to the program, it was just convenient and helps identify the host when debugging 
        this.myUserKey = "host"; // todo: move from game to comm
        var dbData = {
            hostPing: firebase.database.ServerValue.TIMESTAMP,
            host: "host",
            players: {
                host: {
                    name: this.myName,
                    balance: 1000,
                }
            },
        };

        this.nodes.root.set(dbData);

        this.beginHostPing();
    };

    this.joinExistingGame = function () {
        this.isHosting = false;
        this.myName = prompt("enter a name. also, replace this with something competent, you turd."); // todo: move from game to comm
        var node = this.nodes.waitingPlayers.push({
            name: this.myName,
            balance: 1000,
        });
        this.myUserKey = node.key;
    };

    this.beginHostPing = function () {
        setInterval(ping.bind(this), 10000);

        function ping() {
            this.nodes.hostPing.set(firebase.database.ServerValue.TIMESTAMP);
            this.nodes.hostPing.once("value").then(function (snap) { console.log(snap.val()); });
        }
    };

    this.dispatchRequest = function (msgString, msgArgObject) {
        var msg = { action: msgString };
        if (msgArgObject) msg.args = msgArgObject;
        this.nodes.requests.push(msg);
    };
    this.dispatchAction = function (msgString, msgArgObjcet) {
        var msg = { action: msgString };
        if (msgArgObjcet) msg.args = msgArgObjcet;
        this.nodes.actions.push(msg);
    };

    this.processRequest = function (msgString, msgArgObject) {
        var handler = this.requestHandlers[msgString];
        if (handler) handler.call(this.handlerContext, msgArgObject);
    };
    this.raiseEvent = function(event, eventArgs) {
        var handler = this.eventHandlers[event];
        if(handler) handler.call(this.handlerContext, eventArgs);
    };
    this.processAllRequests = function () {
        while (this.cached.requests.length > 0) {
            var msg = this.cached.requests.shift();
            this.processRequest(msg.action, msg.args);
        }
    };

    this.processAction = function (msgString, msgArgObject) {
        var handler = this.actionHandlers[msgString];
        if (handler) handler.call(this.handlerContext, msgArgObject);

    };

    this.ondb_host_value = function (snapshot) {
        console.log("HOST", snapshot.val());
        this.cached.host = snapshot.val();
        this.raiseEvent(this.events.hostSet);
    };
    this.ondb_players_value = function (snapshot) {
        console.log("PLAYERS", snapshot.val());
        this.cached.players = snapshot.val() || {};
        this.raiseEvent(this.events.playerListChanged);
    };
    this.ondb_requests_value = function (snapshot) {
        console.log("REQUEST + ", snapshot.val());
        var self = this;
        var requestList;

        //this.comm.cached.requests = snapshot.val();
        if (this.isHosting) {
            // Use a transaction to retreive requests then delete them
            this.nodes.requests.transaction(function (req) {
                requestList = req;
                return null;
            })
                .then(function () {
                    processRequests.bind(self)(requestList);
                });
        } else {
            // only host processes requests
            //processRequests.bind(self)(snapshot.val());
        }

        function processRequests(reqObject) {
            var collection = [];
            for (var key in reqObject) {
                collection.push(reqObject[key]);
            }
            this.cached.requests = collection;
            this.processAllRequests();
        }
    };
    this.ondb_waitingPlayers_value = function (snapshot) {
        console.log("WAITING + ", snapshot.val());
        this.cached.waitingPlayers = snapshot.val();
        this.raiseEvent(this.events.waitingListChanged);
    };
    this.ondb_actions_childAdded = function (snapshot) {
        console.log("ACTION + ", snapshot.val());
        this.cached.actions = snapshot.val();
        var actionObj = snapshot.val();
        this.processAction(actionObj.action, actionObj.args);
    };

}

$(document).ready(function () {

    var rpbGame = {
        comm: new RpbComm(),

        messages: {
            startGame: "startGame",
        },



        ui: {
            hostDisplay: $("#host"),
            waitingDisplay: $("#waiting"),
            playingDisplay: $("#playing"),
            startGame: $("#start-game"),
            playerContainer: $("#player-container"),
        },

        init: function () {
            var self = this;
            $(window).on("unload", function (e) {
                // Todo: notify server (especially if host)
            });

            this.comm.requestHandlers = this.requestHandlers;
            this.comm.actionHandlers = this.actionHandlers;
            this.comm.eventHandlers = this.commEventHandlers;
            this.comm.handlerContext = this;


            self.comm.connect();

            this.ui.startGame.on("click", this.on_startGame_click.bind(this));
        },


        /** Sends a message to all clients, including the sender */
        requestHandlers: {
            startGame: function (args) {
                this.comm.dispatchAction(this.messages.startGame);
            },
        },
        actionHandlers: {
            startGame: function (args) {
                var players = this.comm.cached.players;
                for (var playerID in players) {
                    var player = players[playerID];
    
                    var div = $("<div>").attr("id", playerID);
                    div.append($("<p>").text(player.name));
                    // Host always comes first
                    if (playerID == this.comm.cached.host) {
                        this.ui.playerContainer.prepend(div);
                    } else {
                        this.ui.playerContainer.append(div);
                    }
                }
            },
        },
        commEventHandlers: {
            hostSet: function() {
                this.updateHostDisplay();
            },
            playerListChanged: function() {
                this.updateHostDisplay();
                this.updatePlayingDisplay();
            },
            waitingListChanged: function() {
                this.updateWaitingDisplay();
            },
        },
        on_startGame_click: function (e) {
            var self = this;
            var promises = [];
            // move users from waiting list to playing
            var waitingList = this.comm.cached.waitingPlayers;

            var waitingPromise = this.comm.nodes.waitingPlayers.set({});
            promises.push(waitingPromise);

            for (var playerKey in waitingList) {
                var player = waitingList[playerKey];
                var newPlayerPromise = this.comm.nodes.players.child(playerKey).set(player);
                promises.push(newPlayerPromise);
            }

            // Send the 'begin game' message when all users have been moved around.
            Promise.all(promises)
                .then(function (e) {
                    self.comm.dispatchRequest(self.messages.startGame);
                });
        },

        

        updateHostDisplay: function () {
            var hostInfo = this.comm.cached.players[this.comm.cached.host];
            if (hostInfo) {
                this.ui.hostDisplay.text(hostInfo.name);
            }
        },
        updateWaitingDisplay: function () {
            this.updateUserList(this.ui.waitingDisplay, this.comm.cached.waitingPlayers);
        },
        updatePlayingDisplay: function () {
            this.updateUserList(this.ui.playingDisplay, this.comm.cached.players);
        },
        updateUserList: function (jqElement, object) {
            var displayString = "";
            for (var userKey in object) {
                if (displayString) displayString += ", ";
                displayString += object[userKey].name;
            }
            jqElement.text(displayString);
        },
    };

    RpbGame = rpbGame;
    RpbGame.init();
});
