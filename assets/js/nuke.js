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

database.ref("rpb").set(null);