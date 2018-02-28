# Rock Paper Blackjack
----
### But, what is it?
It's a new twist on Rock, Paper, Scissors! Instead of selecting between "rock", "paper", or "scissors", you're dealt some cards and you play Blackjack! 

About the current state of the project: There simply wasn't enough time to thoroughly debug the software. It *seems* to work! However, if it all goes to hell, the database can be wiped by opening ***nuke.html***.

Essentially, firebase is used to implement a "communication protocol". The first player to join becomes the host and he runs the host logic as well as the usual client logic. Clients interact by sending messages to the host ('requests') and receiving messages back from the host ('actions'). Should the host disappear, the first client that decides the host timed out takes the throne. Should a player disappear, the host decides when he times out, at which point the current round is scrapped.

### Files
*They're pretty important.*

- index.html - Main interface. Used for both host and client.
- nuke.html - Nuclear option. Clears the database. Use this if things enter an unrecoverable state.
- README.md - You're looking at it.
- dbStructure.txt - Outlines the database structure as well as the messages sent between clients
- /**assets** - Where I keep the good stuff
   - /**css** - css files
     - reset.css - Because not all things are created equal. Nomralizes styles between browsers.
     - main.css - CSS definitions for index.html/nuke.html
   - /**images** - UI images
   - /**js** - Javascript files
     - app.js - Implements all host/client, firebase, and UI logic
     - nuke.js - With the fire of 10,000 suns. (Used by nuke.html.)

## License
----
All javascript, HTML, and css code in this repository is released under the WTFPL 2 license, i.e. no rights reserved. Other assets are property of their respective owners and should not be distributed.
