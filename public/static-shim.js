/**
 * static-shim.js — serverless shim for static hosting (e.g. GitHub Pages).
 *
 * Replicates the mock API surface of server.js / routes/user.js / routes/ws.js
 * entirely in the browser by patching fetch, XMLHttpRequest and WebSocket
 * before the app bundles load. Must be the first script in index.html.
 */
(function () {
  "use strict";

  // ---- Mock data (mirrors server.js / routes) ----

  var LICENSE = {
    license: "pro",
    expire: "2099-12-31T23:59:59.000Z",
    created: "2021-09-22T19:58:35.018Z",
    legacy: false,
  };

  var LANGUAGES = {
    0: "de-DE",
    1: "en",
    2: "zh-CN",
    3: "pt-BR",
    4: "es-ES",
    5: "fr-FR",
    6: "pl-PL",
    7: "ru-RU",
    8: "tr-TR",
    9: "cs-CZ",
    10: "zh-TW",
    11: "it-IT",
    12: "ja-JP",
    13: "nl-NL",
    14: "sv-SE",
  };

  var LOCALE_TO_CODE = {};
  Object.keys(LANGUAGES).forEach(function (k) {
    LOCALE_TO_CODE[LANGUAGES[k].toLowerCase()] = Number(k);
  });

  function resolveLocale(langOrLocale) {
    if (langOrLocale in LANGUAGES) return LANGUAGES[langOrLocale];
    if (
      typeof langOrLocale === "string" &&
      LOCALE_TO_CODE[langOrLocale.toLowerCase()] !== undefined
    ) {
      return langOrLocale;
    }
    return "en";
  }

  var USER_PROFILE = {
    id: "12345678",
    email: "example@example.net",
    email_verified: true,
    email_expire: null,
    login: null,
    name: "Test User",
    avatar:
      "https://gravatar.com/avatar/2b6848a6719e6c2e6747d506d1ff57b3?s=64&d=retro",
    admin: null,
    flash: null,
    last_seen: new Date().toISOString(),
    app: "designer",
    last_update: new Date().toISOString(),
    stats: {},
    address: "",
    city: "",
    zip: "",
    state: "",
    country: "",
    trial_created: "2021-09-22T19:58:35.018Z",
    trial_expire: "2099-10-07T19:58:35.018Z",
    pro_created: "2021-09-22T19:58:35.018Z",
    pro_expire: "2099-12-31T23:59:59.000Z",
    created: "2021-09-22T19:58:32.748Z",
    last_name: "",
    runtime: "Browser",
    user_type: "normal",
    deactivated: false,
    legacy: false,
    guest_created: null,
    guest_expire: null,
    version: "3.15.0",
  };

  var SETTINGS = {
    notifications_disabled: false,
    trialDays: 15,
    quotas: { free: null, pro: null },
    subscription: {
      annual: { productId: null, coupon: "Trial20" },
      extraParameters: { "x-at": null, "x-clickref": null },
    },
    license: { offlineExpirationTime: 1296000000, offlineCountdown: 604800000 },
    reminders: {
      offlineWarning: 86400000,
      proOfferInFree: 1296000000,
      proOfferInTrial: 432000000,
      proOfferInTrialExpired: 1296000000,
      proOfferInTrialExpireSoon: 86400000,
      proOfferInTrialLastWarning: 0,
      proOfferSpecialPrice: 0,
      proExpireSoon: 2592000000,
    },
    flags: {
      welcomeMessage: false,
      windowsStoreAnnouncement: false,
      proOfferSpecialPrice: false,
      proOfferInTrialExpireSoon: false,
      proOfferInTrialLastWarning: false,
    },
  };

  // ---- Route table ----
  // Handlers receive the parsed URL object and the raw request body (if any)
  // and return { body, contentType?, status? }. body objects are JSON-encoded.

  function json(body) {
    return { body: body, contentType: "application/json" };
  }
  function text(body) {
    return { body: body, contentType: "text/html" };
  }

  var ROUTES = [
    { m: "GET", p: /\/connection\/test$/, h: function () { return text("OK"); } },
    { m: "GET", p: /\/maintenance\/status$/, h: function () { return json({ maintenance: false }); } },
    { m: "GET", p: /\/i18n-url\/[^/]+\/designer$/, h: function () { return json({}); } },
    { m: "GET", p: /\/license$/, h: function () { return json(LICENSE); } },
    { m: "GET", p: /\/subscription\/test$/, h: function () { return json({ active: true, plan: "pro", status: 1 }); } },
    { m: "GET", p: /\/subscription\/nextbillingdate$/, h: function () { return json({ date: "2099-12-31T23:59:59.000Z" }); } },
    { m: "GET", p: /\/subscription\/lifetime$/, h: function () { return json({ lifetime: true }); } },
    { m: "GET", p: /\/quota$/, h: function () { return json({ quota: { pro: {}, free: {} } }); } },
    { m: "GET", p: /\/ever-subscribed$/, h: function () { return json({ subscribed: true }); } },
    { m: "GET", p: /\/total-subscription-days$/, h: function () { return json({ days: 9999 }); } },
    { m: "GET", p: /\/pro\/paywall\/[^/]+$/, h: function () { return text(""); } },
    { m: "GET", p: /\/file$/, h: function () { return json([]); } },
    { m: "GET", p: /\/null$/, h: function () { return json({}); } },
    {
      m: "GET",
      p: /\/user\/settings$/,
      h: function () { return json(SETTINGS); },
    },
    {
      m: "GET",
      p: /\/user$/,
      h: function (url) {
        var locale = resolveLocale(url.searchParams.get("lang"));
        var out = {};
        Object.keys(USER_PROFILE).forEach(function (k) { out[k] = USER_PROFILE[k]; });
        out.locale = locale;
        out.settings = SETTINGS;
        return json(out);
      },
    },
    {
      m: "PUT",
      p: /\/user$/,
      h: function (_url, body) {
        var locale = "en";
        try {
          var parsed = typeof body === "string" ? JSON.parse(body) : body;
          if (parsed && parsed.locale != null) locale = resolveLocale(parsed.locale);
        } catch (e) { /* keep default */ }
        return json({
          id: USER_PROFILE.id,
          name: USER_PROFILE.name,
          locale: locale,
          email: USER_PROFILE.email,
          version: USER_PROFILE.version,
          runtime: USER_PROFILE.runtime,
          settings: { notifications_disabled: false },
        });
      },
    },
  ];

  function resolveMock(method, rawUrl) {
    var url;
    try {
      url = new URL(rawUrl, location.href);
    } catch (e) {
      return null;
    }
    // Only intercept same-origin (or origin-less relative) API calls; leave
    // genuine cross-origin requests (fonts, gravatar, etc.) untouched.
    if (url.origin !== location.origin) return null;
    var m = (method || "GET").toUpperCase();
    for (var i = 0; i < ROUTES.length; i++) {
      if (ROUTES[i].m === m && ROUTES[i].p.test(url.pathname)) {
        return { route: ROUTES[i], url: url };
      }
    }
    return null;
  }

  function buildResult(hit, body) {
    var res = hit.route.h(hit.url, body);
    var textBody =
      typeof res.body === "string" ? res.body : JSON.stringify(res.body);
    return {
      status: res.status || 200,
      contentType: res.contentType || "application/json",
      text: textBody,
    };
  }

  // ---- fetch ----

  var origFetch = window.fetch;
  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : (input && input.url) || "";
    var method =
      (init && init.method) || (input && input.method) || "GET";
    var hit = resolveMock(method, url);
    if (!hit) return origFetch.apply(this, arguments);
    var res = buildResult(hit, init && init.body);
    return Promise.resolve(
      new Response(res.text, {
        status: res.status,
        headers: { "Content-Type": res.contentType },
      })
    );
  };

  // ---- XMLHttpRequest ----

  var XHR = window.XMLHttpRequest;
  var origOpen = XHR.prototype.open;
  var origSend = XHR.prototype.send;
  var origSetHeader = XHR.prototype.setRequestHeader;

  XHR.prototype.open = function (method, url) {
    this.__shimHit = resolveMock(method, url);
    if (this.__shimHit) {
      this.__shimUrl = String(url);
      return; // skip native open entirely for mocked requests
    }
    return origOpen.apply(this, arguments);
  };

  XHR.prototype.setRequestHeader = function () {
    if (this.__shimHit) return;
    return origSetHeader.apply(this, arguments);
  };

  XHR.prototype.send = function (body) {
    if (!this.__shimHit) return origSend.apply(this, arguments);
    var self = this;
    var res = buildResult(this.__shimHit, body);
    setTimeout(function () {
      ["readyState", "status", "statusText", "responseText", "response", "responseURL"].forEach(function (prop) {
        var value = {
          readyState: 4,
          status: res.status,
          statusText: "OK",
          responseText: res.text,
          response: res.text,
          responseURL: new URL(self.__shimUrl, location.href).href,
        }[prop];
        Object.defineProperty(self, prop, { value: value, configurable: true });
      });
      self.getAllResponseHeaders = function () {
        return "content-type: " + res.contentType + "\r\n";
      };
      self.getResponseHeader = function (name) {
        return String(name).toLowerCase() === "content-type" ? res.contentType : null;
      };
      // on* handlers are registered as listeners on native EventTargets, so
      // dispatchEvent alone fires both addEventListener and on* callbacks.
      self.dispatchEvent(new Event("readystatechange"));
      self.dispatchEvent(new Event("load"));
      self.dispatchEvent(new Event("loadend"));
    }, 0);
  };

  // ---- WebSocket (/license/license) ----

  var OrigWS = window.WebSocket;

  function FakeLicenseSocket(url) {
    var self = this;
    this.url = String(url);
    this.readyState = 0; // CONNECTING
    this.protocol = "";
    this.extensions = "";
    this.binaryType = "blob";
    this.bufferedAmount = 0;
    this._listeners = {};
    setTimeout(function () {
      self.readyState = 1; // OPEN
      self._emit("open", new Event("open"));
      self._emit(
        "message",
        new MessageEvent("message", {
          data: JSON.stringify({ name: "license", data: LICENSE }),
        })
      );
    }, 0);
  }

  FakeLicenseSocket.prototype.addEventListener = function (type, fn) {
    (this._listeners[type] = this._listeners[type] || []).push(fn);
  };
  FakeLicenseSocket.prototype.removeEventListener = function (type, fn) {
    this._listeners[type] = (this._listeners[type] || []).filter(function (f) {
      return f !== fn;
    });
  };
  FakeLicenseSocket.prototype._emit = function (type, event) {
    var handler = this["on" + type];
    if (typeof handler === "function") {
      try { handler.call(this, event); } catch (e) { /* ignore */ }
    }
    (this._listeners[type] || []).slice().forEach(function (fn) {
      try { fn(event); } catch (e) { /* ignore */ }
    });
  };
  FakeLicenseSocket.prototype.send = function (data) {
    var self = this;
    if (this.readyState !== 1) return;
    var isPing = data === "ping";
    if (!isPing) {
      try {
        isPing = JSON.parse(data).name === "ping";
      } catch (e) { /* not JSON */ }
    }
    if (isPing) {
      setTimeout(function () {
        self._emit(
          "message",
          new MessageEvent("message", { data: JSON.stringify({ name: "pong" }) })
        );
      }, 0);
    }
  };
  FakeLicenseSocket.prototype.close = function () {
    if (this.readyState === 3) return;
    this.readyState = 3; // CLOSED
    this._emit("close", new Event("close"));
  };
  FakeLicenseSocket.prototype.CONNECTING = 0;
  FakeLicenseSocket.prototype.OPEN = 1;
  FakeLicenseSocket.prototype.CLOSING = 2;
  FakeLicenseSocket.prototype.CLOSED = 3;

  function PatchedWebSocket(url, protocols) {
    var pathname = "";
    try {
      pathname = new URL(url, location.href).pathname;
    } catch (e) { /* fall through to real socket */ }
    if (/\/license\/license$/.test(pathname)) {
      return new FakeLicenseSocket(url);
    }
    return protocols !== undefined
      ? new OrigWS(url, protocols)
      : new OrigWS(url);
  }
  PatchedWebSocket.prototype = OrigWS.prototype;
  PatchedWebSocket.CONNECTING = OrigWS.CONNECTING;
  PatchedWebSocket.OPEN = OrigWS.OPEN;
  PatchedWebSocket.CLOSING = OrigWS.CLOSING;
  PatchedWebSocket.CLOSED = OrigWS.CLOSED;
  window.WebSocket = PatchedWebSocket;
})();
