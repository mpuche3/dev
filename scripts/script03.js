class PermanentDictionary {
    constructor(storeName) {
        this.storeName = storeName;
        this._initPromise = this._init();
    }

    async _init() {
        this.db = await this._ensureStore(this.storeName);
    }

    async _ensureStore(storeName) {
        const dbName = this.storeName;

        const openDB = (version) => new Promise( (resolve, reject) => {
            const req = indexedDB.open(dbName, version);
            req.onupgradeneeded = () => {
                const db = req.result;
                // If some other tab tries to upgrade later, gracefully close this one.
                db.onversionchange = () => db.close();
                if (!db.objectStoreNames.contains(storeName)) {
                    db.createObjectStore(storeName);
                    console.log(`Created object store "${storeName}" in onupgradeneeded.`);
                }
            }
            req.onsuccess = () => {
                const db = req.result;
                db.onversionchange = () => {
                    db.close();
                }
                resolve(db);
            }
            req.onerror = () => {
                reject(req.error ?? new Error("IndexedDB open failed"));
            }
            req.onblocked = () => {
                reject(new Error('Database upgrade blocked: another open connection is preventing the version change. Close other tabs or connections.'));
            }
        });

        let db = await openDB();
        if (db.objectStoreNames.contains(storeName)) {
            return db;
        }

        const newVersion = db.version + 1;
        db.close();
        db = await openDB(newVersion);
        if (!db.objectStoreNames.contains(storeName)) {
            db.close();
            throw new Error(`Failed to create object store "${storeName}" even after upgrade.`);
        }
        return db;
    }

    _reqToPromise(request) {
        return new Promise( (resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        }
        );
    }

    _tx(storeName, mode='readonly') {
        const tx = this.db.transaction(storeName, mode);
        return {
            tx,
            store: tx.objectStore(storeName)
        };
    }

    async set(key, value) {
        await this._initPromise;
        const {tx, store} = this._tx(this.storeName, 'readwrite');
        const req = store.put(value, key);
        await this._reqToPromise(req);
        await new Promise( (res, rej) => {
            tx.oncomplete = () => res();
            tx.onerror = () => rej(tx.error);
        }
        );
    }

    async get(key) {
        await this._initPromise;
        try {
            const {store} = this._tx(this.storeName, 'readonly');
            const req = store.get(key);
            const result = await this._reqToPromise(req);
            return result === undefined ? undefined : result;
        } catch (err) {
            console.error('PermanentDictionary#get error:', err);
            return undefined;
        }
    }

    async delete(key) {
        await this._initPromise;
        try {
            const {tx, store} = this._tx(this.storeName, 'readwrite');
            const req = store.delete(key);
            await this._reqToPromise(req);
            await new Promise( (res, rej) => {
                tx.oncomplete = () => res();
                tx.onerror = () => rej(tx.error);
            }
            );
        } catch (err) {
            console.error('PermanentDictionary#delete error:', err);
            return undefined;
        }
    }

    async clear() {
        await this._initPromise;
        try {
            const {tx, store} = this._tx(this.storeName, 'readwrite');
            const req = store.clear();
            await this._reqToPromise(req);
            await new Promise( (res, rej) => {
                tx.oncomplete = () => res();
                tx.onerror = () => rej(tx.error);
            }
            );
        } catch (err) {
            console.error('PermanentDictionary#clear error:', err);
            return undefined;
        }
    }

    async has(key) {
        await this._initPromise;
        try {
            const {store} = this._tx(this.storeName, 'readonly');
            const req = store.getKey(key);
            const result = await this._reqToPromise(req);
            return result === undefined ? false : true;
        } catch (err) {
            console.error('PermanentDictionary#has error:', err);
            return undefined;
        }
    }

    async keys() {
        await this._initPromise;
        try {
            const {store} = this._tx(this.storeName, 'readonly');
            const req = store.getAllKeys();
            return await this._reqToPromise(req);
        } catch (err) {
            console.error('PermanentDictionary#keys error:', err);
            return undefined;
        }
    }

    async values() {
        await this._initPromise;
        try {
            const {store} = this._tx(this.storeName, 'readonly');
            const req = store.getAll();
            return await this._reqToPromise(req);
        } catch (err) {
            console.error('PermanentDictionary#values error:', err);
            return undefined;
        }
    }

    async entries() {
        await this._initPromise;
        try {
            const {store} = this._tx(this.storeName, 'readonly');
            return await new Promise( (resolve, reject) => {
                const result = [];
                const req = store.openCursor();
                req.onsuccess = () => {
                    const cursor = req.result;
                    if (cursor) {
                        result.push([cursor.key, cursor.value]);
                        cursor.continue();
                    } else {
                        resolve(result);
                    }
                }
                ;
                req.onerror = () => reject(req.error);
            }
            );
        } catch (err) {
            console.error('PermanentDictionary#entries error:', err);
            return undefined;
        }
    }
}


// --- helpers ---
const el = (tag, attrs={}, children=[]) => {
    const node = document.createElement(tag);
    for (const [k,v] of Object.entries(attrs)) {
        if (k === "style" && typeof v === "object")
            Object.assign(node.style, v);
        else if (k === "class")
            node.className = v;
        else if (k.startsWith("on") && typeof v === "function")
            node[k] = v;
        else
            node.setAttribute(k, v);
    }
    for (const child of [].concat(children)) {
        if (child == null)
            continue;
        node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    }
    return node;
}

// --- reset and basics ---
document.documentElement.lang = "en";
document.head.innerHTML = "";
document.body.innerHTML = "";

// meta + title
document.head.append(el("meta", {
    charset: "UTF-8"
}), el("meta", {
    name: "viewport",
    content: "width=device-width, initial-scale=1.0"
}), el("title", {}, ["EnglishIPA"]));

// CSS
const css = `
:root {
    --hue: 36;
    --color_background: hsl(var(--hue), 28%, 69%);
    --color_border: hsl(var(--hue), 30%, 37%);
    --color_font1: hsl(var(--hue), 29%, 28%);
    --color_background_light:hsl(var(--hue), 31%, 74%);
}

*:not(html):not(head):not(script) {
    display: flex;
    flex-direction: column;
    position: relative; 
    overflow: clip;
    box-sizing: border-box;    
    margin: 0;
    padding: 0;
    user-select: none;
    border: none;
    -webkit-user-select: none; /* for Safari and Chrome */
    -moz-user-select: none; /* for Firefox */
    -ms-user-select: none; /* for Internet Explorer */
    -webkit-tap-highlight-color: transparent;
}

*:not(html):not(head):not(script):focus {
    outline: none;
}

body {
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    height: 100vh;
    font-family: Calibri Light, Consolas, Arial, sans-serif;
    background-color: var(--color_background);
    color: black;
}

svg {
    fill: var(--color_font1)
}

#app00 {
	position: absolute;
	top: 35%;
	left: 50%;
	transform: translate(-50%, -50%);
	text-align: center;
    background-color: var(--color_background);
}

h1 {
	font-size: 36px;
	margin-bottom: 20px;
}

#row-warnings {
    display: none;
    justify-content: center;
    align-items: center;
    min-height: 45px;
    height: 45px;
    
}

#warning-sound {
    text-align: center;
    font-size: 0.7rem;
}

#enter-btn {
    display: flex; /* add this to make the button a flex container */
    flex-direction: row;
    row-gap: 50px;
    align-items: center; /* vertically center the contents */
	background-color: #4CAF50;
	color: #ffffff;
	padding: 10px 20px;
	border: none;
	border-radius: 5px;
	cursor: pointer;
    margin-top: 20px;
    text-align: center;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 4rem;
    font-size: 1.4rem;
    /* visibility: hidden; */
    visibility: visible;
}

#enter-btn:hover {
	background-color: #3e8e41;
}

.app {
    display: None;
    flex-direction: column;
    width: 100%;
    height: 100%;
    background-color: var(--color_background);
}

.row {
    display: flex;
    flex-direction: row;
    height: 60px;    
    min-height: 60px;
    width: 100%;
    border-bottom: 1px solid var(--color_border);
}

.text {
    display:flex;
    position: relative;    
    justify-content: center;
    align-items: center;
    flex-grow: 1;
    padding: 5vw;
    font-size: 4rem;
    background-color: var(--color_background);
    border:None;
}

.bttn {
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 1.8rem;
    color: var(--color_font1);
    background-color: var(--color_background);
    cursor: pointer;
    height: 100%;
    width: 60px;
    border-right:1px solid var(--color_border);
    position: relative;
}

.bttn:active {
    background-color: transparent;
}

.bttn-middle{
    flex-grow: 1;
    font-size: 1rem;
    padding-top: 7px;
    font-weight: bold;
}

.bttn-right{
    border: none;
}

.title {
    position: absolute;
    top: 0;
    left: 0; 
    padding: 6px;
    font-size: 0.8rem;
    font-weight: normal;
}

.list-element{
    justify-content: center;
    align-items: center;
    font-family: Consolas, Arial, sans-serif;
    font-size: 1.4rem;
    color: var(--color_font1);
    background-color: var(--color_background);
    cursor: pointer;
    height: 60px;
    min-height: 60px;    
    border-bottom: 1px solid var(--color_border);
    background-color: var(--color_background_light);

    overflow-x: auto;
    white-space: nowrap;
    width: 100%;
    padding-left: 20px;
    padding-right: 20px;
    font-size: 1.2rem;
}

.list-element:hover{
    background-color:var(--color_background);
}

.list{
    flex-grow: 1;
    overflow:auto;
    flex-direction: column;
}

#kindle {
    flex-grow: 1;
    font-size: 1rem;
}

#voice {
    width: 100px;
    display: None;
    font-size: 1rem;
    font-weight: bold;
}

#max_min {
    border: none;
}

#text{
    text-align: center;
    background-color: var(--color_background);
    overflow:auto;
}

#text-row{
    overflow-y: auto;
    flex-direction: column;
}

#book-row{
    height: 40px;
}

#book{
    padding-left: 20px;
    padding-right: 20px;   
}

#book-title{
    overflow-x: auto;
    white-space: nowrap;
    width: 100%;

}

#chapter{
    padding-left: 20px;
    padding-right: 20px;    
}

#chapter_title{
    overflow-x: auto;
    white-space: nowrap;
    width: 100%;
}

#sentence-row{
    align-items: center;
    justify-content: center;
    row-gap: 4px;
    height: auto;
}

#sentence-row > button{
    flex-direction: row;
    border: none;
    margin: 4px;
    min-width: 0px;
    width: auto;
}

#sentence-row > button > p{
    font-size: 1.4rem;
}

#sentence > p{
    padding: 5px;
    font-size: 1.4rem;
}

#sentence_number{
    width: 40px;
}

#sentence_total_number{
    width: 40px;
}

#help {
    position: absolute;
    bottom: 0;
    right: 0;
    padding: 16px;
    background-color: transparent;
    cursor: pointer;
}

.spinner {
    margin-left: 15px;
    width: 18px;
    height: 18px;
    border: 2px solid #fff;
    border-radius: 50%;
    border-top: 2px solid #4CAF50;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    0% {
        transform: rotate(0deg);
    }
    100% {
        transform: rotate(360deg);
    }
}
`;

document.head.append(el("style", {}, [css]));

// --- app00 (hidden splash) ---
const app00 = el("div", {
    id: "app00",
    style: {
        display: "none"
    }
}, [el("h1", {}, ["Welcome to Books in ", el("br"), " English IPA!"]), el("button", {
    id: "enter-btn",
    class: "bttn"
}, ["ENTER"])]);

// --- top row buttons ---
const svgRepeat = ( () => {
    const s = el("svg", {
        xmlns: "http://www.w3.org/2000/svg",
        height: "24px",
        viewBox: "0 -960 960 960",
        width: "24px",
        fill: "#5f6368"
    });
    s.innerHTML = `<path d="M647-440H160v-80h487L423-744l57-56 320 320-320 320-57-56 224-224Z"></path>`;
    return s;
}
)();

const svgSound = () => {
    const s = el("svg", {
        xmlns: "http://www.w3.org/2000/svg",
        height: "24px",
        viewBox: "0 -960 960 960",
        width: "24px",
        fill: "#5f6368"
    });
    s.innerHTML = `<path d="M792-56 671-177q-25 16-53 27.5T560-131v-82q14-5 27.5-10t25.5-12L480-368v208L280-360H120v-240h128L56-792l56-56 736 736-56 56Zm-8-232-58-58q17-31 25.5-65t8-70q0-94-55-168T560-749v-82q124 28 202 125.5T840-481q0 53-14.5 102T784-288ZM650-422l-90-90v-130q47 22 73.5 66t26.5 96q0 15-2.5 29.5T650-422ZM480-592 376-696l104-104v208Zm-80 238v-94l-72-72H200v80h114l86 86Zm-36-130Z"></path>`;
    return s;
}

const svgMaxMin = () => {
    const s = el("svg", {
        xmlns: "http://www.w3.org/2000/svg",
        height: "24px",
        viewBox: "0 -960 960 960",
        width: "24px",
        fill: "#5f6368"
    });
    s.innerHTML = `<path d="M240-120v-120H120v-80h200v200h-80Zm400 0v-200h200v80H720v120h-80ZM120-640v-80h120v-120h80v200H120Zm520 0v-200h80v120h120v80H640Z"></path>`;
    return s;
}

const topRow = el("div", {
    id: "top-row",
    class: "row"
}, [el("button", {
    id: "text_mode",
    class: "bttn"
}, ["a"]), el("button", {
    id: "repeat",
    class: "bttn"
}, [svgRepeat]), el("button", {
    id: "kindle",
    class: "bttn"
}, ["Buy Kindle"]), el("button", {
    id: "voice",
    class: "bttn bttn-voice",
    style: {
        display: "flex"
    }
}, ["US Female"]), el("button", {
    id: "sound",
    class: "bttn"
}, [svgSound()]), el("button", {
    id: "max_min",
    class: "bttn"
}, [svgMaxMin()])]);

// --- book row ---
const bookRow = el("div", {
    id: "book-row",
    class: "row"
}, [el("button", {
    id: "book_down",
    class: "bttn bttn-left"
}, ["‹"]), ( () => {
    const b = el("button", {
        id: "book",
        class: "bttn bttn-middle"
    });
    b.append(el("p", {
        id: "book_bʊ́k",
        class: "title"
    }, ["Book:"]), el("p", {
        id: "book_title"
    }, ["Psychology"]));
    return b;
}
)(), el("button", {
    id: "book_up",
    class: "bttn bttn-right"
}, ["›"])]);

// --- chapter row ---
const chapterRow = el("div", {
    id: "chapter-row",
    class: "row"
}, [el("button", {
    id: "chapter_down",
    class: "bttn bttn-left"
}, ["‹"]), ( () => {
    const c = el("button", {
        id: "chapter",
        class: "bttn bttn-middle"
    });
    c.append(el("p", {
        id: "chapter_ʧǽptər",
        class: "title"
    }, ["Chapter:"]), el("p", {
        id: "chapter_title"
    }, ["Introduction"]));
    return c;
}
)(), el("button", {
    id: "chapter_up",
    class: "bttn bttn-right"
}, ["›"])]);

// --- warning row ---
const warnRow = ( () => {
    const paragraph = el("p", {
        id: "warning-sound"
    }, ["This book has no sound available on a mobile phone"]);
    const warnRow = el("div", {
        id: "row-warnings",
        class: "row"
    }, [paragraph])
    return warnRow
}
)();

// --- text row ---
const textRow = el("div", {
    id: "text-row",
    class: "row text"
}, [el("p", {
    id: "text",
    style: "font-size: 4rem;"
}, ["The 101 most interesting concepts of Psychology."])]);

// --- sentence row ---
const sentenceRow = el("div", {
    id: "sentence-row",
    class: "row"
}, [el("button", {
    id: "sentence_down",
    class: "bttn"
}, ["‹"]), ( () => {
    const s = el("button", {
        id: "sentence",
        class: "bttn"
    });
    s.append(el("p", {
        id: "sentence_number"
    }, ["01"]), el("p", {}, [" / "]), el("p", {
        id: "sentence_total_number"
    }, ["10"]));
    return s;
}
)(), el("button", {
    id: "sentence_up",
    class: "bttn"
}, ["›"])]);

// --- app container ---
const app = el("div", {
    id: "app",
    class: "app",
    style: {
        display: "flex"
    }
}, [topRow, bookRow, chapterRow, warnRow, textRow, sentenceRow]);

// mount everything
document.body.append(app00, app);

// --- external scripts (sha256 + placeholders) ---
const loadScript = (src, defer=false) => new Promise( (resolve, reject) => {
    const s = el("script", {
        src
    });
    if (defer) {
        s.defer = true;
    }
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Failed to load: ${src}`));
    document.head.appendChild(s);
}
);

loadScript("https://cdnjs.cloudflare.com/ajax/libs/js-sha256/0.9.0/sha256.min.js").catch(console.warn);

console.log("Running script_fast.js")

function get_ICON(x) {
    const ICON_PATH = {
        start: '<path d="m384-334 96-74 96 74-36-122 90-64H518l-38-124-38 124H330l90 64-36 122ZM233-120l93-304L80-600h304l96-320 96 320h304L634-424l93 304-247-188-247 188Zm247-369Z"/>',
        exit_fullscreen: '<path d="M240-120v-120H120v-80h200v200h-80Zm400 0v-200h200v80H720v120h-80ZM120-640v-80h120v-120h80v200H120Zm520 0v-200h80v120h120v80H640Z"/>',
        enter_fullscreen: '<path d="M240-120v-120H120v-80h200v200h-80Zm400 0v-200h200v80H720v120h-80ZM120-640v-80h120v-120h80v200H120Zm520 0v-200h80v120h120v80H640Z"/>',
        si_sound: '<path d="M560-131v-82q90-26 145-100t55-168q0-94-55-168T560-749v-82q124 28 202 125.5T840-481q0 127-78 224.5T560-131ZM120-360v-240h160l200-200v640L280-360H120Zm440 40v-322q47 22 73.5 66t26.5 96q0 51-26.5 94.5T560-320ZM400-606l-86 86H200v80h114l86 86v-252ZM300-480Z"/>',
        no_sound: '<path d="M792-56 671-177q-25 16-53 27.5T560-131v-82q14-5 27.5-10t25.5-12L480-368v208L280-360H120v-240h128L56-792l56-56 736 736-56 56Zm-8-232-58-58q17-31 25.5-65t8.5-70q0-94-55-168T560-749v-82q124 28 202 125.5T840-481q0 53-14.5 102T784-288ZM650-422l-90-90v-130q47 22 73.5 66t26.5 96q0 15-2.5 29.5T650-422ZM480-592 376-696l104-104v208Zm-80 238v-94l-72-72H200v80h114l86 86Zm-36-130Z"/>',
        si_repeat: '<path d="M280-80 120-240l160-160 56 58-62 62h406v-160h80v240H274l62 62-56 58Zm-80-440v-240h486l-62-62 56-58 160 160-160 160-56-58 62-62H280v160h-80Z"/>',
        no_repeat: '<path d="M647-440H160v-80h487L423-744l57-56 320 320-320 320-57-56 224-224Z"/>',
    }
    if (ICON_PATH[x] === undefined) {
        console.log("ERROR: Icon not found" + x)
        return ""
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#5f6368"> ${ICON_PATH[x]} </svg>`
}

document.querySelector("#max_min").innerHTML = get_ICON("enter_fullscreen")
document.querySelector("#sound").innerHTML = get_ICON("no_sound")
document.querySelector("#repeat").innerHTML = get_ICON("no_repeat")

// EXPLAIN
window.speechSynthesis.getVoices()

console.log("Running script_slow.js")

function fileExistsSync(url) {
    let exists = false;
    try {
        const xhr = new XMLHttpRequest();
        xhr.open("HEAD", url, false);
        // Synchronous mode
        xhr.send();
        if (xhr.status === 200) {
            exists = true;
        }
    } catch (error) {
        console.error("Error checking file:", error);
    }
    return exists;
}

function get_hash(text) {
    const hashHex = sha256(text);
    return "ECHO_" + hashHex.substring(0, 30);
}

const STATE = {
    BXXX: "B001",
    CXXX: "C000",
    SXXX: "S000",
    voices: [],
    _repeat_count: 0,
    _voice: "echo",
    _isPhonetic: false,
    _isRepeat: false,
    _isSoftMuted: false,
    _isHardMuted: true,
    _mapVoiceNames: {
        // Edge
        "Ava": "Microsoft Ava Online (Natural) - English (United States)",
        "Andrew": "Microsoft Andrew Online (Natural) - English (United States)",
        "Emma": "Microsoft Emma Online (Natural) - English (United States)",
        "Brian": "Microsoft Brian Online (Natural) - English (United States)",
        "Ana": "Microsoft Ana Online (Natural) - English (United States)",
        "Aria": "Microsoft Aria Online (Natural) - English (United States)",
        "Chris": "Microsoft Christopher Online (Natural) - English (United States)",
        "Eric": "Microsoft Eric Online (Natural) - English (United States)",
        "Guy": "Microsoft Guy Online (Natural) - English (United States)",
        "Jenny": "Microsoft Jenny Online (Natural) - English (United States)",
        "Michelle": "Microsoft Michelle Online (Natural) - English (United States)",
        "Roger": "Microsoft Roger Online (Natural) - English (United States)",
        "Steffan": "Microsoft Steffan Online (Natural) - English (United States)",
        // Chrome
        "UK Male": "Google UK English Male",
        "UK Female": "Google UK English Female",
        "US Female": "Google US English",
    },

    get_voices() {
        this._voices = window.speechSynthesis.getVoices().filter(voice => {
            return Object.values(this._mapVoiceNames).includes(voice.name)
        }
        );
        return this._voices
    },

    get_voice_obj() {
        const voiceNames = STATE.voices
        for (const voiceName of voiceNames) {
            const voices = window.speechSynthesis.getVoices();
            for (let i = 0; i < voices.length; i++) {
                if (voices[i].name.includes(voiceName)) {
                    return voices[i];
                }
            }
        }
    },

    get voices() {
        return this._voices
    },

    set voices(value) {
        this._voices = value
    },

    get voice() {
        return this._voice
    },

    set voice(value) {
        this._voice = value
    },

    get isPhonetic() {
        return this._isPhonetic
    },

    set isPhonetic(value) {
        this._isPhonetic = !!value
        this.refresh_text()
    },

    get isRepeat() {
        return this._isRepeat
    },

    set isRepeat(value) {
        this._isRepeat = !!value
        this.refresh_repeat()
    },

    get isSoftMuted() {
        return this._isSoftMuted
    },

    set isSoftMuted(value) {
        this._isSoftMuted = !!value
        this.refresh_SoftMuted()
    },

    get isHardMuted() {
        return this._isHardMuted
    },

    set isHardMuted(value) {
        this._isHardMuted = !!value
        this.refresh_HardMuted()
    },

    get_mode_text() {
        if (this._isPhonetic) {
            return "tran"
        } else {
            return "text"
        }
    },

    toggleSpellingMode() {
        this._isPhonetic = !this.isPhonetic;
        this.refresh_text()
    },

    next_voice() {
        if (this.voices.length !== 0) {
            const index = this.voices.indexOf(this._voice)
            if (index === -1 && this._voice !== "echo") {
                this._voice = "echo"
            } else if (index === -1) {
                this._voice = this.voices[0]
            } else if (index === this.voices.length - 1) {
                this._voice = "echo"
            } else {
                this._voice = this.voices[index + 1]
            }
        } else {
            this._voice = "echo"
        }
        this.refresh_voice()
        play()
    },

    refresh_voice() {
        if (this._voice === "echo") {
            document.querySelector("#voice").innerHTML = "echo"
        } else {
            document.querySelector("#voice").innerHTML = Object.keys(this._mapVoiceNames).find(key => this._mapVoiceNames[key] === this._voice.name)
        }
    },

    refresh_text() {
        this.refresh_warning()
        if (this._isPhonetic) {
            document.querySelector("#text_mode").innerHTML = "æ";
            document.querySelector("#book_bʊ́k").innerHTML = "bʊ́k:"
            document.querySelector("#chapter_ʧǽptər").innerHTML = "ʧǽptər:"
            if (["B001"].includes(this.BXXX)) {
                document.querySelector("#kindle").innerHTML = ""
            } else {
                document.querySelector("#kindle").innerHTML = ""
            }
            const book_title = truncateString(obj_tracks[this.BXXX]["C000"]["S000"]["tran"])
            const chapter_title = truncateString(obj_tracks[this.BXXX][this.CXXX]["S000"]["tran"])
            const text = obj_tracks[this.BXXX][this.CXXX][this.SXXX]["tran"]
            document.querySelector("#book_title").innerHTML = book_title
            trimText("#book_title")
            document.querySelector("#chapter_title").innerHTML = chapter_title
            trimText("#chapter_title")
            document.querySelector("#sentence_number").innerHTML = addOneToNumber(this.SXXX.slice(2, 4))
            document.querySelector("#sentence_total_number").innerHTML = Object.keys(obj_tracks[this.BXXX][this.CXXX]).length.toString().padStart(2, '0')
            document.querySelector("#text").innerHTML = `${text.replace(": ", "<br><br>")}`
            if (this.CXXX === "C000") {
                document.querySelector("#chapter_title").innerHTML = "ᵻ̀ntrədʌ́kʃən"
                trimText("#chapter_title")
            }
        } else {
            document.querySelector("#text_mode").innerHTML = "a";
            document.querySelector("#book_bʊ́k").innerHTML = "Book:"
            document.querySelector("#chapter_ʧǽptər").innerHTML = "Chapter:"
            if (["B001"].includes(this.BXXX)) {
                document.querySelector("#kindle").innerHTML = ""
            } else {
                document.querySelector("#kindle").innerHTML = ""
            }
            const book_title = truncateString(obj_tracks[this.BXXX]["C000"]["S000"]["text"])
            const chapter_title = truncateString(obj_tracks[this.BXXX][this.CXXX]["S000"]["text"])
            const text = obj_tracks[this.BXXX][this.CXXX][this.SXXX]["text"]
            document.querySelector("#book_title").innerHTML = book_title
            trimText("#book_title")
            document.querySelector("#chapter_title").innerHTML = chapter_title
            trimText("#chapter_title")
            document.querySelector("#sentence_number").innerHTML = addOneToNumber(this.SXXX.slice(2, 4))
            document.querySelector("#sentence_total_number").innerHTML = Object.keys(obj_tracks[this.BXXX][this.CXXX]).length.toString().padStart(2, '0')
            document.querySelector("#text").innerHTML = `${text.replace(": ", "<br><br>")}`
            if (this.CXXX === "C000") {
                document.querySelector("#chapter_title").innerHTML = "Introduction"
                trimText("#chapter_title")
            }
        }
    },

    refresh_repeat() {
        if (this._isRepeat) {
            document.querySelector("#repeat").innerHTML = get_ICON("si_repeat")
        } else {
            document.querySelector("#repeat").innerHTML = get_ICON("no_repeat")
        }
    },

    refresh_HardMuted() {
        if (this._isHardMuted) {
            document.querySelector("#sound").innerHTML = get_ICON("no_sound")
            pause_play()
        } else {
            document.querySelector("#sound").innerHTML = get_ICON("si_sound")
            play()
        }
    },

    refresh_SoftMuted() {
        if (this._isSoftMuted) {
            document.querySelector("#sound").innerHTML = get_ICON("no_sound")
            pause_play()
        } else {
            document.querySelector("#sound").innerHTML = get_ICON("si_sound")
            play()
        }
    },

    refresh() {
        this.refresh_text()
        this.refresh_repeat()
        this.refresh_HardMuted()
        this.refresh_voice()
    },

    refresh_warning() {
		// const isBookWithSound = ["B001", "B002", "B009", "B016", "B020"].includes(this.BXXX)
	    // const areVoicesAvailable = this.voices.length !== 0
	    // if (areVoicesAvailable || isBookWithSound) {
	    //     document.querySelector("#row-warnings").style.display = "none"
	    // } else {
	    //     document.querySelector("#row-warnings").style.display = "flex"
	    // }
    }
}

function resizeText() {
    const isOverflown = ({clientHeight, scrollHeight}) => scrollHeight > clientHeight;
    const element = document.querySelector('#text')
    let i = 2;
    let overflow = true;
    while (overflow) {
        element.style.fontSize = `${i}rem`;
        overflow = isOverflown(element);
        if (overflow) {
            i -= 0.02;
        }
    }
}

function trimText(elementSelector) {
    let loop = 0
    const isOverflown = ({clientWidth, scrollWidth}) => scrollWidth > clientWidth;
    const element = document.querySelector(elementSelector)
    while (isOverflown(element) && element.innerHTML.length > 6 && loop < 500) {
        element.innerHTML = element.innerHTML.slice(0, -5) + " ..."
        loop += 1
    }
}

function trimElementText(element) {
    let loop = 0
    const isOverflown = ({clientWidth, scrollWidth}) => scrollWidth > clientWidth;
    const tmp = {
        a: element.clientWidth,
        b: element.scrollWidth,
        c: isOverflown(element),
        d: element.innerHTML.length
    }
    while (isOverflown(element) && element.innerHTML.length > 6 && loop < 500) {
        element.innerHTML = element.innerHTML.slice(0, -5) + " ..."
        loop += 1
    }
}

function deleteElementAndChildren(elementId) {
    const parent = document.getElementById(elementId);
    while (parent.firstChild) {
        parent.removeChild(parent.firstChild);
    }
    parent.remove()
}

function truncateString(str) {
    const max_length = 28
    str = str.trim().replace(".", "").trim()
    str = str.replace("The 101 most interesting concepts of ", "")
    str = str.replace("ðə 101 móʊst ᵻ́ntərəstᵻŋ kɒ́nsɛpts əv ", "")
    str = str.replace("The 101 most interesting concepts in ", "")
    str = str.replace("ðə 101 móʊst ᵻ́ntərəstᵻŋ kɒ́nsɛpts ᵻn ", "")
    str = str.replace("The 101 most important concepts of ", "")
    str = str.replace("ðə 101 móʊst ᵻ̀mpɔ́rtənt kɒ́nsɛpts əv ", "")
    str = str.replace("The 101 most important concepts in ", "")
    str = str.replace("ðə 101 móʊst ᵻ̀mpɔ́rtənt kɒ́nsɛpts ᵻn ", "")
    str = str.replace("The 101 most important events in human ", "")
    str = str.replace("ðə 101 móʊst ᵻ̀mpɔ́rtənt əvɛ́nts ᵻn hjúmən ", "")
    str = str.replace("The 101 most important events in ", "")
    str = str.replace("ðə 101 móʊst ᵻ̀mpɔ́rtənt əvɛ́nts ᵻn ", "")
    str = str.replace("The 101 most amazing Human", "")
    str = str.replace("ðə 101 móʊst əméɪzᵻŋ hjúmən ", "")
    str = str.replace("The 101 most impactful ", "")
    str = str.replace("ðə 101 móʊst ᵻ́mpæktfʊl ", "")
    str = str.replace("The 101 most influential ", "")
    str = str.replace("ðə 101 móʊst ᵻ̀nfluɛ́nʃəl ", "")
    str = str.replace("The 101 most relevant concepts of ", "")
    str = str.replace("ðə 101 móʊst rɛ́ləvənt kɒ́nsɛpts əv ", "")
    str = str.replace("The 101 most amazing ", "")
    str = str.replace("ðə 101 móʊst əméɪzᵻŋ ", "")
    str = str.replace("The 101 most memorable ", "")
    str = str.replace("ðə 101 móʊst mɛ́mərəbəl ", "")
    if (str.length <= max_length) {
        return str;
    }
    str = str.trim().replace(".", "").trim()
    return str;
}

function openInNewTab(url) {
    let newTab = document.createElement('a');
    newTab.href = url;
    newTab.target = "_blank";
    newTab.click();
}

function get_filtered_out_chapters() {
    const url = "../../filters/filters.txt"
    const filters_text = get_text(url)
    return filters_text.split("\n").filter(line => {
        return line.slice(0, 3) === "[x]"
    }
    ).reduce( (acc, line) => {
        const BXXXCXXX = line.slice(4, 12)
        acc[BXXXCXXX] = line
        return acc
    }
    , {})
}

function get_filters() {
    const url = "./filters/filters.txt"
    const filters_text = get_text(url)
    return filters_text.split("\n").filter(line => {
        return line.slice(0, 3) === "[o]"
    }
    ).reduce( (acc, line) => {
        const BXXXCXXX = line.slice(4, 12)
        acc[BXXXCXXX] = line
        return acc
    }
    , {})
}

async function get_books(TEXTS_TRANS) {
    const books = {}
    const folder = TEXTS_TRANS === "TEXTS" ? "text" : "transcriptions"
    const xxxxxx = TEXTS_TRANS === "TEXTS" ? "TEXTS" : "TRANS"
    const urls = [
	`../../${folder}/books/B001/B001_${xxxxxx}_ALL.txt`, 
	`../../${folder}/books/B002/B002_${xxxxxx}_ALL.txt`, 
	`../../${folder}/books/B003/B003_${xxxxxx}_ALL.txt`,
    `../../${folder}/books/B004/B004_${xxxxxx}_ALL.txt`,
    `../../${folder}/books/B005/B005_${xxxxxx}_ALL.txt`,
    `../../${folder}/books/B006/B006_${xxxxxx}_ALL.txt`,
    `../../${folder}/books/B007/B007_${xxxxxx}_ALL.txt`,
    `../../${folder}/books/B008/B008_${xxxxxx}_ALL.txt`,
    `../../${folder}/books/B009/B009_${xxxxxx}_ALL.txt`,
    `../../${folder}/books/B010/B010_${xxxxxx}_ALL.txt`,
    `../../${folder}/books/B011/B011_${xxxxxx}_ALL.txt`,
    `../../${folder}/books/B012/B012_${xxxxxx}_ALL.txt`,
    `../../${folder}/books/B013/B013_${xxxxxx}_ALL.txt`,
    `../../${folder}/books/B014/B014_${xxxxxx}_ALL.txt`,
    `../../${folder}/books/B015/B015_${xxxxxx}_ALL.txt`,
    `../../${folder}/books/B016/B016_${xxxxxx}_ALL.txt`, 
	`../../${folder}/books/B017/B017_${xxxxxx}_ALL.txt`,
    `../../${folder}/books/B018/B018_${xxxxxx}_ALL.txt`,
    `../../${folder}/books/B019/B019_${xxxxxx}_ALL.txt`,
    `../../${folder}/books/B020/B020_${xxxxxx}_ALL.txt`,
    `../../${folder}/books/B021/B021_${xxxxxx}_ALL.txt`, 
	`../../${folder}/books/B022/B022_${xxxxxx}_ALL.txt`, 
	]
    for (const url of urls) {
        const text = await get_text(url)
        if (text !== "") {
            const lines = text.trim().split("\n")
            let BXXX = ""
            let CXXX = ""
            let SXXX = ""
            let iSXXX = 0
            const regex = /^B\d{3}C\d{3}$/;
            for (let line of lines) {
                if (line.trim() !== "") {
                    if (regex.test(line.slice(0, 8))) {
                        BXXX = line.slice(0, 4)
                        CXXX = line.slice(4, 8)
                        iSXXX = 0
                        line = line.replace(BXXX + CXXX + "SXXX.txt: ", "")
                        line = line.replace(BXXX + CXXX + ": ", "")
                    } else {
                        iSXXX += 1
                    }
                    SXXX = "S" + iSXXX.toString().padStart(3, '0')
                    if (books[BXXX] === undefined) {
                        books[BXXX] = {}
                    }
                    if (books[BXXX][CXXX] === undefined) {
                        books[BXXX][CXXX] = {}
                    }
                    books[BXXX][CXXX][SXXX] = line
                }
            }
        }
    }
    return books
}

function applyfiter(tracks, filtered_out_chapters) {
    const filtered_tracks = {}
    const BXXXs = Object.keys(tracks)
    for (const BXXX of BXXXs) {
        filtered_tracks[BXXX] = {}
        const CXXXs = Object.keys(tracks[BXXX])
        for (const CXXX of CXXXs) {
            if (filtered_out_chapters[BXXX + CXXX] === undefined) {
                filtered_tracks[BXXX][CXXX] = tracks[BXXX][CXXX]
            }
        }
    }
    return filtered_tracks
}

async function get_obj_tracks() {
    const obj_tracks = {}
    const obj_books_texts = await get_books("TEXTS")
    const obj_books_trans = await get_books("TRANS")
    for (const BXXX in obj_books_trans) {
        obj_tracks[BXXX] = {}
        for (const CXXX in obj_books_trans[BXXX]) {
            obj_tracks[BXXX][CXXX] = {}
            for (const SXXX in obj_books_trans[BXXX][CXXX]) {
                obj_tracks[BXXX][CXXX][SXXX] = {
                    "code": BXXX + CXXX + SXXX,
                    "text": obj_books_texts[BXXX][CXXX][SXXX],
                    "tran": obj_books_trans[BXXX][CXXX][SXXX],
                    "audio": `../../audio/books/${BXXX}/${BXXX}${CXXX}${SXXX}_echo.mp3`,
                }
            }
        }
    }
    return obj_tracks
}

function distance(str1, str2) {
    //levenshteinDistance
    str1 = String(str1)
    str2 = String(str2)
    const m = str1.length;
    const n = str2.length;
    const d = new Array(m + 1);
    for (let i = 0; i <= m; i++) {
        d[i] = new Array(n + 1);
        d[i][0] = i;
    }
    for (let j = 0; j <= n; j++) {
        d[0][j] = j;
    }
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        }
    }
    return d[m][n];
}

function *enumerate(iterable) {
    let index = 0;
    for (const item of iterable) {
        yield[index, item];
        index++;
    }
}

async function get_text(url) {
	const permDictTextURL = new PermanentDictionary("url_text");
	const isUrlInDb = await permDictTextURL.has(url);
	if (isUrlInDb){
		return permDictTextURL.get(url)
	}
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url, false);
    xhr.send();
    if (xhr.status === 200) {
		permDictTextURL.set(url, xhr.responseText)
        return xhr.responseText;
    } else {
        console.log("ERROR: File missing: " + url)
        return "";
    }
}

function addOneToNumber(numStr) {
    let num = parseInt(numStr);
    num++;
    if (num < 10) {
        return '0' + num;
    } else {
        return num.toString();
    }
}

async function play() {
    STATE.refresh_text();
    resizeText();
	last_play += 1;
	const this_play = last_play
    if (STATE.isHardMuted || STATE.isSoftMuted) {
        return
    }
    const text = obj_tracks[STATE.BXXX][STATE.CXXX][STATE.SXXX]["text"];
    const audioEchoFileFullPath = `../../audio/echo/${get_hash(text)}.mp3`
    const audioFileFullPath = obj_tracks[STATE.BXXX][STATE.CXXX][STATE.SXXX]["audio"];
    const voice = STATE.voice
	if (voice === "echo") {
		pause_play();
		const textAudio = await fetcher.getAudioString(STATE.BXXX, STATE.CXXX, STATE.SXXX)
		const playendreturn = await player.playAudio(textAudio);
		if (this_play !== last_play) { return }
		if (!STATE.isRepeat || STATE._repeat_count > 60) {
			await next_track()
		} else {
			STATE._repeat_count += 1;
			await play()
		}
    } else if (voice !== "echo") {
        pause_play();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.voice = STATE.voice
        utterance.rate = 0.85;
        utterance.onend = function() {
			if (!STATE.isRepeat || STATE._repeat_count > 60) {
				next_track()
			} else {
				STATE._repeat_count += 1;
				play()
			}
        }
        window.speechSynthesis.speak(utterance);
    }
}

function pause_play() {
    window.speechSynthesis.cancel()
    audios.map(audio => {
        audio.pause();
    })
}

async function book_up() {
    const books = Object.keys(obj_tracks)
    const iBXXX = books.indexOf(STATE.BXXX)
    if (iBXXX < books.length - 1) {
        STATE.BXXX = books[iBXXX + 1]
        STATE.CXXX = "C000"
        STATE.SXXX = "S000"
        STATE.refresh_text()
        await play()
    }
}

async function book_down() {
    const books = Object.keys(obj_tracks)
    const iBXXX = books.indexOf(STATE.BXXX)
    if (iBXXX > 0) {
        STATE.BXXX = books[iBXXX - 1]
        STATE.CXXX = "C000"
        STATE.SXXX = "S000"
        STATE.refresh_text()
        await play()
    }
}

async function chapter_up() {
    const chapters = Object.keys(obj_tracks[STATE.BXXX])
    const iCXXX = chapters.indexOf(STATE.CXXX)
    if (iCXXX < chapters.length - 1) {
        STATE.CXXX = chapters[iCXXX + 1]
        STATE.SXXX = "S000"
        STATE.refresh_text()
        await play()
    }
}

async function chapter_down() {
    const chapters = Object.keys(obj_tracks[STATE.BXXX])
    const iCXXX = chapters.indexOf(STATE.CXXX)
    if (iCXXX > 0) {
        STATE.CXXX = chapters[iCXXX - 1]
        STATE.SXXX = "S000"
        STATE.refresh_text()
        await play()
    }
}

async function sentence_up() {
    const sentences = Object.keys(obj_tracks[STATE.BXXX][STATE.CXXX])
    const iSXXX = sentences.indexOf(STATE.SXXX)
    if (iSXXX < sentences.length - 1) {
        STATE.SXXX = sentences[iSXXX + 1]
        STATE.refresh_text()
        await play()
    }
}

async function sentence_down() {
    const sentences = Object.keys(obj_tracks[STATE.BXXX][STATE.CXXX])
    const iSXXX = sentences.indexOf(STATE.SXXX)
    if (iSXXX > 0) {
        STATE.SXXX = sentences[iSXXX - 1]
        STATE.refresh_text()
        await play()
    }
}

async function next_track() {
    STATE._repeat_count = 0;
    const books = Object.keys(obj_tracks)
    const chapters = Object.keys(obj_tracks[STATE.BXXX])
    const sentences = Object.keys(obj_tracks[STATE.BXXX][STATE.CXXX])
    const iBXXX = books.indexOf(STATE.BXXX)
    const iCXXX = chapters.indexOf(STATE.CXXX)
    const iSXXX = sentences.indexOf(STATE.SXXX)
    const isLastSentence = iSXXX >= sentences.length - 1
    const isLastChapter = iCXXX >= chapters.length - 1
    const isLastBook = iBXXX >= books.length - 1
    if (!isLastSentence) {
        STATE.SXXX = sentences[iSXXX + 1]
    } else if (!isLastChapter) {
        STATE.CXXX = chapters[iCXXX + 1]
        STATE.SXXX = "S000"
    } else if (!isLastBook) {
        STATE.BXXX = books[iBXXX + 1]
        STATE.CXXX = "C000"
        STATE.SXXX = "S000"
    } else {
        pause_play()
    }
    STATE.refresh_text()
    await play()
}

document.querySelector("#text_mode").addEventListener("click", function() {
    STATE.isPhonetic = !STATE.isPhonetic
    STATE.refresh_text()
})

document.querySelector("#repeat").addEventListener("click", function() {
    STATE.isRepeat = !STATE.isRepeat
    console.log("click_repeat")
    STATE.refresh_repeat()
})

document.querySelector("#sound").addEventListener("click", function() {
    STATE.isHardMuted = !STATE.isHardMuted
    STATE.refresh_HardMuted()
})

document.querySelector("#max_min").addEventListener("click", function() {
    if (document.fullscreenElement) {
        document.exitFullscreen();
    } else {
        document.documentElement.requestFullscreen();
    }
})

document.addEventListener('keydown', function(event) {
    if (event.key === 'Enter_') {
        event.preventDefault();
        next_track();
    } else if (event.key === " ") {
        event.preventDefault();
        STATE.toggleSpellingMode();
    } else if (event.key === "ArrowUp") {
        event.preventDefault();
        document.querySelector("#chapter_down").click()
    } else if (event.key === "ArrowDown") {
        event.preventDefault();
        document.querySelector("#chapter_up").click()
    } else if (event.key === "ArrowRight") {
        event.preventDefault();
        document.querySelector("#sentence_up").click()
    } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        document.querySelector("#sentence_down").click()
    } else if (event.key === "s") {
        event.preventDefault();
        document.querySelector("#sound").click()
    } else if (event.key === "a") {
        event.preventDefault();
        document.querySelector("#text_mode").click()
    } else if (event.key === 'Escape' || event.keyCode === 27) {
        for (const id of ["top", "book", "chapter", "sentence"]) {
            document.querySelector(`#${id}-row`).style.display = 'flex';
        }
    }
});

document.addEventListener("fullscreenchange", function() {
    if (document.fullscreenElement) {
        document.querySelector("#max_min").innerHTML = get_ICON("exit_fullscreen")
    } else {
        document.querySelector("#max_min").innerHTML = get_ICON("enter_fullscreen")
    }
});

document.querySelector("#text-row").addEventListener("click", function() {
    next_track()
});

window.addEventListener('resize', () => {
    const screenWidth = document.documentElement.clientWidth;
    const screenHeight = document.documentElement.clientHeight;
    for (const id of ["top", "book", "chapter", "sentence"]) {
        if (screenWidth > screenHeight * 1.8) {
            document.querySelector(`#${id}-row`).style.display = 'none';
        } else {
            document.querySelector(`#${id}-row`).style.display = 'flex';
        }
    }
}
);

document.querySelector("#book_up").addEventListener("click", function() {
    if (document.querySelector("#list") !== null) {
        deleteElementAndChildren("list")
        showBelowBookRow()
        showBelowChapterRow()
        STATE.isSoftMuted = false
        STATE.refresh()
        return
    }
    book_up()
});

document.querySelector("#book_down").addEventListener("click", function() {
    if (document.querySelector("#list") !== null) {
        deleteElementAndChildren("list")
        showBelowBookRow()
        showBelowChapterRow()
        STATE.isSoftMuted = false
        STATE.refresh()
        return
    }
    book_down()
});

document.querySelector("#chapter_up").addEventListener("click", chapter_up)
document.querySelector("#chapter_down").addEventListener("click", chapter_down)
document.querySelector("#sentence_up").addEventListener("click", sentence_up)
document.querySelector("#sentence_down").addEventListener("click", sentence_down)
document.querySelector("#voice").addEventListener('click', function() {
    STATE.next_voice()
});

function hideBelowBookRow() {
    document.querySelector("#chapter-row").style.display = "none"
    document.querySelector("#sentence-row").style.display = "none"
    document.querySelector("#text-row").style.display = "none"
    document.querySelector("#book_down").style.display = "none"
    document.querySelector("#book_up").style.display = "none"
    document.querySelector("#book > .title").style.display = "none"
    document.querySelector("#row-warnings").style.display = "none"
}

function showBelowBookRow() {
    document.querySelector("#chapter-row").style.display = "flex"
    document.querySelector("#sentence-row").style.display = "flex"
    document.querySelector("#text-row").style.display = "flex"
    document.querySelector("#book_down").style.display = "flex"
    document.querySelector("#book_up").style.display = "flex"
    document.querySelector("#book > .title").style.display = "flex"
}

function hideBelowChapterRow() {
    document.querySelector("#sentence-row").style.display = "none"
    document.querySelector("#text-row").style.display = "none"
    document.querySelector("#chapter_down").style.display = "none"
    document.querySelector("#chapter_up").style.display = "none"
    document.querySelector("#chapter > .title").style.display = "none"
    document.querySelector("#row-warnings").style.display = "none"
}

function showBelowChapterRow() {
    document.querySelector("#sentence-row").style.display = "flex"
    document.querySelector("#text-row").style.display = "flex"
    document.querySelector("#chapter_down").style.display = "flex"
    document.querySelector("#chapter_up").style.display = "flex"
    document.querySelector("#chapter > .title").style.display = "flex"
}

document.querySelector("#book").addEventListener("click", function() {
    STATE.isSoftMuted = true
    STATE.refresh_SoftMuted()
    if (document.querySelector("#list") !== null) {
        deleteElementAndChildren("list")
        showBelowBookRow()
        showBelowChapterRow()
        STATE.isSoftMuted = false
        STATE.refresh()
        return
    }
    hideBelowBookRow()
    const div_list = document.createElement("div");
    div_list.id = "list"
    div_list.className = "column list";
    document.querySelector("#app").appendChild(div_list);
    if (STATE.isPhonetic) {
        document.querySelector("#book_title").innerHTML = "ʧúz ə bʊ́k:"
        trimText("#book_title")
    } else {
        document.querySelector("#book_title").innerHTML = "Choose a Book:"
        trimText("#book_title")
    }
    const BXXXs = Object.keys(obj_tracks)
    for (const BXXX of BXXXs) {
        const div = document.createElement("div");
        div.className = "row list-element";
        div.innerHTML = truncateString(obj_tracks[BXXX]["C000"]["S000"][STATE.get_mode_text()])
        div.addEventListener("click", function() {
            STATE.BXXX = BXXX
            STATE.CXXX = "C000"
            STATE.SXXX = "S000"
            deleteElementAndChildren("list")
            showBelowBookRow()
            STATE.isSoftMuted = false
            STATE.refresh()
        });
        div_list.appendChild(div);
        trimElementText(div)
    }
});

document.querySelector("#chapter").addEventListener("click", function() {
    STATE.isSoftMuted = true
    STATE.refresh_SoftMuted()
    if (document.querySelector("#list") !== null) {
        deleteElementAndChildren("list")
        showBelowChapterRow()
        STATE.isSoftMuted = false
        STATE.refresh()
        return
    }
    hideBelowChapterRow()
    const div = document.createElement("div");
    div.id = "list"
    div.className = "column list";
    document.querySelector("#app").appendChild(div);
    if (STATE.isPhonetic) {
        document.querySelector("#chapter_title").innerHTML = "ʧúz ə ʧǽptər:"
        trimText("#chapter_title")
    } else {
        document.querySelector("#chapter_title").innerHTML = "Choose a Chapter:"
        trimText("#chapter_title")
    }
    const CXXXs = Object.keys(obj_tracks[STATE.BXXX])
    for (const CXXX of CXXXs) {
        const div = document.createElement("div");
        div.className = "row list-element";
        if (CXXX !== "C000") {
            div.innerHTML = truncateString(obj_tracks[STATE.BXXX][CXXX]["S000"][STATE.get_mode_text()])
            trimElementText(div)
        } else if (STATE.isPhonetic) {
            div.innerHTML = "ᵻ̀ntrədʌ́kʃən"
            trimElementText(div)
        } else {
            div.innerHTML = "Introduction"
            trimElementText(div)
        }
        div.addEventListener("click", function() {
            STATE.CXXX = CXXX
            STATE.SXXX = "S000"
            deleteElementAndChildren("list")
            showBelowChapterRow()
            STATE.isSoftMuted = false
            STATE.refresh()
        });
        document.querySelector("#list").appendChild(div);
        trimElementText(div)
    }
})

///////////////////////////////////////////////
//                                           //
///////////////////////////////////////////////

const audios = []
const playbackRate = 0.8
// const filtered_out_chapters = get_filtered_out_chapters()
const unfiltered_obj_tracks = await get_obj_tracks()
const obj_tracks = unfiltered_obj_tracks //applyfiter(unfiltered_obj_tracks, filtered_out_chapters)

setTimeout(_ => {
    STATE.get_voices()
    if (STATE.voices.length !== 0) {
        document.querySelector("#voice").style.display = "flex";
        STATE.next_voice()
    }
    STATE.refresh()
    document.querySelector("#enter-btn").innerHTML = "ENTER"
    document.querySelector("#enter-btn").addEventListener("click", function() {
        document.querySelector("#app").style.display = "flex"
        document.querySelector("#app00").style.display = "none"
    });
}, 100)

///////////////////////////////////////////////
//                                           //
///////////////////////////////////////////////

document.addEventListener('keydown', function(event) {
    event.stopPropagation();
    event.preventDefault();
    const key = event.key.toLowerCase();
    if (key === 'enter' && !event.repeat && recording === false) {
        enterStartTime = Date.now();
        recording = true;
    }
});

document.getElementById('text-row').addEventListener('touchstart', (e) => {
    startX = e.touches[0].pageX;
    startY = e.touches[0].pageY;
    touchStartTime = Date.now();
    recording = true;
});

document.getElementById('text-row').addEventListener('touchend', (e) => {
    const min_time = 600;
    const min_delta = 5;
    endX = e.changedTouches[0].pageX;
    endY = e.changedTouches[0].pageY;
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const touchDuration = Date.now() - touchStartTime;
    recording = false;
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX > +1 * min_delta) {
            sentence_down()
            console.log('Swiped right');
        }
        if (deltaX < -1 * min_delta) {
            console.log('Swiped left');
            sentence_up()
        }
    } else {
        if (deltaY > +1 * min_delta) {
            console.log('Swiped down');
            sentence_down()
        }
        if (deltaY < -1 * min_delta) {
            console.log('Swiped up');
            sentence_up()
        }
    }
}
);

// let voiceRecorder = new VoiceRecorder();
let recording = false;
let enterStartTime = 0;
let touchStartTime = 0;
let startX, startY, endX, endY;

// Chace

class Fetcher {
    constructor() {
        this.permdict_sounds = new PermanentDictionary("sounds");
        this.ready = async () => {
            await Promise.all([
				new PermanentDictionary("sounds")._initPromise]
			);
        }
    }

    async fetchAudioString(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                console.log(`Failed to fetch audio: ${response.status} ${response.statusText}`);
                return undefined;
            }
            const arrayBuffer = await response.arrayBuffer();
            const base64String = btoa(Array.from(new Uint8Array(arrayBuffer)).map(byte => String.fromCharCode(byte)).join(''));
            return `data:audio/mpeg;base64,${base64String}`;
        } catch (err) {
            console.log(`Error fetching audio from ${url}: ${err.message}`);
            return undefined;
        }
    }

    async fetchTextString(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                console.log(`Failed to fetch text: ${response.status} ${response.statusText}`);
                return undefined;
            }
            return await response.text();
        } catch (err) {
            console.log(`Error fetching text from ${url}: ${err.message}`);
            return undefined;
        }
    }

    async getAudioString(BXXX, CXXX, SXXX) {
        let text;
		const BXXXCXXXSXXX = BXXX + CXXX + SXXX;
        if (false === await this.permdict_sounds.has(BXXXCXXXSXXX) || undefined === await this.permdict_sounds.get(BXXXCXXXSXXX)) {
            const url = `https://englishipa.site/audio/books/${BXXX}/${BXXX}${CXXX}${SXXX}_echo.mp3`;
            text = await this.fetchAudioString(url);
            if (text === undefined) {
                const x1 = await app.fetcher.get_txt(app.state.BXXXCXXXSXXX)
                const x2 = sha256(x1)
                const x3 = "ECHO_" + x2.substring(0, 30)
                const url = `https://englishipa.site/audio/echo/${x3}.mp3`
                console.log(url);
                text = await this.fetchAudioString(url);
            }
            this.permdict_sounds.set(BXXXCXXXSXXX, text);
        }
        text = text ?? await this.permdict_sounds.get(BXXXCXXXSXXX);
        return text;
    }

	async getBookText(BXXX) {
		return text;
	}
}

class PlayString {
    constructor() {
        this.audio = document.createElement('audio');
        this.audio.style.display = 'none';
        this.audio.preload = 'auto';
        this.playPromise;
        if ('preservesPitch'in this.audio) {
            this.audio.preservesPitch = true;
        }
        if ('mozPreservesPitch'in this.audio) {
            this.audio.mozPreservesPitch = true;
        }
        if ('webkitPreservesPitch'in this.audio) {
            this.audio.webkitPreservesPitch = true;
        }
        if ('playbackPreservesPitch'in this.audio) {
            this.audio.playbackPreservesPitch = true;
        }
        document.body.appendChild(this.audio);
    }

    playAudio(audioString, playbackRate) {
        return new Promise( (resolve, reject) => {
            if (typeof audioString !== 'string') {
                console.log("ERROR: audioString not a string: " + audioString);
                return reject(new Error('Invalid audio string'));
            }
            this.stop();
            this.audio.src = audioString;
            this.audio.playbackRate = playbackRate ?? 0.85;

            const onEnded = () => {
                cleanup();
                resolve("ended");
            }

            const onPause = () => {
                if (!this.audio.ended) {
                    cleanup();
                    resolve("paused");
                }
            }

            const cleanup = () => {
                this.audio.removeEventListener('ended', onEnded);
                this.audio.removeEventListener('pause', onPause);
            }

            this.audio.addEventListener('ended', onEnded);
            this.audio.addEventListener('pause', onPause);
            this.playPromise = this.audio.play();
        });
    }

    stop() {
        this.audio.pause();
        this.audio.currentTime = 0;
    }

    setVolume(value) {
        const v = Math.min(Math.max(value, 0), 1);
        this.audio.volume = v;
    }

    increaseVolume() {
        this.setVolume(this.audio.volume + 0.1);
    }

    decreaseVolume() {
        this.setVolume(this.audio.volume - 0.1);
    }
}

const player = new PlayString();
const fetcher = new Fetcher();
await fetcher.ready
let last_play = 0
