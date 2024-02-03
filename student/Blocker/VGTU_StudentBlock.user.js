// ==UserScript==
// @name         VGTU - Student
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  Block Students from surfing web
// @author       mrNull
// @match        https://*.*
// @match        http://*.*
// @include      https://*/*
// @include      http://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM.setValue
// @grant        GM.getValue
// @grant        unsafeWindow
// @downloadURL  https://github.com/eman-on/VGTUProfessoring/raw/main/student/Blocker/VGTU_StudentBlock.user.js
// @updateURL    https://raw.githubusercontent.com/eman-on/VGTUProfessoring/main/student/Blocker/VGTU_StudentBlock.user.js
// @run-at       document-start
// ==/UserScript==

(function () {
    const banTime = 1000 * 60 * 90;
    var noRedirent = true;
    (function goTo() {
        const allowed = ['acm.vgtu.lt', 'vilniustech.lt'];
        if (allowed.indexOf(window.location.host) === -1) {
            noRedirent = false;
            window.location = `http://acm.vgtu.lt/disqualification?r=${window.location.href}`;
            setInterval(() => {
                window.document.html ? window.document.html.removeChild(window.document.body) : null;
            }, 0)
        }
        else {
            if (data().get('ban') && window.location.href !== 'http://acm.vgtu.lt/disqualification') {
                noRedirent = false;
                window.location = 'http://acm.vgtu.lt/disqualification';
                setInterval(() => {
                    window.document.html ? window.document.html.removeChild(window.document.body) : null;
                }, 0)
            }
            if (window.location.href.indexOf('source/') > -1) {
                noRedirent = false;
                window.location = 'http://acm.vgtu.lt/';
                setInterval(() => {
                    window.document.html ? window.document.html.removeChild(window.document.body) : null;
                }, 0)
            }
            var acceptedTerms = data().get('examAccepted');
            if (window.location.host == 'acm.vgtu.lt' && !acceptedTerms && noRedirent || window.location.href === 'http://acm.vgtu.lt/examTerms') {
                termsAndCond(acceptedTerms);
                return;
            }
        }
    })()

    if (window.location.host == 'acm.vgtu.lt') {
        init();
        aPannel();
    }

    function init() {
        document.addEventListener("readystatechange", selectPage);
        var process = true;
        function selectPage() {
            if (process && window.location.pathname === '/disqualification') { process = false; disqualification() }
        }
        setTimeout(initExtra, 500);
    }
    function disqualification() {
        const maxAttempts = 3;
        window.title = 'Disqualification';
        var message = document.getElementById('ir_container');
        if (!message) { return };
        var remove = localStorage.getItem('disqualification_timer');
        if (remove && new Date() - new Date(remove) > 0) {
            localStorage.removeItem('disqualification_timer');
            localStorage.removeItem('disqualification_attempt');
        }
        else {
            var now = new Date();
            var time = now.getTime();
            time += banTime;
            now.setTime(time);
            localStorage.setItem('disqualification_timer', now);
        }
        var attempts = localStorage.getItem('disqualification_attempt');
        attempts = attempts ? JSON.parse(attempts) : [];
        if (data().get('ban') || attempts.length > maxAttempts) {
            BLOCKUSER();
            return;
        }
        var url = window.location.href.split('?r=')[1];
        if (url) {
            message.innerHTML = '';
            var u = url.slice(url.indexOf('://') + 3).split('/');
            var res = u[0];
            var req = u[1].split('search?q=')[1]
            if (req) { req = unescape(url.slice(url.indexOf('://') + 3).split('/')[1].match(/search\?q=(.*?)?&/)[1]) };
            var m = new Date();
            var dateString = ("0" + m.getHours()).slice(-2) + ":" + ("0" + m.getMinutes()).slice(-2) + " " + ("0" + m.getDate()).slice(-2) + "-" + ("0" + (m.getMonth() + 1)).slice(-2) + "-" + m.getFullYear();
            attempts.push({
                time: dateString,
                res: res,
                req: req || false
            });
            localStorage.setItem('disqualification_attempt', JSON.stringify(attempts));
            window.location = 'http://acm.vgtu.lt/disqualification';
            return;
        }
        var map = { 1: 'first', 2: 'second', 3: 'third' }
        var number = map[attempts.length];
        message.querySelector('.text-danger').innerHTML = `<b>${attempts.length == maxAttempts ? 'LAST ' : ''}WARNING</b>`;
        var attemptsDOM = '';
        for (let i = 0, l = attempts.length; i < l; i++) {
            attemptsDOM += `${attempts[i].time}: resource - ${attempts[i].res}${attempts[i].req ? ', search - ' + attempts[i].req : ''}<br>`
        }
        message.querySelector('p').innerHTML = `
    ${attempts.length > 0 ? `<h2 class="text-danger">A ${number} attempt to leave the examination system was detected.</h4>` : ''}
    <h4>Leaving the examination system is prohibited during the exam, do not visit any other resources or web-pages.<br>
    ${attempts.length === maxAttempts ? "Next time" : "Otherwise"}, your exam will be <a class="text-danger"><b>stopped</b></a> and your results will be cancelled.</h4><br>
    Student: ${document.querySelector('.navbar-right a').innerText}<br>${attempts.length > 0 ? `Attempts (${attempts.length}/3):<br>${attemptsDOM}` : ''}
    <br><br><a href="http://acm.vgtu.lt" class="btn btn-default" >Go Back</a>`;
    }
    function BLOCKUSER() {
        window.history.pushState({}, "", "/");
        var user = document.querySelector('.navbar-right a').innerText;
        var ban = data().get('ban') || data().set('ban', user);
        var attempts = localStorage.getItem('disqualification_attempt');
        attempts = attempts ? JSON.parse(attempts) : [];
        var attemptsDOM = '';
        for (let i = 0, l = attempts.length - 1; i < l; i++) {
            attemptsDOM += `${attempts[i].time}: resource - ${attempts[i].res}${attempts[i].req ? ', search - ' + attempts[i].req : ''}<br>`
        }
        var message = document.getElementById('ir_container');
        message.querySelector('.text-danger').innerHTML = `<b>BANNED</b><span style="font-size:12px;margin-left: 4px;"></span>`;
        message.querySelector('p').innerHTML = `<h2 class="text-danger">${ban.user} was not certified due to dishonesty.</h4><br>Details:<br>${attemptsDOM}`;
        //document.querySelector('.navbar-nav').parentElement.innerHTML = '';
        var timerDOM = message.querySelector('.text-danger>span');
        function tick() {
            var timer = (new Date(ban.time) - new Date()) / 1000;
            var sec = ("0" + Math.round(timer % 60)).slice(-2); timer = ("0" + Math.round(timer / 60)).slice(-2);
            timerDOM.innerHTML = `for ${timer}:${sec} minute${timer > 1 ? 's' : ''}`;
        }
        tick(); setInterval(tick, 1000);
    }
    function initExtra() {
        var dom = document.createElement('a');
        dom.style = 'right: 4px;bottom: 0px;position: fixed;z-index: 1;color: #c1c1c1;';
        dom.innerHTML = 'b';
        dom.addEventListener('click', () => { window.location = 'http://acm.vgtu.lt/disqualification' });
        document.body.appendChild(dom);

        return
        var script = document.createElement('script');
        script.innerHTML = 'function deb(){debugger}';
        document.head.appendChild(script);
        script = document.createElement('script');
        script.innerHTML = 'setInterval(deb,0)';
        document.head.appendChild(script);
        setInterval(() => {
            var c = data().get('ban');
            var l = localStorage.getItem('disqualification_attempt');
            l = l ? JSON.parse(l) : []
            if (!c && l.length > 0 || c && l.length == 0) {
                debugger
            }
        }, 100)
    }
    function data() {
        return {
            get(user) {
                let name = user + "=";
                let decodedCookie = decodeURIComponent(document.cookie);
                let ca = decodedCookie.split(';');
                for (let i = 0; i < ca.length; i++) {
                    let c = ca[i];
                    while (c.charAt(0) == ' ') {
                        c = c.substring(1);
                    }
                    if (c.indexOf(name) == 0) {
                        return JSON.parse(c.substring(name.length, c.length));
                    }
                }
                return false;
            },
            set(user, name) {
                var now = new Date();
                var time = now.getTime();
                time += banTime;
                now.setTime(time);
                document.cookie = `${user}=${JSON.stringify({ user: name, time: now })};expires=${now.toUTCString()}; path=/`;
                return { user: name, time: now };
            },
            del(user) {
                document.cookie = `${user}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
            }
        }
    }
    function unsel() {
        if (!document.head) { setTimeout(unsel, 0); return }
        var style = `
    .ir-problem-statement,.ir-problem-statement *{
      user-select: none;
    }`;
        var dom = document.createElement('style');
        dom.innerHTML = style;
        document.head.appendChild(dom);
        document.addEventListener('contextmenu', event => event.preventDefault());
        document.onkeydown = disableSelectCopy;
        function disableSelectCopy(e) {
            var pressedKey = String.fromCharCode(e.keyCode).toLowerCase();
            if ((e.ctrlKey && (pressedKey == "c" || pressedKey == "x" || pressedKey == "v" || pressedKey == "a" || pressedKey == "u")) || e.keyCode == 123) {
                return false;
            }
        }
    }; setTimeout(unsel, 0);

    function termsAndCond(acceptedTerms) {
        if (window.location != 'http://acm.vgtu.lt/examTerms') {
            window.location = 'http://acm.vgtu.lt/examTerms';
        }
        document.addEventListener("readystatechange", selectPage);
        var message = false;
        function selectPage() {
            message = document.getElementById('ir_container');
            if (message) { initTerms() };
        }
        function initTerms() {
            unsafeWindow.title = 'Examination';
            message.querySelector('.text-danger').innerHTML = '<b>Examination procedure</b>';
            message.querySelector('p').innerHTML = `<h2 class="text-danger">Rules for taking the exam:</h2>
                <p>1. It is forbidden to visit any online resource apart from examination system</p>
                <p>2. It is forbidden to share/copy solution of another student</p>
                <p>3. It is forbidden to use personal laptop</p>
                <p>4. It is forbidden to use mobile phone</p><br>
                <h5 class="text-danger">Breaking those rules will lead to disqualification or penalty</h5><br>
                ${!acceptedTerms ? '<label style="font-weight: 100;" id="examAcceptLabel"><input type="checkbox" id="examAccept"></input>  I read and accept the highlighted rules</label><br>' : ''}
                <button class="btn btn-default btn-sm ir-quiz-inline-btn accept">${!acceptedTerms ? 'Accept and start' : 'Close'}</button>`;
            message.querySelector('p>button.accept').addEventListener('click', examStart);
            document.querySelector('.container>.collapse').style = 'display:none !important;'
            document.body.style = `min-height: 100% !important;min-width: 100%;display: flex;flex-direction: column;justify-content: center;position: absolute;`;
            document.querySelector('.navbar').style = 'display: none;';
            document.querySelector('.footer').style = 'display: none;';

            var check = message.querySelector('p #examAccept');
            function examStart() {
                if (!check) { window.location = 'http://acm.vgtu.lt'; return; }
                if (!check.checked) {
                    message.querySelector('#examAcceptLabel').style.color = 'red';
                    return;
                }
                var now = new Date();
                var time = now.getTime();
                time += banTime;
                now.setTime(time);
                document.cookie = `examAccepted=true;expires=${now.toUTCString()}; path=/`;
                window.location = 'http://acm.vgtu.lt';
            }
        }
    }

    function aPannel() {
        setTimeout(trigger, 500);
        function trigger() {
            const word = 'irunner' + new Date().getFullYear().toString().slice(2);
            var i = 0;
            const allow = function (event) {
                if (event.key === word[i]) {
                    i++;
                }
                else {
                    i = 0;
                }
                if (i === word.length) {
                    createPannel();
                }
            }
            document.addEventListener('keydown', allow);
        }
        function createPannel() {
            var container = document.createElement('div');
            container.style = 'position: fixed;left: 0;top: 0;width: 100%;height: 100%;display: flex;justify-content: center;align-items: center;';
            container.innerHTML = `
                <div class="panel panel-danger">
                <div class="panel-body">
                    <h1><b>Action Pannel</b></h1><hr>
                    <button action="removeBan" class="btn btn-default">Remove Ban</button><br>
                    <hr>
                    <a href="http://acm.vgtu.lt" class="btn btn-default">Close</a>
                </div>
                </div>`
            document.body.appendChild(container);
            container = container.querySelector('.panel-body');
            var buttons = [...container.querySelectorAll('button')];
            const actions = { removeBan: removeBan, update:update }
            buttons.forEach((b) => {
                var act = b.getAttribute('action');
                b.addEventListener('click', actions[act]);
            });
            function removeBan() {
                data().del('ban');
                localStorage.removeItem('disqualification_attempt'); window.location = 'http://acm.vgtu.lt/';
            }
            function update(){
                console.log(GM_info.script.downloadURL);
                window.location.replace(GM_info.script.downloadURL+'?'+new Date().getTime());
            }
            function createButton(value,action,type='button'){
                var b = document.createElement(type);
                b.innerHTML = value;
                b.style ='float: right;';
                if(type==='button'){
                    b.setAttribute('action',action);
                    b.className="btn btn-default";
                    b.addEventListener('click', actions[action]);
                }
                container.appendChild(b);
            }
            checkUpdate(createButton);
        }
        function checkUpdate(createButton) {
            fetch(GM_info.script.updateURL+'?'+new Date().getTime())
                .then(response => response.text())
                .then(data => {
                    const match = data.match(/@version\s+(\d+\.\d+)/);
                    if (match) {
                        const githubVersion = parseFloat(match[1]);
                        const currentVersion = parseFloat(GM_info.script.version);
                        githubVersion != currentVersion?createButton('Update','update'):createButton('No update',null,'span');
                    } else {
                        console.error('VGTUStudent: Update do not work.');
                    }
                })
                .catch(error => {
                    console.error('VGTUStudent: Update do not work', error);
                });
        }
    };
})();
