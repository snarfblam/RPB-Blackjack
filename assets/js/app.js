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

/** Iterates over an objects own properties. (Similar to a for...in loop, but skips over inherited (prototype) properties.) */
function forEachIn(obj, callback, _this) {
    for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
            callback.call(_this || this, key, obj[key]); // inherit this function's context if _this is not specified
        }
    }
}


/** Managese communication with firebase
 *  @constructor */
function RpbComm() {
    this.isHosting = false;
    this.myUserKey = null;
    this.myName = "stefan";

    /** An object containing handlers for requests. Property names correspond to message strings. */
    this.requestHandlers = [];
    /** An object containing handlers for actions. Property names correspond to message strings. */
    this.actionHandlers = [];
    /** An object containing handlers for events. */
    this.eventHandlers = [];
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
        bets: database.ref("rpb/bets"),
    };

    this.cached = {
        host: null,
        players: {},
        waitingPlayers: {},
        requests: [],
        actions: [],
        bets: [],
    };
    this.events = {
        playerListChanged: "playerListChanged",
        hostSet: "hostSet",
        waitingListChanged: "waitingListChanged",
    };

    this.connect = function () {
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
                self.nodes.bets.on("value", self.ondb_bets_value.bind(self));
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

    /** Sends a message to the host to request a game action to occur */
    this.dispatchRequest = function (msgString, msgArgObject) {
        var msg = { action: msgString };
        if (msgArgObject) msg.args = msgArgObject;
        this.nodes.requests.push(msg);
    };
    /** Sends a message to clients informing them that a game action has occurred */
    this.dispatchAction = function (msgString, msgArgObjcet) {
        var msg = { action: msgString };
        if (msgArgObjcet) msg.args = msgArgObjcet;
        this.nodes.actions.push(msg);
    };

    this.processRequest = function (msgString, msgArgObject) {
        this.requestHandlers.forEach(function (handlerObject) {
            var handlerFunc = handlerObject[msgString];
            if (handlerFunc) handlerFunc.call(handlerObject.handlerContext || this, msgArgObject);
        }, this);
    };
    this.raiseEvent = function (event, eventArgs) {
        this.eventHandlers.forEach(function (handlerObject) {
            var handler = handlerObject[event];
            if (handler) handler.call(handlerObject.handlerContext, eventArgs);
        }, this);
    };
    this.processAllRequests = function () {
        while (this.cached.requests.length > 0) {
            var msg = this.cached.requests.shift();
            this.processRequest(msg.action, msg.args);
        }
    };

    this.processAction = function (msgString, msgArgObject) {
        this.actionHandlers.forEach(function (handlerObject) {
            var handlerFunc = handlerObject[msgString];
            if (handlerFunc) handlerFunc.call(handlerObject.handlerContext || this, msgArgObject);
        }, this);
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
            forEachIn(reqObject, function (key, value) {
                collection.push(value);
            });
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
    this.ondb_bets_value = function (snapshot) {
        console.log("BET + ", snapshot.val());
        this.cached.bets = snapshot.val();
    };

}


/** Represents game logic
 * @constructor
 */
function RpbGameLogic() {

    //this.state = this.states.none;
    this.deck = new CardDeck(true, 1);
    this.minimumBet = 1;
    this.maximumBet = 20;
    this.currentBet = null;
    /** Contains player specific data (hand, bet), with user ids as keys */
    this.playerInfo = {
        // .hand: Card[]
        // .bet: number
        // .betPlaced: bool - to be set by placeBet function
    };
    /** Must be set to the RpbComm object. Used to get and set player info.
     * @type {RpbComm}
     */
    this.comm = null;


}
RpbGameLogic.states = {
    none: "None",
    placingBets: "placingBets",
};
RpbGameLogic.messages = {
    placeBet: "placeBet",
    dealCard: "dealCard",
}
RpbGameLogic.prototype.state = RpbGameLogic.states.none; // default value
RpbGameLogic.prototype.initialized = false;
RpbGameLogic.prototype.init = function init() {
    // Lazy initialization
    if (!this.comm) throw Error("RpbGameLogic.comm must be set prior to using the object.");

    this.actionHandlers.handlerContext = this;
    this.requestHandlers.handlerContext = this;
    this.comm.actionHandlers.push(this.actionHandlers);
    this.comm.requestHandlers.push(this.requestHandlers);
};
/** Prepares a hand be re-initializing player hand data. Bets may be made. No cards will be dealt until
 * dealHand is called.
 */
RpbGameLogic.prototype.host_beginHand = function () {
    if (!this.initialized) this.init();
    this.playerInfo = {};

    forEachIn(this.comm.cached.players, function (key, value) {
        this.playerInfo[key] = {
            bet: this.minimumBet,
            hand: [], // first card is hidden
            betPlaced: false,
        }
    }, this);

    this.state = RpbGameLogic.states.placingBets;
}
RpbGameLogic.prototype.player_beginHand = new function () {

};

RpbGameLogic.prototype.player_placeBet = function (amt) {
    this.currentBet = amt;
    this.comm.dispatchRequest(RpbGameLogic.messages.placeBet, {
        user: this.comm.myUserKey,
        bet: amt
    });
};
/** Gets an object containing only the card's suit and rank. */
RpbGameLogic.prototype.getSimpleCard = function getSimpleCard() {
    var card = this.deck.getCard();
    return {rank: card.rank, suit: card.suit};
    
}
RpbGameLogic.prototype.host_initialDeal = function host_initialDeal() {
    // I'm dealing out of order and I don't even care
    var dealerCards = [this.getSimpleCard(), this.getSimpleCard()];
    this.comm.dispatchAction(RpbGameLogic.messages.dealCard, {
        user: "dealer",
        cards: dealerCards,
    });

    forEachIn(this.playerInfo, function (key, value) {
        var cards = [this.getSimpleCard(), this.getSimpleCard()];
        this.comm.dispatchAction(RpbGameLogic.messages.dealCard, {
            user: key,
            cards: cards,
        });
    }, this)
}

RpbGameLogic.prototype.host_registerBet = function (userKey, amt) {
    var playerInfo = this.playerInfo[userKey];
    playerInfo.bet = amt;
    playerInfo.betPlaced = true;

    // Notify clients
    this.comm.dispatchAction(RpbGameLogic.messages.placeBet, { user: userKey, bet: amt });

    // we're only done betting if all players have placed bets
    var doneBetting = true;
    forEachIn(this.playerInfo, function (key, value) {
        if (!value.betPlaced) doneBetting = false;
    }, this);

    if (doneBetting) {
        this.host_initialDeal();
    }
};
RpbGameLogic.prototype.requestHandlers = {
    placeBet: function (args) {
        if (this.comm.isHosting) {
            this.host_registerBet(args.user, args.bet);
        }
    }
};
RpbGameLogic.prototype.actionHandlers = {
    placeBet: function (args) {

    },
};

/** Represents a deck of cards
 *  @constructor
 */
function CardDeck(shuffled, numDecks) {
    numDecks = numDecks || 1;

    /** @type {Card[]} */
    this.cards = [];
    /** @type {Card[]} 
     * Cards on the table    */
    this.cardsOut = [];
    /** @type {Card[]} 
     * Cards returned from the table */
    this.returnedCards = [];

    var suits = this.suits = ["hearts", "diamonds", "spades", "clubs"];
    var suitSymbols = this.suitSymbols = ["♥", "♦", "♠", "♣"];
    var ranks = this.ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

    /** @constructor */
    var Card = this.Card = function (rank, suit) {
        this.rank = rank;
        this.rankName = ranks[rank - 1];
        this.suit = suit;
        this.suitName = suits[suit];
        this.suitSymbol = suitSymbols[suit];

    };

    /** Shuffles cards */
    this.shuffle = function () {
        // re-insert returned cards
        Array.prototype.push.apply(this.cards, this.returnedCards);
        this.returnedCards.length = 0;

        // fisher yates
        for (var i = this.cards.length - 1; i > 0; i--) {
            var iSwap = Math.floor(Math.random() * (i + 1));
            var tmp = this.cards[iSwap]
            this.cards[iSwap] = this.cards[i];
            this.cards[i] = tmp;
        }
    };

    /** Removes one card from the deck and returns it. 
     * @returns Card
    */
    this.getCard = function() {
        if(this.cards.length == 0) {
            this.shuffle();
        }

        var result = this.cards.pop();
        // Place card 'on table'
        this.cardsOut.push(result);
        return result;
    }

    /** Re-adds any dealt cards back into the deck for the next shuffle */
    this.returnCards = function() {
        // Take cards 'on the table' and put them in the return pile
        Array.prototype.push.apply(this.returnedCards, this.cardsOut);
        this.cardsOut.length = 0;
    }

    for (var iDeck = 0; iDeck < numDecks; iDeck++) {
        for (var rank = 1; rank <= 13; rank++) {
            for (var suit = 0; suit < 4; suit++) {
                this.cards.push(new Card(rank, suit));
            }
        }
    }
    if (shuffled) this.shuffle();
}
$(document).ready(function () {

    var rpbGame = {
        comm: new RpbComm(),
        game: new RpbGameLogic(),
        messages: {
            startGame: "startGame",
        },

        ui: {
            hostDisplay: $("#host"),
            waitingDisplay: $("#waiting"),
            playingDisplay: $("#playing"),
            startGame: $("#start-game"),
            playerContainer: $("#player-container"),
            placeBet: $("#place-bet"),
            myBet: $("#my-bet"),
        },

        init: function () {
            var self = this;
            $(window).on("unload", function (e) {
                // Todo: notify server (especially if host)
            });

            this.requestHandlers.handlerContext = this;
            this.actionHandlers.handlerContext = this;
            this.commEventHandlers.handlerContext = this;
            this.comm.requestHandlers.push(this.requestHandlers);
            this.comm.actionHandlers.push(this.actionHandlers);
            this.comm.eventHandlers.push(this.commEventHandlers);

            this.game.comm = this.comm;


            self.comm.connect();

            this.ui.startGame.on("click", this.on_startGame_click.bind(this));
            this.ui.placeBet.on("click", this.on_placeBet_click.bind(this));
        },

        getThisPlayer: function () {
            return (this.comm.cached.players || {})[this.comm.myUserKey];
        },
        getHostPlayer: function () {
            return (this.comm.cached.players || {})[this.comm.cached.host];
        },


        /** Sends a message to all clients, including the sender */
        requestHandlers: {
            startGame: function (args) {
                this.comm.dispatchAction(this.messages.startGame);
            },
        },
        actionHandlers: {
            startGame: function (args) {
                forEachIn(this.comm.cached.players, function (key, value) {
                    var player = value;

                    var div = $("<div>").attr("id", key);
                    div.append($("<p>").text(player.name));
                    // Host always comes first
                    if (key == this.comm.cached.host) {
                        this.ui.playerContainer.prepend(div);
                    } else {
                        this.ui.playerContainer.append(div);
                    }
                }, this);

                var thisPlayer = this.getThisPlayer();
                var host = this.getHostPlayer();
                if (thisPlayer) {
                    var minBasedOnBalance = Math.max(thisPlayer.balance, 1); // if you have negative balance, can still bet 1
                    var maxBasedOnHost = Math.min((host || {}).balance || 1, 1); // can bet up to host's balance, or at least 1 if host is broke
                    var maxBasedOnBalance = Math.min(maxBasedOnHost, thisPlayer.balance); // can't bet more than you have
                    this.ui.placeBet.attr("min", minBasedOnBalance);
                    this.ui.placeBet.attr("max", maxBasedOnBalance);
                }
                if(this.comm.isHosting){
                    this.game.host_beginHand();
                }
            },
        },
        commEventHandlers: {
            hostSet: function () {
                this.updateHostDisplay();
            },
            playerListChanged: function () {
                this.updateHostDisplay();
                this.updatePlayingDisplay();
            },
            waitingListChanged: function () {
                this.updateWaitingDisplay();
            },
        },
        on_placeBet_click: function(e){
            //@ts-ignore
            var bet = parseInt(this.ui.myBet.val()) || 1;
            this.game.player_placeBet(bet);
        },
        on_startGame_click: function (e) {
            var self = this;
            var promises = [];

            // move users from waiting list to playing
            var waitList = this.comm.cached.waitingPlayers;
            var waitingPromise = this.comm.nodes.waitingPlayers.set({});
            promises.push(waitingPromise);

            forEachIn(waitList, function (key, value) {
                var invalid = (!key || !value);
                if (!invalid) { // if your name is "", you don't get to play. ¯\_(ツ)_/¯
                    var newPlayerPromise = this.comm.nodes.players.child(key).set(value);
                    promises.push(newPlayerPromise);
                }
            }, this);

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
            forEachIn(object, function (key, value) {
                if (displayString) displayString += ", ";
                displayString += value.name;
            });
            jqElement.text(displayString);
        },
    };

    RpbGame = rpbGame;
    RpbGame.init();
});
