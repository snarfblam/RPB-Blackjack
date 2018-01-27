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

firebase.auth().signInWithPopup(provider).then(function(result) {
    // This gives you a Google Access Token. You can use it to access the Google API.
    userGoogleToken = result.credential.accessToken;
    // The signed-in user info.
    userData = result.user;
    // ...
  }).catch(function(error) {
    // Handle Errors here.
    var errorCode = error.code;
    var errorMessage = error.message;
    // The email of the user's account used.
    var email = error.email;
    // The firebase.auth.AuthCredential type that was used.
    var credential = error.credential;
    // ...
  });

var RpbGame;

$(document).ready(function () {

    var rpbGame = {
        init: function () {
            $(window).on("unload", function (e) {
                // Todo: notify server (especially if host)
            });
        },


    };

    RpbGame = rpbGame;
    RpbGame.init();
});
