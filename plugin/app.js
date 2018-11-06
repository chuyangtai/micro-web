// FastClick 消除click与物理tap之间300ms的延迟
+function ($) {
    'use strict';
    function FastClick(layer, options) {
        var oldOnClick;

        options = options || {};
        this.trackingClick = false;
        this.trackingClickStart = 0;
        this.targetElement = null;
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.lastTouchIdentifier = 0;
        this.touchBoundary = options.touchBoundary || 10;
        this.layer = layer;
        this.tapDelay = options.tapDelay || 200;
        this.tapTimeout = options.tapTimeout || 700;
        if (FastClick.notNeeded(layer)) {
            return;
        }
        function bind(method, context) {
            return function () { return method.apply(context, arguments); };
        }

        var methods = ['onMouse', 'onClick', 'onTouchStart', 'onTouchMove', 'onTouchEnd', 'onTouchCancel'];
        var context = this;

        for (var i = 0, l = methods.length; i < l; i++) {
            context[methods[i]] = bind(context[methods[i]], context);
        }

        if (deviceIsAndroid) {
            layer.addEventListener('mouseover', this.onMouse, true);
            layer.addEventListener('mousedown', this.onMouse, true);
            layer.addEventListener('mouseup', this.onMouse, true);
        }

        layer.addEventListener('click', this.onClick, true);
        layer.addEventListener('touchstart', this.onTouchStart, false);
        layer.addEventListener('touchmove', this.onTouchMove, false);
        layer.addEventListener('touchend', this.onTouchEnd, false);
        layer.addEventListener('touchcancel', this.onTouchCancel, false);

        if (!Event.prototype.stopImmediatePropagation) {
            layer.removeEventListener = function (type, callback, capture) {
                var rmv = Node.prototype.removeEventListener;
                if (type === 'click') {
                    rmv.call(layer, type, callback.hijacked || callback, capture);
                } else {
                    rmv.call(layer, type, callback, capture);
                }
            };
            layer.addEventListener = function (type, callback, capture) {
                var adv = Node.prototype.addEventListener;
                if (type === 'click') {
                    adv.call(layer, type, callback.hijacked || (callback.hijacked = function (event) {
                        if (!event.propagationStopped) {
                            callback(event);
                        }
                    }), capture);
                } else {
                    adv.call(layer, type, callback, capture);
                }
            };
        }

        if (typeof layer.onclick === 'function') {
            oldOnClick = layer.onclick;
            layer.addEventListener('click', function (event) {
                oldOnClick(event);
            }, false);
            layer.onclick = null;
        }
    }

    var deviceIsWindowsPhone = navigator.userAgent.indexOf("Windows Phone") >= 0;
    var deviceIsAndroid = navigator.userAgent.indexOf('Android') > 0 && !deviceIsWindowsPhone;
    var deviceIsIOS = /iP(ad|hone|od)/.test(navigator.userAgent) && !deviceIsWindowsPhone;
    var deviceIsIOS4 = deviceIsIOS && (/OS 4_\d(_\d)?/).test(navigator.userAgent);
    var deviceIsIOSWithBadTarget = deviceIsIOS && (/OS [6-7]_\d/).test(navigator.userAgent);
    var deviceIsBlackBerry10 = navigator.userAgent.indexOf('BB10') > 0;

    FastClick.prototype.needsClick = function (target) {
        switch (target.nodeName.toLowerCase()) {
            case 'button':
            case 'select':
            case 'textarea':
                if (target.disabled) {
                    return true;
                }
                break;
            case 'input':
                if ((deviceIsIOS && target.type === 'file') || target.disabled) {
                    return true;
                }
                break;
            case 'label':
            case 'iframe':
            case 'video':
                return true;
            default:
        }
        return (/\bneedsclick\b/).test(target.className);
    };
    FastClick.prototype.needsFocus = function (target) {
        switch (target.nodeName.toLowerCase()) {
            case 'textarea':
                return true;
            case 'select':
                return !deviceIsAndroid;
            case 'input':
                switch (target.type) {
                    case 'button':
                    case 'checkbox':
                    case 'file':
                    case 'image':
                    case 'radio':
                    case 'submit':
                        return false;
                }
                return !target.disabled && !target.readOnly;
            default:
                return (/\bneedsfocus\b/).test(target.className);
        }
    };
    FastClick.prototype.sendClick = function (targetElement, event) {
        var clickEvent, touch;

        if (document.activeElement && document.activeElement !== targetElement) {
            document.activeElement.blur();
        }

        touch = event.changedTouches[0];

        clickEvent = document.createEvent('MouseEvents');
        clickEvent.initMouseEvent(this.determineEventType(targetElement), true, true, window, 1, touch.screenX, touch.screenY, touch.clientX, touch.clientY, false, false, false, false, 0, null);
        clickEvent.forwardedTouchEvent = true;
        targetElement.dispatchEvent(clickEvent);
    };
    FastClick.prototype.determineEventType = function (targetElement) {
        if (deviceIsAndroid && targetElement.tagName.toLowerCase() === 'select') {
            return 'mousedown';
        }
        return 'click';
    };
    FastClick.prototype.focus = function (targetElement) {
        var length;
        if (deviceIsIOS && targetElement.setSelectionRange && targetElement.type.indexOf('date') !== 0 && targetElement.type !== 'time' && targetElement.type !== 'month') {
            length = targetElement.value.length;
            targetElement.setSelectionRange(length, length);
        } else {
            targetElement.focus();
        }
    };
    FastClick.prototype.updateScrollParent = function (targetElement) {
        var scrollParent, parentElement;

        scrollParent = targetElement.fastClickScrollParent;

        if (!scrollParent || !scrollParent.contains(targetElement)) {
            parentElement = targetElement;
            do {
                if (parentElement.scrollHeight > parentElement.offsetHeight) {
                    scrollParent = parentElement;
                    targetElement.fastClickScrollParent = parentElement;
                    break;
                }

                parentElement = parentElement.parentElement;
            } while (parentElement);
        }

        if (scrollParent) {
            scrollParent.fastClickLastScrollTop = scrollParent.scrollTop;
        }
    };
    FastClick.prototype.getTargetElementFromEventTarget = function (eventTarget) {
        if (eventTarget.nodeType === Node.TEXT_NODE) {
            return eventTarget.parentNode;
        }
        return eventTarget;
    };
    FastClick.prototype.onTouchStart = function (event) {
        var targetElement, touch, selection;

        if (event.targetTouches.length > 1) {
            return true;
        }

        targetElement = this.getTargetElementFromEventTarget(event.target);
        touch = event.targetTouches[0];

        if (deviceIsIOS) {
            selection = window.getSelection();
            if (selection.rangeCount && !selection.isCollapsed) {
                return true;
            }

            if (!deviceIsIOS4) {

                if (touch.identifier && touch.identifier === this.lastTouchIdentifier) {
                    event.preventDefault();
                    return false;
                }

                this.lastTouchIdentifier = touch.identifier;
                this.updateScrollParent(targetElement);
            }
        }

        this.trackingClick = true;
        this.trackingClickStart = event.timeStamp;
        this.targetElement = targetElement;

        this.touchStartX = touch.pageX;
        this.touchStartY = touch.pageY;

        if ((event.timeStamp - this.lastClickTime) < this.tapDelay) {
            event.preventDefault();
        }

        return true;
    };
    FastClick.prototype.touchHasMoved = function (event) {
        var touch = event.changedTouches[0], boundary = this.touchBoundary;

        if (Math.abs(touch.pageX - this.touchStartX) > boundary || Math.abs(touch.pageY - this.touchStartY) > boundary) {
            return true;
        }

        return false;
    };
    FastClick.prototype.onTouchMove = function (event) {
        if (!this.trackingClick) {
            return true;
        }

        if (this.targetElement !== this.getTargetElementFromEventTarget(event.target) || this.touchHasMoved(event)) {
            this.trackingClick = false;
            this.targetElement = null;
        }

        return true;
    };
    FastClick.prototype.findControl = function (labelElement) {
        if (labelElement.control !== undefined) {
            return labelElement.control;
        }

        if (labelElement.htmlFor) {
            return document.getElementById(labelElement.htmlFor);
        }

        return labelElement.querySelector('button, input:not([type=hidden]), keygen, meter, output, progress, select, textarea');
    };
    FastClick.prototype.onTouchEnd = function (event) {
        var forElement, trackingClickStart, targetTagName, scrollParent, touch, targetElement = this.targetElement;

        if (!this.trackingClick) {
            return true;
        }

        if ((event.timeStamp - this.lastClickTime) < this.tapDelay) {
            this.cancelNextClick = true;
            return true;
        }

        if ((event.timeStamp - this.trackingClickStart) > this.tapTimeout) {
            return true;
        }

        this.cancelNextClick = false;
        this.lastClickTime = event.timeStamp;
        trackingClickStart = this.trackingClickStart;
        this.trackingClick = false;
        this.trackingClickStart = 0;

        if (deviceIsIOSWithBadTarget) {
            touch = event.changedTouches[0];
            targetElement = document.elementFromPoint(touch.pageX - window.pageXOffset, touch.pageY - window.pageYOffset) || targetElement;
            targetElement.fastClickScrollParent = this.targetElement.fastClickScrollParent;
        }

        targetTagName = targetElement.tagName.toLowerCase();
        if (targetTagName === 'label') {
            forElement = this.findControl(targetElement);
            if (forElement) {
                this.focus(targetElement);
                if (deviceIsAndroid) {
                    return false;
                }
                targetElement = forElement;
            }
        } else if (this.needsFocus(targetElement)) {
            if ((event.timeStamp - trackingClickStart) > 100 || (deviceIsIOS && window.top !== window && targetTagName === 'input')) {
                this.targetElement = null;
                return false;
            }

            this.focus(targetElement);
            this.sendClick(targetElement, event);

            if (!deviceIsIOS || targetTagName !== 'select') {
                this.targetElement = null;
                event.preventDefault();
            }

            return false;
        } else {
            var parent = targetElement;
            while (parent && (parent.tagName.toUpperCase() !== "BODY")) {
                if (parent.tagName.toUpperCase() === "LABEL") {
                    $(parent).find("input").click();
                }
                parent = parent.parentNode;
            }
        }

        if (deviceIsIOS && !deviceIsIOS4) {
            scrollParent = targetElement.fastClickScrollParent;
            if (scrollParent && scrollParent.fastClickLastScrollTop !== scrollParent.scrollTop) {
                return true;
            }
        }

        if (!this.needsClick(targetElement)) {
            event.preventDefault();
            this.sendClick(targetElement, event);
        }

        return false;
    };
    FastClick.prototype.onTouchCancel = function () {
        this.trackingClick = false;
        this.targetElement = null;
    };
    FastClick.prototype.onMouse = function (event) {
        if (!this.targetElement) {
            return true;
        }

        if (event.forwardedTouchEvent) {
            return true;
        }

        if (!event.cancelable) {
            return true;
        }

        if (!this.needsClick(this.targetElement) || this.cancelNextClick) {
            if (event.stopImmediatePropagation) {
                event.stopImmediatePropagation();
            } else {
                event.propagationStopped = true;
            }

            event.stopPropagation();
            event.preventDefault();
            return false;
        }
        return true;
    };
    FastClick.prototype.onClick = function (event) {
        var permitted;

        if (this.trackingClick) {
            this.targetElement = null;
            this.trackingClick = false;
            return true;
        }

        if (event.target.type === 'submit' && event.detail === 0) {
            return true;
        }

        permitted = this.onMouse(event);

        if (!permitted) {
            this.targetElement = null;
        }

        return permitted;
    };
    FastClick.prototype.destroy = function () {
        var layer = this.layer;

        if (deviceIsAndroid) {
            layer.removeEventListener('mouseover', this.onMouse, true);
            layer.removeEventListener('mousedown', this.onMouse, true);
            layer.removeEventListener('mouseup', this.onMouse, true);
        }

        layer.removeEventListener('click', this.onClick, true);
        layer.removeEventListener('touchstart', this.onTouchStart, false);
        layer.removeEventListener('touchmove', this.onTouchMove, false);
        layer.removeEventListener('touchend', this.onTouchEnd, false);
        layer.removeEventListener('touchcancel', this.onTouchCancel, false);
    };
    FastClick.notNeeded = function (layer) {
        var metaViewport;
        var chromeVersion;
        var blackberryVersion;
        var firefoxVersion;

        if (typeof window.ontouchstart === 'undefined') {
            return true;
        }

        chromeVersion = +(/Chrome\/([0-9]+)/.exec(navigator.userAgent) || [, 0])[1];

        if (chromeVersion) {
            if (deviceIsAndroid) {
                metaViewport = document.querySelector('meta[name=viewport]');

                if (metaViewport) {
                    if (metaViewport.content.indexOf('user-scalable=no') !== -1) {
                        return true;
                    }
                    if (chromeVersion > 31 && document.documentElement.scrollWidth <= window.outerWidth) {
                        return true;
                    }
                }

            } else {
                return true;
            }
        }

        if (deviceIsBlackBerry10) {
            blackberryVersion = navigator.userAgent.match(/Version\/([0-9]*)\.([0-9]*)/);

            if (blackberryVersion[1] >= 10 && blackberryVersion[2] >= 3) {
                metaViewport = document.querySelector('meta[name=viewport]');

                if (metaViewport) {
                    if (metaViewport.content.indexOf('user-scalable=no') !== -1) {
                        return true;
                    }
                    if (document.documentElement.scrollWidth <= window.outerWidth) {
                        return true;
                    }
                }
            }
        }

        if (layer.style.msTouchAction === 'none' || layer.style.touchAction === 'manipulation') {
            return true;
        }

        firefoxVersion = +(/Firefox\/([0-9]+)/.exec(navigator.userAgent) || [, 0])[1];

        if (firefoxVersion >= 27) {
            metaViewport = document.querySelector('meta[name=viewport]');
            if (metaViewport && (metaViewport.content.indexOf('user-scalable=no') !== -1 || document.documentElement.scrollWidth <= window.outerWidth)) {
                return true;
            }
        }

        if (layer.style.touchAction === 'none' || layer.style.touchAction === 'manipulation') {
            return true;
        }

        return false;
    };

    FastClick.attach = function (layer, options) {
        return new FastClick(layer, options);
    };

    //直接绑定
    $(function () {
        FastClick.attach(document.body);
    });
}($);

/* detect $.os,$.browser */
+ function ($) {
    "use strict";
    function detect(ua, platform) {
        var os = this.os = {},
            browser = this.browser = {},
            webkit = ua.match(/Web[kK]it[\/]{0,1}([\d.]+)/),
            android = ua.match(/(Android);?[\s\/]+([\d.]+)?/),
            osx = !!ua.match(/\(Macintosh\; Intel /),
            ipad = ua.match(/(iPad).*OS\s([\d_]+)/),
            ipod = ua.match(/(iPod)(.*OS\s([\d_]+))?/),
            iphone = !ipad && ua.match(/(iPhone\sOS)\s([\d_]+)/),
            webos = ua.match(/(webOS|hpwOS)[\s\/]([\d.]+)/),
            win = /Win\d{2}|Windows/.test(platform),
            wp = ua.match(/Windows Phone ([\d.]+)/),
            touchpad = webos && ua.match(/TouchPad/),
            kindle = ua.match(/Kindle\/([\d.]+)/),
            silk = ua.match(/Silk\/([\d._]+)/),
            blackberry = ua.match(/(BlackBerry).*Version\/([\d.]+)/),
            bb10 = ua.match(/(BB10).*Version\/([\d.]+)/),
            rimtabletos = ua.match(/(RIM\sTablet\sOS)\s([\d.]+)/),
            playbook = ua.match(/PlayBook/),
            chrome = ua.match(/Chrome\/([\d.]+)/) || ua.match(/CriOS\/([\d.]+)/),
            firefox = ua.match(/Firefox\/([\d.]+)/),
            firefoxos = ua.match(/\((?:Mobile|Tablet); rv:([\d.]+)\).*Firefox\/[\d.]+/),
            ie = ua.match(/MSIE\s([\d.]+)/) || ua.match(/Trident\/[\d](?=[^\?]+).*rv:([0-9.].)/),
            webview = !chrome && ua.match(/(iPhone|iPod|iPad).*AppleWebKit(?!.*Safari)/),
            safari = webview || ua.match(/Version\/([\d.]+)([^S](Safari)|[^M]*(Mobile)[^S]*(Safari))/);

        if (browser.webkit = !!webkit) browser.version = webkit[1];

        if (android) os.android = true, os.version = android[2];
        if (iphone && !ipod) os.ios = os.iphone = true, os.version = iphone[2].replace(/_/g, '.');
        if (ipad) os.ios = os.ipad = true, os.version = ipad[2].replace(/_/g, '.');
        if (ipod) os.ios = os.ipod = true, os.version = ipod[3] ? ipod[3].replace(/_/g, '.') : null;
        if (wp) os.wp = true, os.version = wp[1];
        if (webos) os.webos = true, os.version = webos[2];
        if (touchpad) os.touchpad = true;
        if (blackberry) os.blackberry = true, os.version = blackberry[2];
        if (bb10) os.bb10 = true, os.version = bb10[2];
        if (rimtabletos) os.rimtabletos = true, os.version = rimtabletos[2];
        if (playbook) browser.playbook = true;
        if (kindle) os.kindle = true, os.version = kindle[1];
        if (silk) browser.silk = true, browser.version = silk[1];
        if (!silk && os.android && ua.match(/Kindle Fire/)) browser.silk = true;
        if (chrome) browser.chrome = true, browser.version = chrome[1];
        if (firefox) browser.firefox = true, browser.version = firefox[1];
        if (firefoxos) os.firefoxos = true, os.version = firefoxos[1];
        if (ie) browser.ie = true, browser.version = ie[1];
        if (safari && (osx || os.ios || win)) {
            browser.safari = true;
            if (!os.ios) browser.version = safari[1];
        }
        if (webview) browser.webview = true;

        os.tablet = !!(ipad || playbook || (android && !ua.match(/Mobile/)) ||
            (firefox && ua.match(/Tablet/)) || (ie && !ua.match(/Phone/) && ua.match(/Touch/)));
        os.phone = !!(!os.tablet && !os.ipod && (android || iphone || webos || blackberry || bb10 ||
            (chrome && ua.match(/Android/)) || (chrome && ua.match(/CriOS\/([\d.]+)/)) ||
            (firefox && ua.match(/Mobile/)) || (ie && ua.match(/Touch/))));
    }

    detect.call($, navigator.userAgent, navigator.platform);
}($);

// $.device
+function ($) {
    "use strict";
    var device = {};
    var ua = navigator.userAgent;

    var android = ua.match(/(Android);?[\s\/]+([\d.]+)?/);
    var ipad = ua.match(/(iPad).*OS\s([\d_]+)/);
    var ipod = ua.match(/(iPod)(.*OS\s([\d_]+))?/);
    var iphone = !ipad && ua.match(/(iPhone\sOS)\s([\d_]+)/);

    device.ios = device.android = device.iphone = device.ipad = device.androidChrome = false;

    // Android
    if (android) {
        device.os = 'android';
        device.osVersion = android[2];
        device.android = true;
        device.androidChrome = ua.toLowerCase().indexOf('chrome') >= 0;
    }
    if (ipad || iphone || ipod) {
        device.os = 'ios';
        device.ios = true;
    }
    // iOS
    if (iphone && !ipod) {
        device.osVersion = iphone[2].replace(/_/g, '.');
        device.iphone = true;
    }
    if (ipad) {
        device.osVersion = ipad[2].replace(/_/g, '.');
        device.ipad = true;
    }
    if (ipod) {
        device.osVersion = ipod[3] ? ipod[3].replace(/_/g, '.') : null;
        device.iphone = true;
    }
    // iOS 8+ changed UA
    if (device.ios && device.osVersion && ua.indexOf('Version/') >= 0) {
        if (device.osVersion.split('.')[0] === '10') {
            device.osVersion = ua.toLowerCase().split('version/')[1].split(' ')[0];
        }
    }

    // Webview
    device.webView = (iphone || ipad || ipod) && ua.match(/.*AppleWebKit(?!.*Safari)/i);

    // Minimal UI
    if (device.os && device.os === 'ios') {
        var osVersionArr = device.osVersion.split('.');
        device.minimalUi = !device.webView &&
                            (ipod || iphone) &&
                            (osVersionArr[0] * 1 === 7 ? osVersionArr[1] * 1 >= 1 : osVersionArr[0] * 1 > 7) &&
                            $('meta[name="viewport"]').length > 0 && $('meta[name="viewport"]').attr('content').indexOf('minimal-ui') >= 0;
    }

    // Check for status bar and fullscreen app mode
    var windowWidth = $(window).width();
    var windowHeight = $(window).height();
    device.statusBar = false;
    if (device.webView && (windowWidth * windowHeight === screen.width * screen.height)) {
        device.statusBar = true;
    }
    else {
        device.statusBar = false;
    }

    // Classes
    var classNames = [];

    // Pixel Ratio
    device.pixelRatio = window.devicePixelRatio || 1;
    classNames.push('pixel-ratio-' + Math.floor(device.pixelRatio));
    if (device.pixelRatio >= 2) {
        classNames.push('retina');
    }

    // OS classes
    if (device.os) {
        classNames.push(device.os, device.os + '-' + device.osVersion.split('.')[0], device.os + '-' + device.osVersion.replace(/\./g, '-'));
        if (device.os === 'ios') {
            var major = parseInt(device.osVersion.split('.')[0], 10);
            for (var i = major - 1; i >= 6; i--) {
                classNames.push('ios-gt-' + i);
            }
        }

    }
    // Status bar classes
    if (device.statusBar) {
        classNames.push('with-statusbar-overlay');
    }
    else {
        $('html').removeClass('with-statusbar-overlay');
    }

    // Add html classes
    if (classNames.length > 0) $('html').addClass(classNames.join(' '));

    $.device = device;
}($);

// utils WebKitCSSMatrix:true
+function ($) {
    "use strict";

    $.noop = function () { };

    //support
    $.support = (function () {
        var support = {
            touch: (window.Modernizr && Modernizr.touch === true) || (function () {
                return !!(('ontouchstart' in window) || window.DocumentTouch && document instanceof DocumentTouch);
            })(),
            // css3 浏览器是否支持属性值
            css3Value: function (property, value) {
                var dummy = document.createElement('p');
                var prefixes = ['', '-webkit-', '-moz-', '-o-', '-ms-'];
                var len = prefixes.length;

                for (var i = 0; i < len; i++) {
                    dummy.style[property] = prefixes[i] + value;
                    if (dummy.style[property]) return true;
                }

                return false;
            }
        };
        return support;
    })();

    $.touchEvents = {
        start: $.support.touch ? 'touchstart' : 'mousedown',
        move: $.support.touch ? 'touchmove' : 'mousemove',
        end: $.support.touch ? 'touchend' : 'mouseup',
        cancel: $.support.touch ? 'touchcancel' : ''
    };

    $.getTouchPosition = function (e) {
        e = e.originalEvent || e; //jquery wrap the originevent
        if (e.type === 'touchstart' || e.type === 'touchmove' || e.type === 'touchend') {
            return {
                x: e.targetTouches[0].pageX,
                y: e.targetTouches[0].pageY
            };
        } else {
            return {
                x: e.pageX,
                y: e.pageY
            };
        }
    };

    $.requestAnimationFrame = function (callback) {
        if (window.requestAnimationFrame) return window.requestAnimationFrame(callback);
        else if (window.webkitRequestAnimationFrame) return window.webkitRequestAnimationFrame(callback);
        else if (window.mozRequestAnimationFrame) return window.mozRequestAnimationFrame(callback);
        else {
            return window.setTimeout(callback, 1000 / 60);
        }
    };
    $.cancelAnimationFrame = function (id) {
        if (window.cancelAnimationFrame) return window.cancelAnimationFrame(id);
        else if (window.webkitCancelAnimationFrame) return window.webkitCancelAnimationFrame(id);
        else if (window.mozCancelAnimationFrame) return window.mozCancelAnimationFrame(id);
        else {
            return window.clearTimeout(id);
        }
    };

    $.getTranslate = function (el, axis) {
        var matrix, curTransform, curStyle, transformMatrix;

        // automatic axis detection
        if (typeof axis === 'undefined') {
            axis = 'x';
        }

        curStyle = window.getComputedStyle(el, null);
        if (window.WebKitCSSMatrix) {
            // Some old versions of Webkit choke when 'none' is passed; pass
            // empty string instead in this case
            transformMatrix = new WebKitCSSMatrix(curStyle.webkitTransform === 'none' ? '' : curStyle.webkitTransform);
        }
        else {
            transformMatrix = curStyle.MozTransform || curStyle.OTransform || curStyle.MsTransform || curStyle.msTransform || curStyle.transform || curStyle.getPropertyValue('transform').replace('translate(', 'matrix(1, 0, 0, 1,');
            matrix = transformMatrix.toString().split(',');
        }

        if (axis === 'x') {
            //Latest Chrome and webkits Fix
            if (window.WebKitCSSMatrix)
                curTransform = transformMatrix.m41;
                //Crazy IE10 Matrix
            else if (matrix.length === 16)
                curTransform = parseFloat(matrix[12]);
                //Normal Browsers
            else
                curTransform = parseFloat(matrix[4]);
        }
        if (axis === 'y') {
            //Latest Chrome and webkits Fix
            if (window.WebKitCSSMatrix)
                curTransform = transformMatrix.m42;
                //Crazy IE10 Matrix
            else if (matrix.length === 16)
                curTransform = parseFloat(matrix[13]);
                //Normal Browsers
            else
                curTransform = parseFloat(matrix[5]);
        }

        return curTransform || 0;
    };

    $.fn.transitionEnd = function (callback) {
        var events = ['webkitTransitionEnd', 'transitionend', 'oTransitionEnd', 'MSTransitionEnd', 'msTransitionEnd'],
            i, dom = this;

        function fireCallBack(e) {
            /*jshint validthis:true */
            if (e.target !== this) return;
            callback.call(this, e);
            for (i = 0; i < events.length; i++) {
                dom.off(events[i], fireCallBack);
            }
        }
        if (callback) {
            for (i = 0; i < events.length; i++) {
                dom.on(events[i], fireCallBack);
            }
        }
        return this;
    };
    $.fn.animationEnd = function (callback) {
        var events = ['webkitAnimationEnd', 'OAnimationEnd', 'MSAnimationEnd', 'animationend'],
            i, dom = this;

        function fireCallBack(e) {
            callback(e);
            for (i = 0; i < events.length; i++) {
                dom.off(events[i], fireCallBack);
            }
        }
        if (callback) {
            for (i = 0; i < events.length; i++) {
                dom.on(events[i], fireCallBack);
            }
        }
        return this;
    };
    $.fn.transition = function (duration) {
        if (typeof duration !== 'string') {
            duration = duration + 'ms';
        }
        for (var i = 0; i < this.length; i++) {
            var elStyle = this[i].style;
            elStyle.webkitTransitionDuration = elStyle.MsTransitionDuration = elStyle.msTransitionDuration = elStyle.MozTransitionDuration = elStyle.OTransitionDuration = elStyle.transitionDuration = duration;
        }
        return this;
    };
    $.fn.transform = function (transform) {
        for (var i = 0; i < this.length; i++) {
            var elStyle = this[i].style;
            elStyle.webkitTransform = elStyle.MsTransform = elStyle.msTransform = elStyle.MozTransform = elStyle.OTransform = elStyle.transform = transform;
        }
        return this;
    };

    $.fn.scrollHeight = function () {
        return this[0].scrollHeight;
    };
    /** axis y (animate)
     * @param target : 'max'||percentage||DOMElement|| jQuery selector
     * @param [duration]: animate duration
     * @param [callback]: after animate callback
     *
     * $(selector).scrollTo('max'); 滚动到底部
     * $(selector).scrollTo('50%');
     * $(selector).scrollTo(selector); selector jQuery / DOMElement
     */
    $.fn.scrollTo = function (target, duration, callback) {
        if (target === undefined) { return; }
        if (target === 'max') { target = 9e9; }

        return this.each(function () {
            var elem = this,
                $elem = $(elem),
                _target = target,
                scrollTop;

            var max = elem.scrollHeight - $elem.height();

            switch (typeof _target) {
                case 'number':
                case 'string':
                    if (/^([+-]=?)?\d+(\.\d+)?(px|%)?$/.test(_target)) {
                        var top = _target;
                        // Handle percentage values
                        scrollTop = top.slice && top.slice(-1) === '%' ? parseFloat(top) / 100 * max : top;
                        break;
                    }
                    _target = $(_target, elem);
                case 'object':
                    if (_target.length === 0) {
                        return;
                    }
                    scrollTop = _target.offset().top + ($elem.scrollTop() - $elem.offset().top);
                    break;
            }

            // Number or 'number'
            if (/^\d+$/.test(scrollTop)) {
                scrollTop = scrollTop <= 0 ? 0 : Math.min(scrollTop, max);
            }
            console.log('scrolltop--' + scrollTop);
            $elem.animate({ scrollTop: scrollTop }, {
                duration: duration || 0,
                complete: callback && function () {
                    callback.call(elem);
                }
            });
        });
    };
}($);

// utils
+function ($) {
    "use strict";
    /**
     * 创建并返回一个像节流阀一样的函数，当重复调用函数的时候，至少每隔 wait毫秒调用一次该函数。控制触发频率较高的事件
     */
    $.throttle = function (wait, no_trailing, func, debounce_mode) {
        var timeout_id,

          last_exec = 0;

        if (typeof no_trailing !== 'boolean') {
            debounce_mode = func;
            func = no_trailing;
            no_trailing = undefined;
        }

        function wrapper() {
            var that = this,
              elapsed = +new Date() - last_exec,
              args = arguments;

            function exec() {
                last_exec = +new Date();
                func.apply(that, args);
            };

            function clear() {
                timeout_id = undefined;
            };

            if (debounce_mode && !timeout_id) {
                exec();
            }

            timeout_id && clearTimeout(timeout_id);

            if (debounce_mode === undefined && elapsed > wait) {
                exec();

            } else if (no_trailing !== true) {
                timeout_id = setTimeout(debounce_mode ? clear : exec, debounce_mode === undefined ? wait - elapsed : wait);
            }
        };

        if ($.guid) {
            wrapper.guid = func.guid = func.guid || $.guid++;
        }

        return wrapper;
    };

    /**
     * $.debounce(wait, function, [immediate]) 是空闲时间必须大于或等于 一定值的时候，才会执行调用方法。
     * 返回 function 函数的防反跳版本, 将延迟函数的执行(真正的执行)在函数最后一次调用时刻的 wait 毫秒之后。
     * 传参 immediate 为 true， debounce会在 wait 时间间隔的开始调用这个函数 。在 wait 的时间之内，不会再次调用
     *
     * //绑定事件
     * $(document).on('touchmove', $.debounce(250, touchmoveHander));//频繁滚动，每250ms，执行一次touchmoveHandler
     *
     * //解绑事件
     * $(document).off('touchmove', touchmoveHander);//注意这里面off还是touchmoveHander,而不是$.throttle返回的function
     *
     */
    $.debounce = function (wait, immediate, func) {
        return func === undefined
          ? $.throttle(wait, immediate, false)
          : $.throttle(wait, func, immediate !== false);
    };

    $.fn.hasAttr = function (name) {
        return this[0].hasAttribute(name);
    };

    /* alert重写
     * msg 必填 文本
     * type 可选 text|success|error|warning 默认text
     * time 延迟消失时间
     */
    window.alert = function (msg, type, time) {
        var template = {
            text: '{{value}}',
            success: '<span class="ui-icon-alert-check color-success"></span>{{value}}',
            error: '<span class="ui-icon-alert-cancel color-danger"></span>{{value}}</div>',
            warning: '<span class="ui-icon-alert-warning color-warning"></span>{{value}}'
        };
        var _alert = $('<div class="modal window-alert">' + template[type || 'text'].replace('{{value}}', msg) + '</div>').appendTo(document.body);
        _alert.show().css({
            marginLeft: -Math.round(parseInt(window.getComputedStyle(_alert[0]).width) / 2) + 'px'
        }).addClass('modal-in');

        setTimeout(function () {
            _alert.removeClass('modal-in').addClass('modal-out').transitionEnd(function (e) {
                _alert.remove();
            });
        }, time || 1500);
    };

    $.showIndicator = function (page) {
        $(page).append('<div class="preloader-indicator-overlay"></div><div class="preloader-indicator-modal"><span class="preloader preloader-white"></span></div>');
    };
    $.hideIndicator = function (page) {
        $('.preloader-indicator-overlay, .preloader-indicator-modal', page).remove();
    };
    /* toast
     * text 文本
     * stype 可选 checked|cancel|forbidden|text|loading 默认为checked
     * callback remove时触发的回调函数
     */
    $.toast = function (text, style, callback) {
        if (typeof style === "function") {
            callback = style;
            style = undefined;
        }
        var overlayer = $('<div class="toast-overlay"></div>').appendTo(document.body);
        var style = style || 'checked';
        var html = [];
        html.push('<div class="modal modal-toast modal-toast-');
        html.push(style);
        html.push('">');
        html.push('<i class="ui-icon-toast-');
        html.push(style);
        html.push('"></i>');
        html.push('<p class="modal-toast-content">');
        html.push(text || "已经完成");
        html.push('</p>');
        html.push('</div>');

        var toast = $(html.join('')).appendTo(document.body);

        toast.show().addClass('modal-in');

        setTimeout(function () {
            toast.removeClass('modal-in').addClass('modal-out').transitionEnd(function (e) {
                overlayer.remove();
                toast.remove();
                callback && callback(toast);
            });
        }, 1500);
    };
    // Prevent scrolling
    if (!$.device.android) {
        $(document).on($.touchEvents.move, '.modal, .preloader-indicator-overlay, .preloader-indicator-modal', function (e) {
            e.preventDefault();
        });
    }
}($);


