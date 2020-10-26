let lpState = {
    docOrigin: null,
    urlParser: null,
    ytVideoId: null,
    player: null,
    t0: null,
    t1: null,
    looping: null,
    active: null,
    loopMaintainer: null,
    playerState: null,

    preprocessBoundaries: function () {
        if (Number.isNaN(this.t0)) { this.t0 = 0; }
        if (Number.isNaN(this.t1)) { this.t1 = -1; }
    },

    clampBoundaries: function () {
        const endPosition = this.player.getDuration(); // getDuration returns an int = ceil(true end)
        if (lpState.t0 < 0) { lpState.t0 = 0; }
        if (endPosition >= 2 && lpState.t0 > endPosition - 2) { lpState.t0 = endPosition - 2; } // without this seemingly arbitrary restriction, YT player might freak out spectacularly when looping near the end of the video
        if (lpState.t1 < 0 || lpState.t1 <= lpState.t0 || lpState.t1 > endPosition) { lpState.t1 = endPosition; }
    },

    fromUrl: function () {
        this.urlParser = new URL(document.location.href);
        this.docOrigin = this.urlParser.origin;
        let urlParams = this.urlParser.searchParams;
        this.ytVideoId = urlParams.get('v');
        this.t0 = parseFloat(urlParams.get('t'));
        this.t1 = parseFloat(urlParams.get('t1'));
        this.preprocessBoundaries();
    },

    toUrl: function () {
        let newUrl = '?v=' + this.ytVideoId;
        newUrl += '&t=' + roundFloatToString(this.t0, 2);
        newUrl += '&t1=' + roundFloatToString(this.t1, 2);
        window.history.replaceState(null, '', newUrl.toString());
    },

    fromControls: function () {
        this.t0 = parseFloat(document.getElementById('t0_input').value);
        this.t1 = parseFloat(document.getElementById('t1_input').value);
        this.preprocessBoundaries();
    },

    toControls: function () {
        document.getElementById('t0_input').value = roundFloatToString(this.t0, 2);
        document.getElementById('t1_input').value = roundFloatToString(this.t1, 2);
    },

    primeLoop: function () {
        let player = this.player;
        player.seekTo(lpState.t0, true);
        lpState.loopMaintainer = setInterval(function (player) {
            // don't do anything if the player is paused
            if (player.getPlayerState() == 2) { return; }
            // loop around if position has become >= t1 or if end has been reached
            // also don't allow to get out of the loop
            let t = player.getCurrentTime();
            if (t < lpState.t0 || t >= lpState.t1 || player.getPlayerState() == 0) {
                player.seekTo(lpState.t0, true);
            }
        }, 50, player);
    },

    dismantleLoop: function () {
        clearInterval(lpState.loopMaintainer);
        lpState.loopMaintainer = null;
    },
};

// set up player
function onYouTubeIframeAPIReady() {
    // parse parameters from URL
    lpState.fromUrl();
    document.getElementById('example').href = pickRandomExample();

    let playerIframe = document.getElementById('main_player');
    playerIframe.src = 'https://www.youtube.com/embed/' + lpState.ytVideoId + '?enablejsapi=1&origin=' + lpState.docOrigin;

    lpState.player = new YT.Player('main_player', {
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange,
            'onError': onPlayerError,
        }
    });
}

// "main" function
function onPlayerReady(event) {
    let player = event.target;
    lpState.playerState = player.getPlayerState();
    lpState.clampBoundaries();

    // set up controls
    lpState.toControls();
    document.getElementById('toggle_loop').addEventListener('click', onLoopToggle);
    document.getElementById('mark_start').addEventListener('click', onMarkStart);
    document.getElementById('mark_end').addEventListener('click', onMarkEnd);
    document.getElementById('t0_input').addEventListener('focusout', onControlFocusOut);
    document.getElementById('t1_input').addEventListener('focusout', onControlFocusOut);
    document.getElementById('munch_link').addEventListener('click', onMunchNewLink);
}

function onPlayerError(event) {
    let errCode = event.data;
    if (errCode == 2) {
        if (lpState.ytVideoId == null) { displayError('You need to specify video id first! Try examples below'); }
        else { displayError('Video id is invalid! Verify it and try again'); }
    }
    else if (errCode == 5) { displayError('HTML5 player error! Try reloading'); }
    else if (errCode == 100) { displayError('Video removed or marked private!'); }
    else if (errCode == 101 || errCode == 150) { displayError('Video is not allowed to be embedded!'); }
    else { displayError('Unknown error! YTPlayer error code = ' + errCode.toString()); }
}

function displayError(message) {
    let errDiv = document.getElementById('error');
    errDiv.classList.remove('hidden');
    errDiv.innerHTML = '<b>ERROR!</b> ' + message;
}

function onPlayerStateChange(event) {
    let newState = event.data;
    // start looping when user first activates the video
    if (newState != -1 && lpState.active != true && lpState.looping != true) {
        document.getElementById('toggle_loop').removeAttribute('disabled');
        document.getElementById('toggle_loop').click();
        lpState.active = true;
    }
    lpState.playerState = newState;
}

function onControlFocusOut(_event) {
    lpState.fromControls();
    lpState.clampBoundaries();
    lpState.toControls();
    lpState.toUrl();
}

function onMunchNewLink(_event) {
    let newLinkText = document.getElementById('link_input').value;
    let newLink = null;
    try { newLink = new URL(newLinkText); }
    catch (error) { displayError('Pasted URL is ill-formed! Verify and try again'); return; }
    let newVideoId = null;
    if (newLink.hostname == 'youtu.be') { newVideoId = newLink.pathname.replace('/', ''); }
    else { newVideoId = newLink.searchParams.get('v'); }
    let newStartTime = newLink.searchParams.get('t');
    let href = '?v=' + newVideoId + '&t=' + newStartTime;
    window.location.href = href;
}

function onMarkStart(_event) {
    lpState.t0 = lpState.player.getCurrentTime();
    lpState.toUrl();
    lpState.toControls();
}

function onMarkEnd(_event) {
    lpState.t1 = lpState.player.getCurrentTime();
    lpState.toUrl();
    lpState.toControls();
}

function onLoopToggle(event) {
    if (lpState.looping == true) {
        lpState.dismantleLoop();
        event.target.innerHTML = event.target.innerHTML.replace('is on', 'is off');
        lpState.looping = false;
    } else {
        lpState.primeLoop();
        event.target.innerHTML = event.target.innerHTML.replace('is off', 'is on');
        lpState.looping = true;
    }
}

function pickRandomExample() {
    let examples = [
        '?v=srZdDAJbHfc&t=10282&t1=10443.4',
        '?v=srZdDAJbHfc&t=4071.4&t1=4129.8',
        '?v=6Rawqi3r5B4&t=178.5&t1=180.3',
        '?v=Vhh_GeBPOhs&t1=11.5',
    ];
    // exclude the current address from candidates
    let ind = examples.indexOf(window.location.search);
    if (ind >= 0) { examples.splice(ind, 1); }
    return examples[Math.floor(Math.random() * examples.length)];
}

function roundFloatToString(number, digits) {
    return Number.parseFloat(number.toFixed(digits)).toString();
}
